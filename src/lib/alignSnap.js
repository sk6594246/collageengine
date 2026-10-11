/**
 * Snap a frame so its borders line up with OTHER frames only
 * (not the canvas edge). Example: if row 1 ends at x=1234, dragging
 * the last frame of row 2 snaps its right edge to 1234.
 *
 * @returns {{ x: number, y: number }}
 */
export function snapFramePosition(x, y, w, h, others, stageW, stageH, threshold = 8) {
  let sx = x
  let sy = y
  const thr = Math.max(1, threshold)
  const xTargets = []
  const yTargets = []

  for (const o of others) {
    if (!o) continue
    const ox = o.x || 0
    const oy = o.y || 0
    const ow = Math.max(1, o.w || 0)
    const oh = Math.max(1, o.h || 0)
    xTargets.push(ox, ox + ow, ox - w, ox + ow - w)
    yTargets.push(oy, oy + oh, oy - h, oy + oh - h)
  }

  if (xTargets.length) {
    let bestDx = thr + 1
    for (const t of xTargets) {
      const d = Math.abs(x - t)
      if (d < bestDx) {
        bestDx = d
        sx = t
      }
    }
    if (bestDx > thr) sx = x
  }
  if (yTargets.length) {
    let bestDy = thr + 1
    for (const t of yTargets) {
      const d = Math.abs(y - t)
      if (d < bestDy) {
        bestDy = d
        sy = t
      }
    }
    if (bestDy > thr) sy = y
  }

  const maxX = Math.max(0, stageW - w)
  const maxY = Math.max(0, stageH - h)
  return {
    x: Math.max(0, Math.min(maxX, sx)),
    y: Math.max(0, Math.min(maxY, sy)),
  }
}

/** Shift every cell by dx/dy (group move). Clamps each frame to stage. */
export function nudgeAllCells(cells, dx, dy, stageW, stageH) {
  if (!cells?.length) return cells
  return cells.map((c) => {
    const maxX = Math.max(0, stageW - (c.w || 0))
    const maxY = Math.max(0, stageH - (c.h || 0))
    return {
      ...c,
      x: Math.max(0, Math.min(maxX, (c.x || 0) + dx)),
      y: Math.max(0, Math.min(maxY, (c.y || 0) + dy)),
    }
  })
}
