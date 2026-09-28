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
  const oxRel = mem.oxRel != null ? mem.oxRel : (mem.ox || 0) / Math.max(1, w)
  const oyRel = mem.oyRel != null ? mem.oyRel : (mem.oy || 0) / Math.max(1, h)
  return {
    ...cell,
    scale: mem.scale != null ? mem.scale : (cell.scale || 1),
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
