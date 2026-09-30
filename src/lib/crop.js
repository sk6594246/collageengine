/** Relative crop helpers — keep the same framed subject when cell size changes.
 *  Display uses cover-fit + scale + pan so the frame never shows empty gaps
 *  (gray bars) when the photo is zoomed/panned.
 */

export function cropFromCell(cell) {
  const w = Math.max(1, cell.w || 1)
  const h = Math.max(1, cell.h || 1)
  const oxRel = cell.oxRel != null ? cell.oxRel : (cell.ox || 0) / w
  const oyRel = cell.oyRel != null ? cell.oyRel : (cell.oy || 0) / h
  const scale = Math.max(1, cell.scale || 1)
  return {
    scale,
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
  const scale = Math.max(1, cell.scale || 1)
  return {
    ...cell,
    scale,
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
  const scale = Math.max(1, mem.scale != null ? mem.scale : (cell.scale || 1))
  return {
    ...cell,
    scale,
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

export function coverSize(cellW, cellH, photoW, photoH) {
  const cw = Math.max(1, cellW)
  const ch = Math.max(1, cellH)
  const pr = Math.max(1, photoW) / Math.max(1, photoH)
  const cr = cw / ch
  if (pr > cr) {
    const h = ch
    const w = h * pr
    return { w, h }
  }
  const w = cw
  const h = w / pr
  return { w, h }
}

export function clampPan(ox, oy, cellW, cellH, coverW, coverH, scale) {
  const sc = Math.max(1, scale || 1)
  const dw = coverW * sc
  const dh = coverH * sc
  const maxX = Math.max(0, (dw - cellW) / 2)
  const maxY = Math.max(0, (dh - cellH) / 2)
  return {
    ox: Math.max(-maxX, Math.min(maxX, ox || 0)),
    oy: Math.max(-maxY, Math.min(maxY, oy || 0)),
  }
}

export function imageStyleForCell(cell, photo) {
  const cellW = Math.max(1, cell.w || 1)
  const cellH = Math.max(1, cell.h || 1)
  const photoW = photo?.w || photo?.img?.naturalWidth || cellW
  const photoH = photo?.h || photo?.img?.naturalHeight || cellH
  const { w: coverW, h: coverH } = coverSize(cellW, cellH, photoW, photoH)
  const scale = Math.max(1, cell.scale || 1)
  const oxRel = cell.oxRel != null ? cell.oxRel : (cell.ox || 0) / cellW
  const oyRel = cell.oyRel != null ? cell.oyRel : (cell.oy || 0) / cellH
  let ox = oxRel * cellW
  let oy = oyRel * cellH
  const clamped = clampPan(ox, oy, cellW, cellH, coverW, coverH, scale)
  ox = clamped.ox
  oy = clamped.oy
  const dw = coverW * scale
  const dh = coverH * scale
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: dw,
    height: dh,
    maxWidth: 'none',
    maxHeight: 'none',
    objectFit: 'fill',
    transform: `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`,
    transformOrigin: 'center center',
    pointerEvents: 'none',
    userSelect: 'none',
  }
}

export function drawPhotoInCell(ctx, photo, cell, scaleFactor = 1) {
  if (!photo?.img) return
  const cellW = cell.w * scaleFactor
  const cellH = cell.h * scaleFactor
  const photoW = photo.w || photo.img.naturalWidth
  const photoH = photo.h || photo.img.naturalHeight
  const { w: coverW, h: coverH } = coverSize(cell.w, cell.h, photoW, photoH)
  const sc = Math.max(1, cell.scale || 1)
  const oxRel = cell.oxRel != null ? cell.oxRel : (cell.ox || 0) / Math.max(1, cell.w)
  const oyRel = cell.oyRel != null ? cell.oyRel : (cell.oy || 0) / Math.max(1, cell.h)
  let ox = oxRel * cell.w
  let oy = oyRel * cell.h
  const clamped = clampPan(ox, oy, cell.w, cell.h, coverW, coverH, sc)
  ox = clamped.ox * scaleFactor
  oy = clamped.oy * scaleFactor
  const dw = coverW * sc * scaleFactor
  const dh = coverH * sc * scaleFactor
  const dx = -cellW / 2 + (cellW - dw) / 2 + ox
  const dy = -cellH / 2 + (cellH - dh) / 2 + oy
  ctx.drawImage(photo.img, dx, dy, dw, dh)
}
