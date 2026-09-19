(async () => {
  const wait = () => new Promise(resolve => setTimeout(resolve, 200));
  const text = () => document.getElementById("fixture-text").textContent;
  const switcher = [...document.querySelectorAll("button")].find(button => button.textContent.trim() === "Switch workspace");
  const original = text();
  if (!original) throw new Error("Load a song before running scope-switch checks");
  switcher.click(); await wait();
  if (text()) throw new Error("The previous workspace draft is still shown");
  const otherKey = "worship-flow:song-draft:v1:fixture-user:other";
  if (localStorage.getItem(otherKey)) throw new Error("A draft leaked into another workspace");
  switcher.click(); await wait();
  if (text() !== original) throw new Error("Returning to the original workspace did not restore its draft");
  return "Changing workspace in the mounted editor isolates and restores each draft";
})()
