import type { ExtractorWarningCode } from "@/lib/extractor-types";

export type NormalizedExtractorWarning = {
  code: ExtractorWarningCode;
  title: string;
  message: string;
};

const EXTRACTOR_WARNING_MESSAGES = {
  variant_heading_detected: {
    title: "Arrangement label found",
    message: "The source contains a Chords, Lyrics, or Transposed label. Confirm the selected arrangement is correct.",
  },
  multiple_arrangements_detected: {
    title: "Multiple arrangements found",
    message: "The formatter selected one complete arrangement and left the other version out. Review the chosen song flow.",
  },
  directive_noise_detected: {
    title: "Performance directions found",
    message: "The source contains directions such as Instrumental, Intro, Interlude, or repeat notes. Confirm the surrounding lyrics.",
  },
  possible_chord_line_detected: {
    title: "Possible chord line kept",
    message: "A line resembles chord notation but contains an unfamiliar cue. It was kept so you can confirm whether it is a lyric.",
  },
  possible_trailing_content_detected: {
    title: "Possible content after the song",
    message: "Notes, credits, licensing details, or contact information may appear after the lyrics. They were kept so you can review them.",
  },
  repeated_restart_detected: {
    title: "Repeated song title found",
    message: "The title appears more than once. Confirm the formatter kept the intended arrangement.",
  },
  repeated_sections_detected: {
    title: "Repeated lyrics found",
    message: "Several lyric lines repeat. They were preserved because the repetition may be intentional.",
  },
  truncated_output_detected: {
    title: "Ending may be incomplete",
    message: "The formatted text appears to end with an unfinished phrase or empty section. Review the final block.",
  },
  sparse_output_detected: {
    title: "Very little lyric content found",
    message: "Only a few lyric lines were extracted. Confirm the source file contains the complete song.",
  },
  unlabeled_lines_detected: {
    title: "Section structure is unclear",
    message: "Some lyrics are not clearly grouped under song-section labels. Review the generated blocks.",
  },
} satisfies Record<ExtractorWarningCode, Omit<NormalizedExtractorWarning, "code">>;

export function normalizeExtractorWarnings(codes: ExtractorWarningCode[]) {
  return [...new Set(codes)].map((code) => ({ code, ...EXTRACTOR_WARNING_MESSAGES[code] }));
}
