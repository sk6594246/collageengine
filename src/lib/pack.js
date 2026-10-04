/**
 * Reflow cells into a non-overlapping row pack while KEEPING each cell's w/h.
 * Allows overflow past stage bottom/right — user can fix canvas size after.
 * Does not reset crop.
 *
 * @param {{ keepExactSize?: boolean }} opts
 *   keepExactSize true → never shrink or re-derive h from aspect (Refresh layout)
 */
export function packCells(cells, stageW, stageH, gap = 6, margin = 12, opts = {}) {
  if (!cells?.length) return cells || []
  const keepExact = !!opts.keepExactSize
  const maxW = Math.max(40, stageW - margin * 2)
  let x = margin
  let y = margin
  let rowH = 0
  return cells.map((c) => {
    let w = Math.max(40, c.w || 40)
    let h = Math.max(40, c.h || 40)
    if (!keepExact) {
      w = Math.min(w, maxW)
      if (c.lockAspect && c.aspectRatio > 0) {
        h = Math.max(40, w / c.aspectRatio)
      }
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

/**
 * Sort cells in reading order: top → bottom, left → right.
 */
export function sortCellsReadingOrder(cells) {
  return [...(cells || [])].sort((a, b) => {
    const dy = (a.y || 0) - (b.y || 0)
    if (Math.abs(dy) > 4) return dy
    return (a.x || 0) - (b.x || 0)
  })
}
