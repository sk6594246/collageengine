/** Relative crop helpers — keep the same framed subject when cell size changes */

export function cropFromCell(cell) {
  const w = Math.max(1, cell.w || 1)
  const h = Math.max(1, cell.h || 1)
  const oxRel = cell.oxRel != null ? cell.oxRel : (cell.ox || 0) / w
  const oyRel = cell.oyRel != null ? cell.oyRel : (cell.oy || 0) / h
  return {
    scale: cell.scale || 1,
    oxRel,
    oyRel,
    ox: oxRel * w,
    oy: oyRel * h,
  }
}

/** After w/h change: re-apply relative offsets so the crop view stays put */
export function preserveCropOnResize(cell, oldW, oldH) {
  const w = Math.max(1, cell.w || 1)
  const h = Math.max(1, cell.h || 1)
  let oxRel = cell.oxRel
  let oyRel = cell.oyRel
  if (oxRel == null || oyRel == null) {
    oxRel = (cell.ox || 0) / Math.max(1, oldW || w)
    oyRel = (cell.oy || 0) / Math.max(1, oldH || h)
  }
  return {
    ...cell,
    oxRel,
    oyRel,
    ox: oxRel * w,
    oy: oyRel * h,
  }
}

export function applyCropMemory(cell, mem) {
  if (!mem) return cell
  const w = Math.max(1, cell.w || 1)
  const h = Math.max(1, cell.h || 1)
  const oxRel = mem.oxRel != null ? mem.oxRel : (mem.ox || 0) / w
  const oyRel = mem.oyRel != null ? mem.oyRel : (mem.oy || 0) / h
  return {
    ...cell,
    scale: mem.scale != null ? mem.scale : cell.scale || 1,
    oxRel,
    oyRel,
    ox: oxRel * w,
    oy: oyRel * h,
  }
}

export function saveCropToMemory(cell, cropMemory) {
  if (!cell?.photoId || !cropMemory) return cell
  const entry = cropFromCell(cell)
  cropMemory.current.set(cell.photoId, entry)
  return { ...cell, ...entry }
}

/** Scale all cells around stage centre; keep relative crop (frame↔photo) */
export function scaleCellsOnStage(cells, stageW, stageH, factor) {
  const f = Math.max(0.4, Math.min(1, factor))
  const cx = stageW / 2
  const cy = stageH / 2
  return cells.map((c) => {
    const oldW = c.w
    const oldH = c.h
    const midX = c.x + c.w / 2
    const midY = c.y + c.h / 2
    const nw = Math.max(36, c.w * f)
    const nh = Math.max(36, c.h * f)
    const newMidX = cx + (midX - cx) * f
    const newMidY = cy + (midY - cy) * f
    const next = {
      ...c,
      w: nw,
      h: nh,
      x: Math.max(0, Math.min(stageW - nw, newMidX - nw / 2)),
      y: Math.max(0, Math.min(stageH - nh, newMidY - nh / 2)),
    }
    return preserveCropOnResize(next, oldW, oldH)
  })
}
