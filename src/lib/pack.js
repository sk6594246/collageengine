/**
 * Reflow cells into a non-overlapping grid while KEEPING each cell's current w/h.
 * Used after manual resize so frames do not stack. Does not reset crop.
 */
export function packCells(cells, stageW, stageH, gap = 6, margin = 12) {
  if (!cells?.length) return cells || []
  const maxW = Math.max(40, stageW - margin * 2)
  let x = margin
  let y = margin
  let rowH = 0
  return cells.map((c) => {
    let w = Math.max(40, Math.min(c.w || 40, maxW))
    let h = Math.max(40, c.h || 40)
    if (c.lockAspect && c.aspectRatio > 0) {
      h = Math.max(40, w / c.aspectRatio)
    }
    if (x > margin && x + w > stageW - margin) {
      x = margin
      y += rowH + gap
      rowH = 0
    }
    const placed = { ...c, x, y, w, h }
    x += w + gap
    rowH = Math.max(rowH, h)
    return placed
  })
}
