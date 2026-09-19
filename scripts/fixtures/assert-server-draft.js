(async () => {
  const results = [];
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms ?? 150));
  const assert = (ok, label) => { if (!ok) throw new Error(label); results.push(label); };
  const button = label => [...document.querySelectorAll("button")].find(el => el.textContent.trim() === label || el.getAttribute("aria-label") === label);
  const state = async () => (await fetch("/api/workspaces/fixture/song-formatter/draft")).json();
  const editor = document.querySelector(".ProseMirror");
  assert(editor.contentEditable === "true", "Resumed server draft is editable");
  editor.focus();
  const range = document.createRange(); const line = editor.querySelector(".song-lyric-line"); range.setStart(line.firstChild, line.textContent.length); range.collapse(true);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); document.dispatchEvent(new Event("selectionchange")); await wait();
  document.execCommand("insertText", false, " saved remotely");
  await wait(1200);
  let value = await state();
  assert(value.draft.content.text.includes("saved remotely"), "Typing persists to the server");
  assert(document.querySelector('[data-save-state="saved"]'), "Green check follows server acknowledgement");
  button("Leave editor").click(); await wait(700); value = await state();
  assert(value.draft.sessionId === null && Date.parse(value.draft.expiresAt) > Date.now() + 3_590_000, "Leaving releases the lease and starts one hour");
  button("Resume editor").click(); await wait(700); value = await state();
  assert(value.draft.sessionId && value.draft.expiresAt === null, "Resuming cancels the expiry countdown");
  assert(document.querySelector(".ProseMirror").textContent.includes("saved remotely"), "Resuming restores the saved document");
  button("Switch workspace").click(); await wait(700);
  assert(!document.querySelector(".ProseMirror").textContent.includes("saved remotely"), "Workspace switch clears the previous content");
  button("Switch workspace").click(); await wait(700);
  assert(document.querySelector(".ProseMirror").textContent.includes("saved remotely"), "Returning to the workspace restores its draft");
  return results;
})()
