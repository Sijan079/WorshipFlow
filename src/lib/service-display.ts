import {
  BlockType,
  ServiceVariant,
  type BlockType as BlockTypeValue,
  type ServiceVariant as ServiceVariantValue,
} from "./service-constants.ts";

export const STANDARD_BLOCK_ORDER: readonly BlockTypeValue[] = [
  BlockType.CALL_TO_WORSHIP,
  BlockType.PRAISE_AND_WORSHIP,
  BlockType.MC,
  BlockType.AWIT_NG_PAKIKINIG,
  BlockType.SCRIPTURE_READING,
  BlockType.SERMON,
  BlockType.AWIT_NG_PAGTUGON,
  BlockType.OFFERING,
  BlockType.FLOWERS_FOR_THE_LORD,
] as const;

export const EXTENDED_BLOCK_ORDER: readonly BlockTypeValue[] = [
  BlockType.CALL_TO_WORSHIP,
  BlockType.PRAISE_AND_WORSHIP,
  BlockType.MC,
  BlockType.AWIT_NG_HIMNO,
  BlockType.TIPAN_PAHAYAG,
  BlockType.AWIT_NG_PAKIKINIG,
  BlockType.SCRIPTURE_READING,
  BlockType.SERMON,
  BlockType.AWIT_NG_PAGTUGON,
  BlockType.OFFERING,
  BlockType.FLOWERS_FOR_THE_LORD,
] as const;

export const STRICT_BLOCK_ORDER = STANDARD_BLOCK_ORDER;

export function getServiceBlockOrder(serviceVariant?: ServiceVariantValue | null) {
  return serviceVariant === ServiceVariant.EXTENDED ? EXTENDED_BLOCK_ORDER : STANDARD_BLOCK_ORDER;
}

export const BLOCK_LABELS: Record<BlockTypeValue, string> = {
  [BlockType.CALL_TO_WORSHIP]: "Call to Worship",
  [BlockType.PRAISE_AND_WORSHIP]: "Praise & Worship",
  [BlockType.MC]: "Papuri At Pasasalamat",
  [BlockType.AWIT_NG_HIMNO]: "Awit ng Himno",
  [BlockType.TIPAN_PAHAYAG]: "Tipan/Pahayag",
  [BlockType.AWIT_NG_PAKIKINIG]: "Awit ng Pakikinig",
  [BlockType.SCRIPTURE_READING]: "Scripture Reading",
  [BlockType.SERMON]: "Sermon",
  [BlockType.AWIT_NG_PAGTUGON]: "Awit ng Pagtugon",
  [BlockType.OFFERING]: "Offering",
  [BlockType.FLOWERS_FOR_THE_LORD]: "Announcements",
  [BlockType.DETAILS]: "Details",
  [BlockType.CUSTOM]: "Custom program item",
};

export const SONG_BLOCK_TYPES = new Set<BlockTypeValue>([
  BlockType.PRAISE_AND_WORSHIP,
  BlockType.AWIT_NG_HIMNO,
  BlockType.AWIT_NG_PAKIKINIG,
  BlockType.AWIT_NG_PAGTUGON,
]);

export function selectCurrentService<T extends { serviceDate: string }>(services: readonly T[], now: number) {
  const ordered = [...services].sort(
    (left, right) => new Date(left.serviceDate).getTime() - new Date(right.serviceDate).getTime(),
  );

  return ordered.find((service) => new Date(service.serviceDate).getTime() >= now) ?? ordered.at(-1);
}

function localDateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function selectServiceForUpcomingSunday<T extends { serviceDate: string }>(services: readonly T[], now: Date = new Date()) {
  const upcomingSunday = new Date(now);
  upcomingSunday.setHours(0, 0, 0, 0);
  upcomingSunday.setDate(upcomingSunday.getDate() + ((7 - upcomingSunday.getDay()) % 7));
  const targetDate = localDateKey(upcomingSunday);

  return services.find((service) => localDateKey(new Date(service.serviceDate)) === targetDate);
}

type ServiceBlockDisplaySource = {
  fieldValues: unknown;
  people?: readonly { personName: string }[];
  songs?: readonly { song: { title: string } }[];
  details?: readonly { value: string }[];
};

function getTextFieldValues(fieldValues: unknown) {
  if (!fieldValues || typeof fieldValues !== "object" || Array.isArray(fieldValues)) return [];

  return Object.entries(fieldValues as Record<string, unknown>).flatMap(([key, value]) => {
    if (/ids?$/i.test(key)) return [];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [String(value)];
    if (Array.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number")) {
      return value.map(String);
    }
    return [];
  });
}

export function getServiceBlockDisplayValues(block: ServiceBlockDisplaySource) {
  return [...new Set([
    ...(block.songs ?? []).map(({ song }) => song.title),
    ...(block.people ?? []).map(({ personName }) => personName),
    ...(block.details ?? []).map(({ value }) => value),
    ...getTextFieldValues(block.fieldValues),
  ].map((value) => value.trim()).filter(Boolean))];
}
