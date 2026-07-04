import { BlockType, ServiceStatus, type BlockType as BlockTypeValue, type ServiceStatus as ServiceStatusValue } from "./service-constants.ts";
import type { ServiceHymnalRole, ServiceServantRole } from "./service-records.ts";

export type AnalyzedServiceParticipant = {
  blockType: BlockTypeValue;
  personName: string;
  personTitle?: string | null;
  order: number;
};

export type AnalyzedServiceDetail = {
  blockType: BlockTypeValue;
  key: string;
  value: string;
};

export type AnalyzedServiceDraft = {
  serviceDate?: string;
  ministryName?: string;
  theme?: string | null;
  status: ServiceStatusValue;
  sermonVerse?: string;
  bibleVerses: Array<{
    verse: string;
    order: number;
  }>;
  servantAssignments: Array<{
    role: ServiceServantRole;
    personName: string;
  }>;
  hymnals: Array<{
    role: ServiceHymnalRole;
    title: string;
  }>;
  participants: AnalyzedServiceParticipant[];
  details: AnalyzedServiceDetail[];
  warnings: string[];
};

const PARTICIPANT_BLOCKS: Record<string, BlockTypeValue> = {
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

const DETAIL_BLOCKS: Record<string, BlockTypeValue> = {
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

const SERVANT_ASSIGNMENT_KEYS: Record<string, ServiceServantRole> = {
  "call to worship": "CALL_TO_WORSHIP",
  mc: "EMCEE",
  "scripture reading": "SCRIPTURE_READER",
  offering: "OFFERING",
  speaker: "SERMON_SPEAKER",
};

const HYMNAL_KEYS: Record<string, ServiceHymnalRole> = {
  "awit ng pakikinig": "HYMN_OF_PREPARATION",
  "awit ng pagtugon": "HYMN_OF_RESPONSE",
  "pag-awit ng himno": "SONG_OF_HYMNS",
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

function formatHymnalTitle(rawValue: string) {
  const match = rawValue.trim().match(/^(.*?),\s*p\.\s*(\d+)\s*$/i);
  if (!match) return rawValue.trim();
  return `${match[2].padStart(3, "0")} - ${match[1].trim()}`;
}

export function analyzeServiceText(input: string, now = new Date()): AnalyzedServiceDraft {
  const warnings: string[] = [];
  const participants: AnalyzedServiceParticipant[] = [];
  const details: AnalyzedServiceDetail[] = [];
  const servantAssignments: AnalyzedServiceDraft["servantAssignments"] = [];
  const bibleVerses: AnalyzedServiceDraft["bibleVerses"] = [];
  const hymnals: AnalyzedServiceDraft["hymnals"] = [];
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let inDetails = false;
  let serviceDate: string | undefined;
  let ministryName: string | undefined;
  let sermonVerse: string | undefined;

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

    const servantRole = SERVANT_ASSIGNMENT_KEYS[normalizedKey];
    if (servantRole) {
      split.value
        .split(/\s*&\s*/)
        .map((person) => person.trim())
        .filter(Boolean)
        .forEach((person) => {
          servantAssignments.push({
            role: servantRole,
            personName: parsePerson(person, 0).personName,
          });
        });

      if (!inDetails) {
        continue;
      }
    }

    if (inDetails) {
      if (normalizedKey === "tawag ng pagsamba") {
        bibleVerses.push({
          verse: split.value,
          order: bibleVerses.length,
        });
        continue;
      }

      if (normalizedKey === "bible reading") {
        sermonVerse = split.value;
        continue;
      }

      const hymnalRole = HYMNAL_KEYS[normalizedKey];
      if (hymnalRole) {
        hymnals.push({
          role: hymnalRole,
          title: formatHymnalTitle(split.value),
        });
        continue;
      }

      if (normalizedKey === "speaker") {
        continue;
      }

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
    sermonVerse,
    bibleVerses,
    servantAssignments,
    hymnals,
    participants,
    details,
    warnings,
  };
}
