import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const PYTHON_CANDIDATES = [
  process.env.WORSHIP_FLOW_PYTHON_PATH,
  "C:\\Users\\Sijan\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe",
  "python",
].filter(Boolean) as string[];

function getPythonCommand() {
  return PYTHON_CANDIDATES[0];
}

const PYTHON_DOCX_SCRIPT = `
import json
import sys
from pathlib import Path
from docx import Document
from docx.shared import Pt

input_path = Path(sys.argv[1])
output_path = Path(sys.argv[2])

with input_path.open("r", encoding="utf-8") as handle:
    payload = json.load(handle)

lines = payload.get("lines") or []

document = Document()
normal_style = document.styles["Normal"]
normal_style.font.name = "Arial"
normal_style.font.size = Pt(11)

for line in lines:
    if not isinstance(line, str):
        continue
    if line == "":
        document.add_paragraph("")
        continue

    paragraph = document.add_paragraph()
    run = paragraph.add_run(line)
    if line.startswith("[") and line.endswith("]"):
        run.bold = True

document.save(str(output_path))
`;

function normalizeTitleBlock(lines: string[]) {
  const output: string[] = [];
  let titleSeen = false;
  let currentTitleValue: string | null = null;
  let insideTitleBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const normalized = line.trim().toLowerCase();

    if (normalized === "[title]") {
      if (titleSeen) {
        insideTitleBlock = true;
        continue;
      }

      titleSeen = true;
      insideTitleBlock = true;
      currentTitleValue = null;
      output.push("[Title]");
      continue;
    }

    if (!insideTitleBlock) {
      output.push(line);
      continue;
    }

    if (!line.trim()) {
      output.push("");
      insideTitleBlock = false;
      continue;
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      output.push(line);
      insideTitleBlock = false;
      continue;
    }

    if (currentTitleValue && normalized === currentTitleValue) {
      continue;
    }

    currentTitleValue = normalized;
    output.push(line);
  }

  return output;
}

export async function createLyricsDocx(text: string) {
  const workDir = await mkdtemp(join(tmpdir(), "worship-flow-docx-"));
  const scriptPath = join(workDir, `${randomUUID()}.py`);
  const inputPath = join(workDir, `${randomUUID()}.json`);
  const outputPath = join(workDir, `${randomUUID()}.docx`);

  try {
    const lines = normalizeTitleBlock(text.split("\n"));
    await writeFile(scriptPath, PYTHON_DOCX_SCRIPT, "utf8");
    await writeFile(
      inputPath,
      JSON.stringify({
        lines,
      }),
      "utf8"
    );

    const { stderr } = await execFileAsync(getPythonCommand(), [scriptPath, inputPath, outputPath], {
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 10,
    });

    if (stderr?.trim()) {
      throw new Error(stderr.trim());
    }

    const bytes = await readFile(outputPath);
    return new Uint8Array(bytes);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
