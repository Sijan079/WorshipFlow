// Run after reloading the browser fixture; also supports ?workspace=other.
(() => {
  const params = new URLSearchParams(location.search);
  const workspace = params.get("workspace") || "fixture-church";
  const key = `worship-flow:song-draft:v1:fixture-user:${encodeURIComponent(workspace)}`;
  const saved = JSON.parse(localStorage.getItem(key) || "null");
  const current = document.getElementById("fixture-text").textContent;
  if (workspace === "fixture-church") {
    if (!saved?.text || current !== saved.text) throw new Error("Draft was not restored after reload");
    return "Refresh recovered the complete edited draft";
  }
  if (current || saved) throw new Error("Draft crossed a workspace boundary");
  return "Another workspace cannot recover the original draft";
})()
