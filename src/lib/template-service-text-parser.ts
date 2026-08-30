import { ProgramBlockDefinitionSchema, type ProgramBlockDefinition } from "./program-block-types.ts";

type TemplateBlock = { id: string; label: string; kind: "PERSON" | "TEXT"; fieldDefinition: unknown };
type DirectoryItem = { id: string; name?: string; title?: string };

type ParseContext = {
  blocks: TemplateBlock[];
  servants: Array<{ id: string; name: string }>;
  songs: Array<{ id: string; title: string }>;
};

export type TemplateTextParseResult = {
  values: Record<string, Record<string, unknown>>;
  matches: Array<{ label: string; value: string }>;
  warnings: string[];
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.:]+$/g, "");
}

function definitionFor(block: TemplateBlock): ProgramBlockDefinition {
  return ProgramBlockDefinitionSchema.safeParse(block.fieldDefinition).data ?? { fields: [] };
}

function findDirectoryId(value: string, items: DirectoryItem[]) {
  const matches = items.filter((item) => normalize(item.name ?? item.title ?? "") === normalize(value));
  return matches.length === 1 ? matches[0].id : null;
}

function parseFieldValue(value: string, field: ProgramBlockDefinition["fields"][number], context: ParseContext, warnings: string[]) {
  if (field.type === "checkbox") {
    if (/^(yes|true|checked|on)$/i.test(value)) return true;
    if (/^(no|false|unchecked|off)$/i.test(value)) return false;
    warnings.push(`${field.label} must be Yes or No.`);
    return undefined;
  }
  if (field.type === "duration") {
    const parsed = Number(value.replace(/\s*(min|mins|minutes?)$/i, ""));
    if (Number.isFinite(parsed)) return parsed;
    warnings.push(`${field.label} must be a number of minutes.`);
    return undefined;
  }
  if (field.type === "single_select") {
    const option = field.options?.find((candidate) => normalize(candidate) === normalize(value));
    if (option) return option;
    warnings.push(`${value} is not an option for ${field.label}.`);
    return undefined;
  }
  if (field.type === "person") {
    const id = findDirectoryId(value, context.servants);
    if (id) return id;
    warnings.push(`Could not uniquely match ${value} to a team member for ${field.label}.`);
    return undefined;
  }
  if (field.type === "song") {
    const id = findDirectoryId(value, context.songs);
    if (id) return id;
    warnings.push(`Could not uniquely match ${value} to a song for ${field.label}.`);
    return undefined;
  }
  return value;
}

export function parseTemplateServiceText(input: string, context: ParseContext): TemplateTextParseResult {
  const values: Record<string, Record<string, unknown>> = {};
  const matches: TemplateTextParseResult["matches"] = [];
  const warnings: string[] = [];
  const blocks = context.blocks.map((block) => ({ ...block, definition: definitionFor(block) }));

  for (const line of input.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
    const parsed = line.match(/^(.+?)(?:\s*(?::|-)\s*)(.+)$/);
    if (!parsed) {
      warnings.push(`Could not parse: ${line}`);
      continue;
    }
    const [, rawKey, rawValue] = parsed;
    const key = normalize(rawKey);
    const value = rawValue.trim();
    const fieldMatch = blocks.flatMap((block) => block.definition.fields.map((field) => ({ block, field }))).filter(({ block, field }) =>
      key === normalize(field.label) || key === normalize(field.key) || key === normalize(`${block.label} > ${field.label}`) || key === normalize(`${block.label} > ${field.key}`),
    );
    const blockMatch = blocks.filter((block) => key === normalize(block.label));
    const target = fieldMatch.length === 1
      ? fieldMatch[0]
      : blockMatch.length === 1 && blockMatch[0].definition.fields.length === 1
        ? { block: blockMatch[0], field: blockMatch[0].definition.fields[0] }
        : null;

    if (target) {
      const parsedValue = parseFieldValue(value, target.field, context, warnings);
      if (parsedValue !== undefined) {
        values[target.block.id] = { ...values[target.block.id], [target.field.key]: parsedValue };
        matches.push({ label: `${target.block.label} · ${target.field.label}`, value });
      }
      continue;
    }

    if (blockMatch.length === 1 && blockMatch[0].definition.fields.length === 0) {
      const block = blockMatch[0];
      if (block.kind === "PERSON") {
        const personIds = value.split(/\s*(?:,|&)\s*/).map((name) => ({ name, id: findDirectoryId(name, context.servants) }));
        const unmatched = personIds.filter((person) => !person.id).map((person) => person.name);
        if (unmatched.length > 0) warnings.push(`Could not uniquely match ${unmatched.join(", ")} to a team member for ${block.label}.`);
        values[block.id] = { personIds: personIds.flatMap((person) => person.id ? [person.id] : []) };
      } else {
        values[block.id] = { text: value };
      }
      matches.push({ label: block.label, value });
      continue;
    }

    warnings.push(`No unique template field matches: ${rawKey}.`);
  }

  return { values, matches, warnings };
}
