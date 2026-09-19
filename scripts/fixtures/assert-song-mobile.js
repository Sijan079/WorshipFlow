(async () => {
  const wait = () => new Promise(resolve => setTimeout(resolve, 150));
  const button = label => [...document.querySelectorAll("button")].find(node => node.textContent.trim() === label);
  const doc = document.querySelector(".ProseMirror");
  const region = document.querySelector('[aria-label="Song Editor"]');
  const results = [];
  if (region.dataset.continuous !== "true" || doc.getBoundingClientRect().width > innerWidth) throw new Error("Phone editing must fit the screen");
  results.push("Phone editing fits the screen without page gaps");
  button("Page preview").click(); await wait();
  if (doc.contentEditable !== "false" || region.dataset.continuous !== "false") throw new Error("Preview must be paginated and read-only");
  results.push("Phone page preview is read-only");
  button("Edit lyrics").click(); await wait();
  if (doc.contentEditable !== "true") throw new Error("Cannot return to phone editing");
  results.push("Returning from preview restores editing");
  const setItem = Storage.prototype.setItem;
  try {
    Storage.prototype.setItem = () => { throw new DOMException("Blocked storage", "QuotaExceededError"); };
    doc.focus();
    const line = doc.querySelector(".song-lyric-line");
    const range = document.createRange(); range.selectNodeContents(line); range.collapse(false);
    window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
    document.execCommand("insertText", false, " storage check");
    await wait();
    if (!document.body.textContent.includes("Draft not saved on this device")) throw new Error("Storage failure is not visible");
    if (button("Export DOCX").disabled || doc.contentEditable !== "true") throw new Error("Storage failure prevents editing/export");
    results.push("Storage failure is visible and preserves editing/export");
  } finally { Storage.prototype.setItem = setItem; }
  return results;
})()
