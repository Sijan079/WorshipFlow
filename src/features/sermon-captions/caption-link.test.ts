import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isConfigurableModuleAction, CONFIGURABLE_MODULE_ACTIONS } from "../../lib/module-access.ts";
import { isPublicPathForProxy } from "../../lib/proxy-paths.ts";
import { CAPTION_TAKEOVER_STALE_MS, isTakeoverStale, selectViewerSession, sessionAvailability } from "./caption-contract.ts";
import { canRegenerateCaptionLink, canShareCaptionLink, dataUrlToBytes, isViewerToken, viewerLinkUrl, viewerPollMs } from "./caption-link.ts";

function read(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

function feature(name: string) {
  return read("src", "features", "sermon-captions", name);
}

export function runCaptionLinkTests() {
  // The stable link is a random 32-character token, never a session id.
  assert.equal(isViewerToken("a".repeat(32)), true);
  assert.equal(isViewerToken("Ab3_-".repeat(6) + "Zz"), true);
  assert.equal(isViewerToken("a".repeat(31)), false);
  assert.equal(isViewerToken("a".repeat(33)), false);
  assert.equal(isViewerToken("a".repeat(31) + "!"), false);
  assert.equal(isViewerToken("187275bd-e16e-4bf7-9405-abd7f93173b5"), false);
  assert.equal(isViewerToken(""), false);
  assert.equal(viewerLinkUrl("https://church.example", "T".repeat(32)), `https://church.example/captions/live/${"T".repeat(32)}`);

  // Sharing needs the SHARE grant and the right to view captions; regenerating is admin only.
  assert.equal(canShareCaptionLink("OWNER", { VIEW: false, SHARE: false }), true);
  assert.equal(canShareCaptionLink("ADMIN", { VIEW: false, SHARE: false }), true);
  assert.equal(canShareCaptionLink("MEMBER", { VIEW: true, SHARE: true }), true);
  assert.equal(canShareCaptionLink("MEMBER", { VIEW: true, SHARE: false }), false);
  assert.equal(canShareCaptionLink("MEMBER", { VIEW: false, SHARE: true }), false);
  assert.equal(canShareCaptionLink("VIEWER", { VIEW: true, SHARE: true }), false);
  assert.equal(canRegenerateCaptionLink("OWNER"), true);
  assert.equal(canRegenerateCaptionLink("ADMIN"), true);
  assert.equal(canRegenerateCaptionLink("MEMBER"), false);

  // Permission list: SHARE is grantable in Settings -> Membership with a plain label.
  assert.equal(isConfigurableModuleAction("CAPTIONS", "SHARE"), true);
  const captions = CONFIGURABLE_MODULE_ACTIONS.find((entry) => entry.module === "CAPTIONS");
  assert.ok(captions?.actions.some((item) => item.action === "SHARE" && item.label === "Share captions link"));
  assert.equal(isConfigurableModuleAction("CAPTIONS", "REGENERATE"), false);
  assert.match(read("src", "app", "api", "workspaces", "[workspaceSlug]", "members", "permissions", "route.ts"), /"PUBLISH", "SHARE"/);

  // A session whose heartbeat has been silent for two minutes may be taken over; a busy one may not.
  const now = new Date("2026-10-27T10:00:00Z");
  assert.equal(CAPTION_TAKEOVER_STALE_MS, 120_000);
  assert.equal(isTakeoverStale(new Date(now.getTime() - 119_999), now), false);
  assert.equal(isTakeoverStale(new Date(now.getTime() - 120_000), now), true);
  assert.equal(isTakeoverStale(new Date(now.getTime() - 10_000), now), false);

  // What a listener can see: the live session, else the latest ended one inside its one-hour hold.
  const minutes = (value: number) => new Date(now.getTime() + value * 60_000);
  assert.deepEqual(sessionAvailability({ status: "LIVE", expiresAt: minutes(30) }, now), { kind: "live" });
  assert.deepEqual(sessionAvailability({ status: "LIVE", expiresAt: minutes(-10) }, now), { kind: "retained", until: minutes(50) });
  assert.deepEqual(sessionAvailability({ status: "LIVE", expiresAt: minutes(-61) }, now), { kind: "gone" });
  assert.deepEqual(sessionAvailability({ status: "ENDED", expiresAt: minutes(20) }, now), { kind: "retained", until: minutes(20) });
  assert.deepEqual(sessionAvailability({ status: "ENDED", expiresAt: minutes(-1) }, now), { kind: "gone" });
  const ended = { id: "ended", status: "ENDED", expiresAt: minutes(20), createdAt: minutes(-90) };
  const newerEnded = { id: "newer", status: "ENDED", expiresAt: minutes(40), createdAt: minutes(-30) };
  const live = { id: "live", status: "LIVE", expiresAt: minutes(120), createdAt: minutes(-5) };
  const gone = { id: "gone", status: "ENDED", expiresAt: minutes(-5), createdAt: minutes(-300) };
  assert.equal(selectViewerSession([ended, newerEnded, live], now)?.session.id, "live");
  assert.equal(selectViewerSession([ended, newerEnded], now)?.session.id, "newer");
  assert.equal(selectViewerSession([gone], now), null);
  assert.equal(selectViewerSession([], now), null);

  // The viewer checks quickly while captions flow and slowly while waiting, so people come back by themselves.
  assert.equal(viewerPollMs(undefined), 2000);
  assert.equal(viewerPollMs("live"), 2000);
  assert.equal(viewerPollMs("connecting"), 2000);
  assert.equal(viewerPollMs("interrupted"), 2000);
  assert.equal(viewerPollMs("error"), 2000);
  assert.equal(viewerPollMs("waiting"), 15000);
  assert.equal(viewerPollMs("ended"), 15000);

  // Schema and migration: one settings row per church, an additive SHARE action, row-level security.
  const schema = read("prisma", "schema.prisma");
  assert.match(schema, /enum WorkspaceAction \{[\s\S]*?\bSHARE\b[\s\S]*?\}/);
  assert.match(schema, /^model CaptionSettings \{[\s\S]*?workspaceId\s+String\s+@unique[\s\S]*?viewerToken\s+String\s+@unique[\s\S]*?rotatedAt[\s\S]*?^\}/m);
  const migrations = join(process.cwd(), "prisma", "migrations-current");
  const folder = readdirSync(migrations).find((name) => name.endsWith("_caption_share_link"));
  assert.ok(folder, "Expected a *_caption_share_link migration");
  const sql = read("prisma", "migrations-current", folder, "migration.sql");
  assert.match(sql, /ALTER TYPE "WorkspaceAction" ADD VALUE IF NOT EXISTS 'SHARE'/);
  assert.match(sql, /CREATE TABLE "CaptionSettings"/);
  assert.match(sql, /CREATE UNIQUE INDEX "CaptionSettings_viewerToken_key"/);
  assert.match(sql, /ALTER TABLE "CaptionSettings" ENABLE ROW LEVEL SECURITY/);

  // Token generation is random and server-only.
  const server = feature("caption-server.ts");
  assert.match(server, /export function newViewerToken\(\)/);
  assert.match(server, /randomBytes\(24\)\.toString\("base64url"\)/);

  // Share data: VIEW and SHARE are both checked on the server, and the link row is created on first use.
  const linkRoute = read("src", "app", "api", "caption-link", "route.ts");
  assert.match(linkRoute, /requireCaptionAction\("VIEW"\)/);
  assert.match(linkRoute, /canShareCaptionLink\(/);
  assert.match(linkRoute, /captionSettings\.upsert/);
  assert.match(linkRoute, /Cache-Control": "no-store/);
  assert.doesNotMatch(linkRoute, /export (const|function) (?!GET\b)[A-Za-z]+/);

  // Regenerate: Owner and Admin only, never while captions run, and a new random token each time.
  const regenerate = read("src", "app", "api", "caption-link", "regenerate", "route.ts");
  assert.match(regenerate, /requireExplicitWorkspaceRole\("ADMIN"\)/);
  assert.match(regenerate, /canRegenerateCaptionLink\(/);
  assert.match(regenerate, /status: "LIVE"/);
  assert.match(regenerate, /409/);
  assert.match(regenerate, /newViewerToken\(\)/);
  assert.match(regenerate, /rotatedAt: new Date\(\)/);
  assert.match(regenerate, /export async function POST/);
  assert.doesNotMatch(regenerate, /export async function (GET|PUT|PATCH|DELETE)/);

  // The operator's session check reports what this person may do with the link.
  const sessions = read("src", "app", "api", "caption-sessions", "route.ts");
  assert.match(sessions, /canShare/);
  assert.match(sessions, /canRegenerate/);
  assert.match(sessions, /isTakeoverStale\(/);

  // Public viewer: found by token, caption text only, the old session-id route is gone.
  const publicDir = join(process.cwd(), "src", "app");
  assert.equal(existsSync(join(publicDir, "api", "captions", "live", "[id]")), false);
  assert.equal(existsSync(join(publicDir, "captions", "live", "[id]")), false);
  const feed = read("src", "app", "api", "captions", "live", "[token]", "route.ts");
  assert.match(feed, /isViewerToken\(/);
  assert.match(feed, /captionSettings\.findUnique\(\{ where: \{ viewerToken/);
  assert.match(feed, /selectViewerSession\(/);
  assert.match(feed, /status: "waiting"/);
  assert.match(feed, /workspaceName|workspace: \{ select: \{ name: true/);
  assert.doesNotMatch(feed, /prisma\.(person|ministry|churchEvent|worshipService|user)\b/);
  assert.match(feed, /feedCacheControl\(/);
  const page = read("src", "app", "captions", "live", "[token]", "page.tsx");
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /<CaptionViewer token=\{token\}/);
  assert.equal(isPublicPathForProxy("/captions/live/" + "a".repeat(32)), true);
  assert.equal(isPublicPathForProxy("/api/captions/live/" + "a".repeat(32)), true);
  assert.equal(isPublicPathForProxy("/api/caption-link"), false);

  // Viewer behavior: keeps checking after an ended session so people return on their own,
  // pauses when hidden, refreshes when visible again, and every line stays readable.
  const viewer = feature("caption-viewer.tsx");
  assert.match(viewer, /viewerPollMs\(/);
  assert.match(viewer, /visibilitychange/);
  assert.match(viewer, /Captions will start when the service begins/);
  assert.doesNotMatch(viewer, /window\.clearInterval\(timer\)/);
  assert.doesNotMatch(viewer, /opacity-(30|50)/);

  // Operator page: Share icon beside Options, a dialog with the QR code, no per-session link block.
  assert.equal(existsSync(join(process.cwd(), "src", "features", "sermon-captions", "viewer-link.tsx")), false);
  const shareButton = feature("share-button.tsx");
  assert.match(shareButton, /aria-label="Share captions link"/);
  assert.match(shareButton, /title="Share captions link"/);
  assert.match(shareButton, /min-h-11 min-w-11/);
  assert.match(shareButton, /bg-transparent/);
  assert.match(shareButton, /border-0/);
  const shareDialog = feature("share-dialog.tsx");
  assert.match(shareDialog, /toDataURL\(/);
  assert.match(shareDialog, /Regenerate link/);

  // The link itself is not shown: pressing copy puts it on the clipboard. Copy and download are quiet
  // icon-only controls (no fill, no border). The copy icon opens a small menu with two choices.
  assert.doesNotMatch(shareDialog, /\{link\.url\}|break-all/);
  for (const icon of ["Copy", "Download", "Link2", "QrCode"]) {
    assert.match(shareDialog, new RegExp(`import \\{[^}]*\\b${icon}\\b[^}]*\\} from "lucide-react"`));
  }
  assert.match(shareDialog, /<DropdownMenu>/);
  assert.match(shareDialog, /aria-label="Copy link or QR code"/);
  assert.match(shareDialog, /title="Copy link or QR code"/);
  assert.match(shareDialog, /aria-label="Download QR"/);
  assert.match(shareDialog, /title="Download QR"/);
  assert.match(shareDialog, /Copy Link<\/DropdownMenuItem>|Copy Link\s*<\/DropdownMenuItem>/);
  assert.match(shareDialog, /Copy QR\s*<\/DropdownMenuItem>/);
  assert.match(shareDialog, /onSelect=\{onCopyLink\}/);
  assert.match(shareDialog, /onSelect=\{\(\) => onCopyQr\(qr\)\}/);
  assert.match(shareDialog, /ui-action-menu-content/);
  assert.match(shareDialog, /z-\[70\]/);
  const iconStart = shareDialog.indexOf("const ICON_BUTTON");
  const iconClasses = shareDialog.slice(iconStart, shareDialog.indexOf(";", iconStart));
  assert.match(iconClasses, /border-0 bg-transparent/);
  assert.match(iconClasses, /min-h-11 min-w-11/);
  assert.doesNotMatch(iconClasses, /ui-btn-secondary/);
  assert.doesNotMatch(shareDialog, />Copy link<|>Download QR</);
  assert.match(shareDialog, /Anyone with the old link or a printed QR code will stop getting captions/);
  assert.match(shareDialog, /Stop captions before regenerating the link/);

  // Regenerate sits on the right with an icon at its start. Its confirmation opens and closes
  // smoothly (the shared collapsible animation) instead of swapping in, and the yes button says so
  // plainly.
  assert.match(shareDialog, /import \{[^}]*\bRefreshCw\b[^}]*\} from "lucide-react"/);
  assert.match(shareDialog, /import \{ Collapsible \} from "radix-ui"/);
  assert.match(shareDialog, /<Collapsible\.Root open=\{confirming\}/);
  assert.match(shareDialog, /<Collapsible\.Content className="ui-collapsible-content"/);
  assert.match(shareDialog, /flex justify-end[^"]*">\s*<button/);
  assert.match(shareDialog, /<RefreshCw className="h-4 w-4" \/>\}?\s*Regenerate link/);
  // While the decision is being made the main button is hidden, and focus moves to the safe choice.
  assert.match(shareDialog, /\{confirming \? null : \(\s*<div className="flex justify-end">/);
  assert.doesNotMatch(shareDialog, /aria-expanded/);
  assert.match(shareDialog, /autoFocus/);
  assert.match(shareDialog, /Yes, I am sure/);
  // Only Regenerate moves to the right. The copy and download icons stay centred under the QR code.
  assert.match(shareDialog, /flex items-center justify-center gap-2">\s*<DropdownMenu>/);
  assert.doesNotMatch(shareDialog, /justify-end gap-2/);
  assert.match(shareDialog, /Cancel/);
  assert.doesNotMatch(shareDialog, /confirming \? \(/);
  assert.match(shareDialog, /ui-modal-close/);
  assert.match(shareDialog, /aria-label="Close"/);
  assert.doesNotMatch(shareDialog, /apiFetch|fetch\(|sessionStorage/);
  const pageClient = feature("sermon-captions-page.tsx");
  assert.match(pageClient, /<ShareButton/);
  assert.match(pageClient, /\{shareOpen \? \(\s*<ShareDialog/);
  assert.match(pageClient, /engine\.canShare/);
  assert.doesNotMatch(pageClient, /ViewerLink|viewerUrl/);
  assert.doesNotMatch(feature("use-caption-session.ts"), /viewerUrl|viewerUrlFor|copyViewerLink/);
  assert.match(feature("use-caption-link.ts"), /fetchCaptionLink\(/);
  // Copying the QR code puts the image on the clipboard, and failing says how to get it another way.
  const linkHook = feature("use-caption-link.ts");
  assert.match(linkHook, /async function copyQr\(/);
  // The site's Content Security Policy does not allow connect-src data:, so a data URL must never be
  // fetched. It is decoded in place instead.
  assert.doesNotMatch(linkHook, /fetch\(/);
  assert.match(linkHook, /dataUrlToBytes\(qr\)/);
  assert.doesNotMatch(readFileSync(join(process.cwd(), "next.config.ts"), "utf8"), /connect-src[^\n]*\bdata:/);
  assert.deepEqual(dataUrlToBytes("data:image/png;base64,iVBORw0KGgo="), { type: "image/png", bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) });
  assert.throws(() => dataUrlToBytes("https://example.com/qr.png"));
  assert.throws(() => dataUrlToBytes("data:image/png;base64,"));
  assert.match(linkHook, /new ClipboardItem\(\{ "image\/png": /);
  assert.match(linkHook, /QR code copied\./);
  assert.match(linkHook, /Could not copy the QR code\. Use Download QR instead\./);
  assert.match(linkHook, /Link copied\./);
  assert.match(feature("sermon-captions-page.tsx"), /onCopyLink=\{\(\) => void captionLink\.copyLink\(\)\}/);
  assert.match(feature("sermon-captions-page.tsx"), /onCopyQr=\{\(qr\) => void captionLink\.copyQr\(qr\)\}/);
  assert.match(feature("caption-session-api.ts"), /export function (fetchCaptionLink|regenerateCaptionLink)/);
}
