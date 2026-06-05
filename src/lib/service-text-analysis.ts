import { BlockType, ServiceStatus } from "@prisma/client";

export type AnalyzedServiceParticipant = {
  blockType: BlockType;
  personName: string;
  personTitle?: string | null;
  order: number;
};

export type AnalyzedServiceDetail = {
  blockType: BlockType;
  key: string;
  value: string;
};

export type AnalyzedServiceDraft = {
  serviceDate?: string;
  ministryName?: string;
  theme?: string | null;
  status: ServiceStatus;
  participants: AnalyzedServiceParticipant[];
  details: AnalyzedServiceDetail[];
  warnings: string[];
};

const PARTICIPANT_BLOCKS: Record<string, BlockType> = {
  "call to worship": BlockType.CALL_TO_WORSHIP,
  mc: BlockType.MC,
  pap: BlockType.MC,
  "papuri at pasasalamat": BlockType.MC,
  "tipan/pahayag": BlockType.TIPAN_PAHAYAG,
  tipan: BlockType.TIPAN_PAHAYAG,
  pahayag: BlockType.TIPAN_PAHAYAG,
  "scripture reading": BlockType.SCRIPTURE_READING,
  offering: BlockType.OFFERING,
  announcements: BlockType.FLOWERS_FOR_THE_LORD,
  "flowers for the lord": BlockType.FLOWERS_FOR_THE_LORD,
};

const DETAIL_BLOCKS: Record<string, BlockType> = {
  "tawag ng pagsamba": BlockType.CALL_TO_WORSHIP,
  "awit ng himno": BlockType.AWIT_NG_HIMNO,
  "tipan/pahayag": BlockType.TIPAN_PAHAYAG,
  tipan: BlockType.TIPAN_PAHAYAG,
  pahayag: BlockType.TIPAN_PAHAYAG,
  speaker: BlockType.SERMON,
  "bible reading": BlockType.SCRIPTURE_READING,
  "awit ng pakikinig": BlockType.AWIT_NG_PAKIKINIG,
  "awit ng pagtugon": BlockType.AWIT_NG_PAGTUGON,
};

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function normalizeKey(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.:]+$/g, "")
    .toLowerCase();
}

function normalizeMinistry(value: string) {
  const cleanValue = value.trim().replace(/\s+/g, " ");
  if (/^ladies$/i.test(cleanValue)) return "Ladies Ministry";
  if (/^youth$/i.test(cleanValue)) return "Youth Worship Service";
  return cleanValue;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseHeader(line: string, now: Date) {
  const match = line.trim().match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(.+))?$/);
  if (!match) return null;

  const month = MONTHS[match[1].toLowerCase()];
  if (month === undefined) return null;

  const date = new Date(now.getFullYear(), month, Number(match[2]));
  return {
    serviceDate: toDateInputValue(date),
    ministryName: match[3] ? normalizeMinistry(match[3]) : undefined,
  };
}

function splitLine(line: string) {
  const [key, ...rest] = line.split(/\s+-\s+/);
  const value = rest.join(" - ").trim();
  if (!key?.trim() || !value) return null;
  return { key: key.trim(), value };
}

function parsePerson(rawValue: string, order: number): Omit<AnalyzedServiceParticipant, "blockType"> {
  const cleanValue = rawValue.trim().replace(/^@/, "").replace(/\s+/g, " ");
  const titleMatch = cleanValue.match(/^(Ptr\.|Sis\.|Bro\.|Rev\.|Pastor)\s+(.+)$/i);

  if (!titleMatch) {
    return {
      personName: cleanValue.replace(/@/g, "").trim(),
      personTitle: null,
      order,
    };
  }

  return {
    personName: titleMatch[2].replace(/@/g, "").trim(),
    personTitle: titleMatch[1],
    order,
  };
}

export function analyzeServiceText(input: string, now = new Date()): AnalyzedServiceDraft {
  const warnings: string[] = [];
  const participants: AnalyzedServiceParticipant[] = [];
  const details: AnalyzedServiceDetail[] = [];
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let inDetails = false;
  let serviceDate: string | undefined;
  let ministryName: string | undefined;

  for (const line of lines) {
    if (/^ws participants$/i.test(line)) continue;

    const header = parseHeader(line, now);
    if (header) {
      serviceDate = header.serviceDate;
      ministryName = header.ministryName;
      continue;
    }

    if (/^details:?$/i.test(line)) {
      inDetails = true;
      continue;
    }

    const split = splitLine(line);
    if (!split) {
      warnings.push(`Could not parse: ${line}`);
      continue;
    }

    const normalizedKey = normalizeKey(split.key);

    if (inDetails) {
      const blockType = DETAIL_BLOCKS[normalizedKey];
      if (!blockType) {
        warnings.push(`Unknown detail line: ${line}`);
        continue;
      }

      details.push({
        blockType,
        key: split.key,
        value: split.value,
      });
      continue;
    }

    const blockType = PARTICIPANT_BLOCKS[normalizedKey];
    if (!blockType) {
      warnings.push(`Unknown participant line: ${line}`);
      continue;
    }

    split.value
      .split(/\s*&\s*/)
      .map((person) => person.trim())
      .filter(Boolean)
      .forEach((person, index) => {
        participants.push({
          blockType,
          ...parsePerson(person, index),
        });
      });
  }

  return {
    serviceDate,
    ministryName,
    theme: null,
    status: ServiceStatus.DRAFT,
    participants,
    details,
    warnings,
  };
}
