import { JobStatus, JobType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { TransposeAutomationJobSchema } from "@/lib/validation";
import { extractTextFromPasteInput, extractTextFromTemporaryFile } from "@/lib/transpose-parser";
import {
  consumeTemporaryAutomationBatch,
  consumeTemporaryAiReview,
  createTemporaryAutomationBatch,
  deleteTemporaryAutomationBatch,
  readTemporaryAutomationFile,
  storeTemporaryAiReview,
} from "@/lib/temporary-automation-store";
import type {
  LyricsExtractorJobInput,
  LyricsExtractorSafeInput,
  LyricsExtractorSafeOutput,
} from "@/lib/extractor-types";
import { getErrorMessage } from "@/lib/errors";
import { runAiLyricsCleanup } from "@/lib/extractor-ai";

const STANDALONE_FORMATTER_SCOPE = "standalone-song-formatter";

export function sanitizeExtractorFileNameSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "song";
}

function toSafeInput(input: LyricsExtractorJobInput): LyricsExtractorSafeInput {
  return {
    sourceMode: input.sourceMode,
    hasSongContext: Boolean(input.songId || input.serviceSongId),
    sourceLabel: input.songTitle?.trim() || undefined,
  };
}

export async function createExtractorJob(serviceId: string, input: LyricsExtractorJobInput) {
  return prisma.automationJob.create({
    data: {
      serviceId,
      jobType: JobType.TRANSPOSE,
      status: JobStatus.QUEUED,
      inputJson: toSafeInput(input),
    },
  });
}

export async function processExtractorJob(serviceId: string, jobId: string, rawInput: unknown) {
  const parsed = TransposeAutomationJobSchema.safeParse({
    jobType: JobType.TRANSPOSE,
    inputJson: rawInput,
  });

  if (!parsed.success) {
    throw new Error("Song lyrics extractor input is invalid.");
  }

  const input = parsed.data.inputJson;

  await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      inputJson: toSafeInput(input),
      status: JobStatus.PROCESSING,
    },
  });

  let parserResult: {
    parser: "docx" | "pdf" | "txt" | "paste";
    text: string;
    sectionCount: number;
    normalizationApplied: boolean;
    confidence: "high" | "medium" | "low";
    warningCodes: LyricsExtractorSafeOutput["warningCodes"];
  };

  if (input.sourceMode === "paste") {
    parserResult = extractTextFromPasteInput(input.pastedText);
  } else {
    const file = await readTemporaryAutomationFile(serviceId, input.batchId);
    if (!file) {
      throw new Error("Temporary automation upload is unavailable or expired.");
    }

    try {
      parserResult = await extractTextFromTemporaryFile(file.path, file.mimeType);
    } finally {
      await consumeTemporaryAutomationBatch(serviceId, input.batchId);
    }
  }

  const safeOutput: LyricsExtractorSafeOutput = {
    parser: parserResult.parser,
    extractedLineCount: parserResult.text.split("\n").filter((line) => line.trim().length > 0).length,
    sectionCount: parserResult.sectionCount,
    normalizationApplied: parserResult.normalizationApplied,
    mode: "local",
    confidence: parserResult.confidence,
    warningCodes: parserResult.warningCodes,
    resultAvailable: true,
  };

  const retry =
    parserResult.confidence === "low"
      ? await storeTemporaryAiReview({
          serviceId,
          parser: parserResult.parser,
          confidence: parserResult.confidence,
          warningCodes: parserResult.warningCodes,
          extractedText: parserResult.text,
          songTitle: input.songTitle,
        })
      : undefined;

  await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.DONE,
      completedAt: new Date(),
      outputJson: safeOutput,
    },
  });

  return {
    kind: "editable" as const,
    text: parserResult.text,
    retry,
    outputJson: safeOutput,
  };
}

export async function processImmediateUploadExtractor(
  serviceId: string,
  file: File,
  songTitle?: string
) {
  const batch = await createTemporaryAutomationBatch(serviceId, [file]);
  let jobId: string | null = null;

  try {
    const input: LyricsExtractorJobInput = {
      sourceMode: "upload",
      batchId: batch.id,
      songTitle: songTitle?.trim() || undefined,
    };

    const job = await createExtractorJob(serviceId, input);
    jobId = job.id;

    return {
      job,
      input,
      result: await processExtractorJob(serviceId, job.id, input),
    };
  } catch (error: unknown) {
    await deleteTemporaryAutomationBatch(serviceId, batch.id);

    if (jobId) {
      await prisma.automationJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          completedAt: new Date(),
          outputJson: { error: getErrorMessage(error, "Lyrics extraction failed") },
        },
      });
    }

    throw error;
  }
}

