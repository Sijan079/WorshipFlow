import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SongDocumentEditor from "../../src/features/song-formatter/song-document-editor";
import { useDraftRecovery } from "../../src/features/song-formatter/use-draft-recovery";
import type { SongTagPresetRecord } from "../../src/lib/api-client";

const sample = "[Title]\nLadies Ministry Worship\n\n" + Array.from({ length: 18 }, (_, i) => `[${i % 2 ? "Chorus" : "Verse"}]\nPraise the Lord ${i + 1}\nHis mercy endures forever\nWe worship You today\n`).join("\n");
const tags = ["Title", "Verse", "Chorus", "Bridge", "Ending"].map((token, i) => ({ id: String(i), token, label: token, color: "#7c3aed", isDefault: true })) as SongTagPresetRecord[];

function Fixture() {
  const [text, setText] = useState("");
  const [songTitle, setTitle] = useState("Ladies Ministry Worship");
  const [warningsDismissed, setDismissed] = useState(false);
  const [exported, setExported] = useState(false);
  const [workspace, setWorkspace] = useState(() => new URLSearchParams(location.search).get("workspace") || "fixture-church");
  const draft = { text, songTitle, warningCodes: [], warningsDismissed, directAiReformatUsed: false };
  const recovery = useDraftRecovery({ enabled: true, workspaceSlug: workspace, draft,
    onRestore: saved => { setText(saved.text); setTitle(saved.songTitle); setDismissed(saved.warningsDismissed); },
  });
  return <main className="workspace-content-light" style={{ padding: 16, colorScheme: "light", background: "var(--surface-panel)", minHeight: "100vh" }}>
    <button type="button" className="ui-btn-secondary mb-3 px-4" onClick={() => setText(sample)}>Load sample song</button>
    <button type="button" className="ui-btn-secondary mb-3 ml-2 px-4" onClick={() => setText("[Verse]\nAlpha\nBeta\nGamma\n[Chorus]\nDelta\nEpsilon")}>Load short song</button>
    <button type="button" className="ui-btn-secondary mb-3 ml-2 px-4" onClick={() => setWorkspace(current => current === "fixture-church" ? "other" : "fixture-church")}>Switch workspace</button>
    <SongDocumentEditor text={text} songTitle={songTitle} tags={tags} recoveryStatus={recovery.status} warnings={[
      { code: "possible_chord_line_detected", title: "Check a possible chord line", message: "Review the extracted lyrics before exporting." },
    ]} warningsDismissed={warningsDismissed} onChange={setText} onTitleChange={setTitle} onDismissWarnings={() => setDismissed(true)}
      onClear={() => { recovery.clear(); setText(""); }} onExport={async () => {
        const result = await fetch("/export", { method: "POST", body: JSON.stringify({ text }) });
        setExported(result.ok && (await result.blob()).size > 0);
      }} onReformat={() => setText("[Verse]\nReformatted lyrics")}
      exportPending={false} aiPending={false} aiUsed={false} settingsHref="/settings?tab=tags" />
    <output id="fixture-export">{exported ? "DOCX generated" : ""}</output>
    <pre id="fixture-text" hidden>{text}</pre>
    <output id="fixture-workspace" hidden>{workspace}</output>
  </main>;
}

createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider>);
