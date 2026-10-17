type CopiedComment = { name: string; comment: string };

const TIMESTAMP = /^(?:just now|today|yesterday|\d+\s*(?:s|m|h|d|w|mo|y|secs?|minutes?|hours?|days?|weeks?|months?|years?))$/i;
const ACTION = /^(?:Like|Reply|Share)$/i;

export function parseCopiedComment(text: string): CopiedComment | null {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim());
  while (lines[0] === "") lines.shift();
  while (lines.at(-1) === "") lines.pop();

  if (lines.length === 1) {
    const match = lines[0].match(/^([^:]{2,80}):\s+(.+)$/);
    if (!match) return null;
    lines.splice(0, 1, match[1], match[2]);
  }

  const name = lines.shift();
  if (!name || name.length > 120 || /^https?:\/\//i.test(name)) return null;
  while (lines.length > 1 && TIMESTAMP.test(lines[0])) lines.shift();

  if (/^Like\s*[·|]\s*Reply$/i.test(lines.at(-1) ?? "")) lines.pop();
  else if (lines.length >= 3 && ACTION.test(lines.at(-1) ?? "") && ACTION.test(lines.at(-2) ?? "")) {
    while (ACTION.test(lines.at(-1) ?? "")) lines.pop();
  }
  while (lines.at(-1) === "") lines.pop();

  const comment = lines.join("\n").trim();
  if (!comment || comment.length > 10_000) return null;
  return { name, comment };
}