function toEditableResult(parserResult: {
  parser: "docx" | "pdf" | "txt" | "paste";
  text: string;
  sectionCount: number;
  normalizationApplied: boolean;
  confidence: "high" | "medium" | "low";
  warningCodes: LyricsExtractorSafeOutput["warningCodes"];
}) {
  const safeOutput: LyricsExtractorSafeOutput = {
    parser: parserResult.parser,
    extractedLineCount: parserResult.text.split("\n").filter((line) => line.trim().length > 0).length,
    sectionCount: parserResult.sectionCount,
    normalizationApplied: parserResult.normalizationApplied,
    mode: "local",
    confidence: parserResult.confidence,
    warningCodes: parserResult.warningCodes,
    resultAvailable: true,
  };

  return {
    kind: "editable" as const,
    text: parserResult.text,
    outputJson: safeOutput,
  };
}

export async function processStandalonePasteExtractor(input: LyricsExtractorJobInput) {
  if (input.sourceMode !== "paste") {
    throw new Error("Standalone paste extractor input is invalid.");
  }

  const parserResult = extractTextFromPasteInput(input.pastedText);
  const result = toEditableResult(parserResult);
  const retry =
    parserResult.confidence === "low"
      ? await storeTemporaryAiReview({
          serviceId: STANDALONE_FORMATTER_SCOPE,
          parser: parserResult.parser,
          confidence: parserResult.confidence,
          warningCodes: parserResult.warningCodes,
          extractedText: parserResult.text,
          songTitle: input.songTitle,
        })
      : undefined;

  return { ...result, retry };
}

export async function processStandaloneUploadExtractor(file: File, songTitle?: string) {
  const batch = await createTemporaryAutomationBatch(STANDALONE_FORMATTER_SCOPE, [file]);

  try {
    const storedFile = await readTemporaryAutomationFile(STANDALONE_FORMATTER_SCOPE, batch.id);
    if (!storedFile) {
      throw new Error("Temporary formatter upload is unavailable or expired.");
    }

    const parserResult = await extractTextFromTemporaryFile(storedFile.path, storedFile.mimeType);
    const result = toEditableResult(parserResult);
    const retry =
      parserResult.confidence === "low"
        ? await storeTemporaryAiReview({
            serviceId: STANDALONE_FORMATTER_SCOPE,
            parser: parserResult.parser,
            confidence: parserResult.confidence,
            warningCodes: parserResult.warningCodes,
            extractedText: parserResult.text,
            songTitle,
          })
        : undefined;

    await consumeTemporaryAutomationBatch(STANDALONE_FORMATTER_SCOPE, batch.id);
    return { ...result, retry };
  } catch (error: unknown) {
    await deleteTemporaryAutomationBatch(STANDALONE_FORMATTER_SCOPE, batch.id);
    throw error;
  }
}

export async function processAiRetry(serviceId: string, retryToken: string) {
  const review = await consumeTemporaryAiReview(serviceId, retryToken);
  if (!review) {
    throw new Error("AI cleanup review token is unavailable or expired.");
  }

  const cleanedText = await runAiLyricsCleanup({
    extractedText: review.extractedText,
    parser: review.parser,
    songTitle: review.songTitle,
    warningCodes: review.warningCodes,
  });

  return {
    kind: "editable" as const,
    text: cleanedText,
    outputJson: {
      parser: review.parser,
      extractedLineCount: cleanedText.split("\n").filter((line) => line.trim().length > 0).length,
      sectionCount: cleanedText.split("\n").filter((line) => /^\[(?!Title\])/i.test(line.trim())).length,
      normalizationApplied: true,
      mode: "ai_fallback" as const,
      confidence: "medium" as const,
      warningCodes: review.warningCodes,
      resultAvailable: true,
    } satisfies LyricsExtractorSafeOutput,
  };
}

export async function processStandaloneAiRetry(retryToken: string) {
  return processAiRetry(STANDALONE_FORMATTER_SCOPE, retryToken);
}

export async function processDirectAiCleanup(params: {
  text: string;
  songTitle?: string;
}) {
  const cleanedText = await runAiLyricsCleanup({
    extractedText: params.text,
    parser: "txt",
    songTitle: params.songTitle,
    warningCodes: [],
  });

  return {
    kind: "editable" as const,
    text: cleanedText,
    outputJson: {
      parser: "txt" as const,
      extractedLineCount: cleanedText.split("\n").filter((line) => line.trim().length > 0).length,
      sectionCount: cleanedText.split("\n").filter((line) => /^\[(?!Title\])/i.test(line.trim())).length,
      normalizationApplied: true,
      mode: "ai_fallback" as const,
      confidence: "medium" as const,
      warningCodes: [],
      resultAvailable: true,
    } satisfies LyricsExtractorSafeOutput,
  };
}
