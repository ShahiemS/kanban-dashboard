// Insertion index for a pointer over a (possibly multi-row) grid of items.
// Works for single-column lists too — each item is then its own row.
export function gridDropIndex(containerEl, selector, x, y) {
  const els = containerEl.querySelectorAll(selector);
  for (let i = 0; i < els.length; i++) {
    const r = els[i].getBoundingClientRect();
    if (y < r.top) return i;
    if (y <= r.bottom) {
      if (x < r.left + r.width / 2) return i;
      continue;
    }
  }
  return els.length;
}
