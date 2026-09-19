export type SelectionScrollMode = "activation" | "minimal";
type RectLike = { top: number; bottom: number; left: number; right: number };

export function selectionScrollDelta(input: {
  caret: RectLike;
  targetTop: number;
  bounds: RectLike;
  topInset: number;
  mode: SelectionScrollMode;
}) {
  const { caret, targetTop, bounds, topInset, mode } = input;
  const edgeInset = 24;
  const usableTop = bounds.top + topInset;
  const usableBottom = bounds.bottom - edgeInset;
  const verticallyVisible = targetTop >= usableTop && caret.bottom <= usableBottom;
  if (mode === "activation") {
    const upperThird = usableTop + (usableBottom - usableTop) / 3;
    return { top: verticallyVisible ? 0 : targetTop - upperThird, left: 0 };
  }
  const top = caret.bottom > usableBottom
    ? caret.bottom - usableBottom
    : targetTop < usableTop ? targetTop - usableTop : 0;
  const left = caret.right > bounds.right - edgeInset
    ? caret.right - bounds.right + edgeInset
    : caret.left < bounds.left + edgeInset ? caret.left - bounds.left - edgeInset : 0;
  return { top, left };
}
