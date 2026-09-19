const sequences = { insert: "I", split: "S", merge: "M", duplicate: "D", up: "↑", down: "↓", delete: "X", tags: "T", copy: "C", paste: "V" } as const;
export type ShortcutAction = keyof typeof sequences;
export type ShortcutModifiers = { primary?: boolean; alt?: boolean; shift?: boolean; repeat?: boolean };
export type ShortcutKeyResult = { active: boolean; handled: boolean; action?: ShortcutAction };
export function shortcutAction(key: string, modifiers: ShortcutModifiers = {}): ShortcutAction | undefined {
  const arrow = key === "ArrowUp" || key === "ArrowDown";
  if (arrow && (!modifiers.alt || modifiers.primary || modifiers.shift)) return undefined;
  if (!arrow && (modifiers.primary || modifiers.alt)) return undefined;
  const normalized = key === "ArrowUp" ? "↑" : key === "ArrowDown" ? "↓" : key.toUpperCase();
  return (Object.keys(sequences) as ShortcutAction[]).find(action => sequences[action] === normalized);
}
export function shortcutKey(active: boolean, key: string, modifiers: ShortcutModifiers = {}): ShortcutKeyResult {
  const toggle = modifiers.primary && !modifiers.alt && !modifiers.shift && key.toLowerCase() === "k";
  if (toggle) return { active: modifiers.repeat ? active : !active, handled: true };
  if (!active) return { active: false, handled: false };
  if (key === "Escape") return { active: false, handled: true };
  if (["Control", "Meta", "Shift", "Alt"].includes(key) || modifiers.primary) {
    return { active: true, handled: false };
  }
  const arrow = key === "ArrowUp" || key === "ArrowDown";
  if (arrow && (!modifiers.alt || modifiers.shift)) return { active: true, handled: false };
  if (arrow && modifiers.repeat) return { active: true, handled: true };
  if (modifiers.alt && !arrow) return { active: true, handled: false };
  const action = shortcutAction(key, modifiers);
  return action ? { active: true, handled: true, action } : { active: true, handled: true };
}
export function shortcutLabel(action: ShortcutAction, mac: boolean) {
  const key = action === "up" || action === "down"
    ? `${mac ? "⌥" : "Alt+"}${sequences[action]}`
    : sequences[action];
  return `${mac ? "⌘K" : "Ctrl+K"}, ${key}`;
}
