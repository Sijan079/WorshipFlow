import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { requireExplicitWorkspaceRole } from "@/lib/security-context";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function matchesSignature(bytes: Uint8Array, type: string) {
  if (type === "image/png") return bytes.slice(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

export async function POST(request: Request) {
  try {
    const context = await requireExplicitWorkspaceRole("ADMIN");
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !IMAGE_TYPES.has(file.type)) return NextResponse.json({ error: "Upload a PNG, JPEG, or WebP image." }, { status: 400 });
    if (file.size > MAX_LOGO_BYTES) return NextResponse.json({ error: "Workspace image must be 2 MB or smaller." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesSignature(bytes, file.type)) return NextResponse.json({ error: "The uploaded file is not a valid image." }, { status: 400 });
    const logoDataUrl = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;
    const workspace = await prisma.workspace.update({ where: { id: context.workspaceId }, data: { logoDataUrl }, select: { id: true, slug: true, name: true, logoDataUrl: true } });
    return NextResponse.json(workspace);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to upload workspace image") }, { status: 500 });
  }
}
