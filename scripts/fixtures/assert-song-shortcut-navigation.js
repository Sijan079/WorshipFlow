(async () => {
  const results = [];
  const wait = (delay = 180) => new Promise(resolve => setTimeout(resolve, delay));
  const assert = (ok, label) => { if (!ok) throw new Error(label); results.push(label); };
  const button = label => [...document.querySelectorAll("button")].find(el => el.getAttribute("aria-label") === label || el.textContent.trim() === label);
  const key = async (target, value, modifiers = {}) => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...modifiers }));
    await wait();
  };

  button("Load sample song").click();
  await wait();
  const viewer = document.querySelector("[data-song-viewport]");
  viewer.scrollTop = 0;
  viewer.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  await key(document.body, "k", { ctrlKey: true });
  await wait(900);

  const target = document.querySelector('[data-shortcut-target]');
  const overlay = document.querySelector('[data-shortcut-overlay]');
  const targetRect = target.getBoundingClientRect();
  const viewerRect = viewer.getBoundingClientRect();
  assert(document.querySelector('[data-shortcut-mode="true"]'), "Fresh document enters shortcut mode");
  assert(target.textContent.trim().length > 0, "Fresh fallback skips trailing blank lines");
  assert(viewer.scrollTop > 0, "Fresh activation scrolls toward the fallback lyric");
  assert(targetRect.top >= overlay.getBoundingClientRect().bottom, "Fresh fallback is visible below the shortcut overlay");
  assert(targetRect.top < viewerRect.top + viewerRect.height * 0.6, "Fresh fallback settles in the upper portion of the viewer");
  return results;
})()
