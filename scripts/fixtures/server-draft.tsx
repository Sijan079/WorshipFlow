import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useServerDraft } from "../../src/features/song-formatter/use-server-draft";
import type { DraftContent } from "../../src/features/song-formatter/draft-contract";
import SongDocumentEditor from "../../src/features/song-formatter/song-document-editor";

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Fixture() {
  const [editing, setEditing] = useState(true);
  const [scope, setScope] = useState("fixture");
  const [content, setContent] = useState<DraftContent>({ text: "", songTitle: "", warningCodes: [], warningsDismissed: false, directAiReformatUsed: false });
  const recovery = useServerDraft({ enabled: true, workspaceSlug: scope, editing, draft: content, onRestore: setContent });
  return <main className="workspace-content-light" style={{ padding: 24, background: "var(--surface-panel)", color: "var(--text-primary)", minHeight: "100vh" }}>
    <nav className="flex gap-4 pb-4"><button onClick={() => setEditing(!editing)}>{editing ? "Leave editor" : "Resume editor"}</button><button onClick={() => setScope(scope === "fixture" ? "other" : "fixture")}>Switch workspace</button></nav>
    <p data-recovery-status>{recovery.status}</p>
    {recovery.canTakeOver ? <button onClick={() => void recovery.takeover()}>Take over editing</button> : null}
    {!editing ? <ul>{recovery.history.map(row => <li key={row.id}>{row.songTitle}: {row.status} {row.open ? "Open" : row.expiresAt}</li>)}</ul> :
      <SongDocumentEditor text={content.text} songTitle={content.songTitle} tags={["Verse", "Chorus"].map(token => ({ id: token, label: token, token, color: "", isDefault: true, createdAt: "", updatedAt: "" }))}
        recoveryStatus={recovery.status} readOnly={recovery.readOnly} warnings={[]} warningsDismissed={content.warningsDismissed}
        onChange={text => setContent(current => ({ ...current, text }))} onTitleChange={songTitle => setContent(current => ({ ...current, songTitle }))}
        onDismissWarnings={() => setContent(current => ({ ...current, warningsDismissed: true }))}
        onClear={async () => { if (await recovery.clear()) setEditing(false); }} onExport={() => {}} onReformat={() => {}}
        exportPending={false} aiPending={recovery.busy} aiUsed={false} settingsHref="#" />}
    <output data-fixture-text>{content.text}</output>
  </main>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={client}><Fixture /></QueryClientProvider></StrictMode>);
