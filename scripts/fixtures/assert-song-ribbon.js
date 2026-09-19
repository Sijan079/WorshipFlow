(async () => {
  const wait = () => new Promise(resolve => setTimeout(resolve, 180));
  const waitForDialogClose = async () => {
    for (let attempt = 0; attempt < 10 && document.querySelector('[role="dialog"]'); attempt++) await wait();
  };
  const results = [];
  const assert = (condition, label) => { if (!condition) throw new Error(label); results.push(label); };
  const button = label => [...document.querySelectorAll('button')].find(node => node.getAttribute('aria-label') === label || node.textContent.trim() === label);
  button('Load short song').click(); await wait();
  assert(!document.querySelector('#song-document-title'), 'Title is text until Rename is clicked');
  button('Rename document').click(); await wait();
  const input = document.querySelector('#song-document-title');
  assert(input && document.activeElement === input, 'Rename focuses the underlined title');
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setValue.call(input, 'Way Maker'); input.dispatchEvent(new Event('input', { bubbles: true }));
  await wait();
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait();
  assert(!document.querySelector('#song-document-title') && document.querySelector('[data-document-title]').textContent === 'Way Maker', 'Enter commits title and removes underline input');
  button('Rename document').click(); await wait();
  const cancelInput = document.querySelector('#song-document-title');
  setValue.call(cancelInput, 'Discard me'); cancelInput.dispatchEvent(new Event('input', { bubbles: true })); await wait();
  cancelInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait();
  assert(document.querySelector('[data-document-title]').textContent === 'Way Maker', 'Escape cancels title edits');
  assert(document.querySelector('[data-save-state="saved"] svg'), 'Saved draft shows a custom check icon');
  assert(document.querySelector('[role="group"][aria-label="Sections"]') && document.querySelector('[role="group"][aria-label="Groupings"]'), 'Sections and Groupings ribbon groups are visible');
  const sections = document.querySelector('[role="group"][aria-label="Sections"]');
  for (const label of ['Insert section after', 'Split section', 'Merge with previous section', 'Duplicate section', 'Move section up', 'Move section down', 'Delete section', 'Copy section', 'Paste section after']) {
    assert([...sections.querySelectorAll('button')].some(node => node.getAttribute('aria-label') === label && node.querySelector('svg')), `${label} has its own icon`);
  }
  assert(!button('Section actions'), 'Section actions dropdown removed');
  assert(document.querySelector('[aria-label="Document information"] svg'), 'Information control uses a vector icon');
  const openMenu = async () => {
    const trigger = button('More editor options');
    trigger.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerType: 'mouse', bubbles: true, cancelable: true }));
    await wait();
  };
  await openMenu();
  const ai = [...document.querySelectorAll('[role="menuitem"]')].find(node => node.textContent === 'Reformat with AI');
  const probe = document.createElement('span');
  probe.style.cssText = 'display:none;background:var(--ledger-selection-fill);color:var(--text-primary)';
  ai.parentElement.append(probe);
  ai.focus(); await wait();
  assert(getComputedStyle(ai).backgroundColor === getComputedStyle(probe).backgroundColor && getComputedStyle(ai).color === getComputedStyle(probe).color, 'Menu highlight uses pale purple and primary dark text');
  const clear = [...document.querySelectorAll('[role="menuitem"]')].find(node => node.textContent === 'Clear draft');
  probe.style.cssText = 'display:none;background:var(--state-danger);color:var(--action-primary-ink)';
  clear.focus(); await wait();
  assert(getComputedStyle(clear).backgroundColor === getComputedStyle(probe).backgroundColor && getComputedStyle(clear).color === getComputedStyle(probe).color, 'Clear highlight uses red and white text');
  probe.remove();
  clear.click(); await wait();
  assert(document.querySelector('[role="dialog"]') && document.getElementById('fixture-text').textContent.includes('Alpha'), 'Clear opens confirmation without changing draft');
  button('Cancel').click(); await waitForDialogClose();
  assert(!document.querySelector('[role="dialog"]') && document.getElementById('fixture-text').textContent.includes('Alpha'), 'Cancel preserves draft');
  await openMenu();
  [...document.querySelectorAll('[role="menuitem"]')].find(node => node.textContent === 'Clear draft').click(); await wait();
  const dialog = document.querySelector('[role="dialog"]');
  [...dialog.querySelectorAll('button')].find(node => node.textContent === 'Clear draft').click(); await waitForDialogClose();
  assert(!document.querySelector('[role="dialog"]') && !document.getElementById('fixture-text').textContent, 'Confirmed clear removes draft and closes dialog');
  return results;
})()
