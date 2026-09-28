/** Layout helpers for Family Frame — density-aware so more photos fit same canvas */
import { uid } from './storage'

export function qualityLabel(pixels) {
  if (pixels >= 2_000_000) return 'HIGH'
  if (pixels >= 600_000) return 'MED'
  return 'LOW'
}

export function getAspectRatio(aspect, customW, customH) {
  if (aspect === 'custom') return Math.max(1, customW) / Math.max(1, customH)
  const map = {
    '1:1': 1, '4:5': 4 / 5, '3:2': 3 / 2, '16:9': 16 / 9,
    A4P: 210 / 297, A4L: 297 / 210, '5:7': 5 / 7,
  }
  return map[aspect] || 1
}

function orderedPhotos(photos, smartSize) {
  if (!smartSize) return photos.slice()
  return photos.slice().sort((a, b) => b.pixels - a.pixels)
}

function baseCell(p, x, y, w, h, extra = {}) {
  return {
    id: uid(),
    photoId: p.id,
    x, y, w, h,
    scale: 1, ox: 0, oy: 0, oxRel: 0, oyRel: 0,
    rotate: 0,
    lockAspect: false,
    caption: p.caption || '',
    showCaption: !!p.showCaption,
    captionFont: p.captionFont || 'sans',
    captionSize: p.captionSize || 'md',
    captionBg: p.captionBg || 'gradient',
    ...extra,
  }
}

function layoutGrid(photos, iw, ih, margin, gap, smartSize) {
  const n = photos.length
  if (!n) return []
  const ordered = orderedPhotos(photos, smartSize)
  const cols = Math.ceil(Math.sqrt(n * (iw / ih)))
  const rows = Math.ceil(n / cols)
  const cellW = (iw - gap * (cols - 1)) / cols
  const cellH = (ih - gap * (rows - 1)) / rows
  return ordered.map((p, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return baseCell(p, margin + col * (cellW + gap), margin + row * (cellH + gap), cellW, cellH)
  })
}

function layoutCollage(photos, iw, ih, margin, gap, smartSize) {
  const n = photos.length
  if (!n) return []
  const ordered = orderedPhotos(photos, smartSize)
  const stageRatio = iw / ih
  let cols = Math.round(Math.sqrt(n * stageRatio))
  cols = Math.max(2, Math.min(6, cols))
  if (n <= 4) cols = Math.min(cols, 2)
  if (n <= 6) cols = Math.min(cols, 3)
  const colW = (iw - gap * (cols - 1)) / cols
  const colBottoms = new Array(cols).fill(0)
  const result = []
  ordered.forEach((p, idx) => {
    const span = (smartSize && p.pixels > 2e6 && idx < n * 0.35) ? Math.min(2, cols) : 1
    let bestCol = 0
    let bestY = Infinity
    for (let c = 0; c <= cols - span; c++) {
      let y = 0
      for (let k = 0; k < span; k++) y = Math.max(y, colBottoms[c + k])
      if (y < bestY) { bestY = y; bestCol = c }
    }
    const photoRatio = p.w / Math.max(1, p.h)
    let cellH = (colW * span + gap * (span - 1)) / Math.max(0.6, Math.min(1.8, photoRatio))
    if (smartSize && p.pixels > 2.5e6) cellH *= 1.15
    cellH = Math.max(60, Math.min(ih * 0.55, cellH))
    if (bestY + cellH > ih) cellH = Math.max(50, ih - bestY)
    const cellW = colW * span + gap * (span - 1)
    result.push(baseCell(p, margin + bestCol * (colW + gap), margin + bestY, cellW, cellH))
    for (let k = 0; k < span; k++) colBottoms[bestCol + k] = bestY + cellH + gap
  })
  return result
}

function layoutMasonry(photos, iw, ih, margin, gap, smartSize) {
  const n = photos.length
  if (!n) return []
  const ordered = orderedPhotos(photos, smartSize)
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(n))))
  const colW = (iw - gap * (cols - 1)) / cols
  const colH = new Array(cols).fill(0)
  return ordered.map((p) => {
    let shortest = 0
    for (let c = 1; c < cols; c++) if (colH[c] < colH[shortest]) shortest = c
    const photoRatio = p.w / Math.max(1, p.h)
    const baseH = colW / photoRatio
    const scale = smartSize ? Math.min(1.6, Math.max(0.6, Math.sqrt(p.pixels / 1e6))) : 1
    const ch = Math.min(ih * 0.55, Math.max(50, baseH * scale))
    const cell = baseCell(p, margin + shortest * (colW + gap), margin + colH[shortest], colW, ch)
    colH[shortest] += ch + gap
    return cell
  })
}

function layoutMosaic(photos, iw, ih, margin, gap, smartSize) {
  const n = photos.length
  if (!n) return []
  const ordered = orderedPhotos(photos, smartSize)
  const totalPixels = ordered.reduce((s, p) => s + p.pixels, 0) || 1
  let free = [{ x: margin, y: margin, w: iw, h: ih }]
  const result = []
  const minSide = 48
  ordered.forEach((p, idx) => {
    const share = smartSize ? p.pixels / totalPixels : 1 / n
    const targetArea = iw * ih * Math.max(0.06, Math.min(0.38, share * 1.6))
    free.sort((a, b) => b.w * b.h - a.w * a.h)
    let best = null, bestIdx = -1
    for (let i = 0; i < free.length; i++) {
      if (free[i].w >= minSide && free[i].h >= minSide) { best = free[i]; bestIdx = i; break }
    }
    if (!best) return
    const photoRatio = p.w / Math.max(1, p.h)
    let cw, ch
    if (photoRatio >= 1) {
      cw = Math.min(best.w, Math.max(minSide, Math.sqrt(targetArea * photoRatio)))
      ch = Math.min(best.h, Math.max(minSide, cw / photoRatio))
    } else {
      ch = Math.min(best.h, Math.max(minSide, Math.sqrt(targetArea / photoRatio)))
      cw = Math.min(best.w, Math.max(minSide, ch * photoRatio))
    }
    const jitter = 0.92 + (idx % 5) * 0.03
    cw = Math.min(best.w, Math.max(minSide, cw * jitter))
    ch = Math.min(best.h, Math.max(minSide, ch * jitter))
    result.push(baseCell(p, best.x, best.y, cw, ch))
    free.splice(bestIdx, 1)
    const rightW = best.w - cw - gap
    const bottomH = best.h - ch - gap
    if (rightW >= minSide) free.push({ x: best.x + cw + gap, y: best.y, w: rightW, h: best.h })
    if (bottomH >= minSide) free.push({ x: best.x, y: best.y + ch + gap, w: Math.min(cw, best.w), h: bottomH })
  })
  return result
}

function layoutPolaroid(photos, iw, ih, margin, gap, smartSize) {
  const ordered = orderedPhotos(photos, smartSize)
  const n = ordered.length
  if (!n) return []
  const size = Math.min(iw, ih) * (n <= 6 ? 0.38 : 0.28)
  return ordered.map((p, i) => {
    const angle = (i / n) * Math.PI * 2
    const radius = Math.min(iw, ih) * 0.28
    const cx = margin + iw / 2 + Math.cos(angle) * radius - size / 2
    const cy = margin + ih / 2 + Math.sin(angle) * radius - size / 2
    const s = smartSize ? Math.min(1.25, Math.max(0.75, Math.sqrt(p.pixels / 1.2e6))) : 1
    return baseCell(p,
      Math.max(margin, Math.min(margin + iw - size * s, cx)),
      Math.max(margin, Math.min(margin + ih - size * s, cy)),
      size * s, size * s * 1.15,
      { rotate: (Math.random() - 0.5) * 16 })
  })
}

function layoutRadial(photos, iw, ih, margin, gap, smartSize) {
  const ordered = orderedPhotos(photos, smartSize)
  const n = ordered.length
  if (!n) return []
  const centerSize = Math.min(iw, ih) * 0.32
  const result = [baseCell(ordered[0], margin + (iw - centerSize) / 2, margin + (ih - centerSize) / 2, centerSize, centerSize)]
  const ring = Math.min(iw, ih) * 0.38
  ordered.slice(1).forEach((p, i) => {
    const angle = (i / Math.max(1, n - 1)) * Math.PI * 2 - Math.PI / 2
    const size = Math.min(iw, ih) * (smartSize ? 0.14 + 0.08 * (p.pixels / (ordered[0].pixels || 1)) : 0.18)
    result.push(baseCell(p,
      margin + iw / 2 + Math.cos(angle) * ring - size / 2,
      margin + ih / 2 + Math.sin(angle) * ring - size / 2,
      size, size))
  })
  return result
}

function layoutGridDense(photos, iw, ih, margin, gap, smartSize, density) {
  const n = photos.length
  if (!n) return []
  const ordered = orderedPhotos(photos, smartSize)
  const targetSlots = Math.max(n, Math.ceil(n / density))
  let cols = Math.ceil(Math.sqrt(targetSlots * (iw / Math.max(1, ih))))
  cols = Math.max(1, Math.min(8, cols))
  if (density < 0.85) cols = Math.max(cols, Math.min(6, cols + 1))
  const rows = Math.ceil(n / cols)
  const cellW = (iw - gap * (cols - 1)) / cols
  const cellH = (ih - gap * (rows - 1)) / rows
  return ordered.map((p, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return baseCell(p, margin + col * (cellW + gap), margin + row * (cellH + gap), cellW, cellH)
  })
}

function layoutCollageDense(photos, iw, ih, margin, gap, smartSize, density) {
  const n = photos.length
  if (!n) return []
  const ordered = orderedPhotos(photos, smartSize)
  const stageRatio = iw / Math.max(1, ih)
  let cols = Math.round(Math.sqrt(Math.max(n, n / density) * stageRatio))
  cols = Math.max(2, Math.min(7, cols))
  if (n <= 3 && density < 0.9) cols = Math.max(cols, 3)
  if (n <= 2 && density < 0.8) cols = Math.max(cols, 3)
  if (n <= 6) cols = Math.min(cols, density < 0.85 ? 4 : 3)
  const colW = (iw - gap * (cols - 1)) / cols
  const colBottoms = new Array(cols).fill(0)
  const result = []
  ordered.forEach((p, idx) => {
    const span = (smartSize && p.pixels > 2e6 && idx < n * 0.35 && density > 0.85) ? Math.min(2, cols) : 1
    let bestCol = 0
    let bestY = Infinity
    for (let c = 0; c <= cols - span; c++) {
      let y = 0
      for (let k = 0; k < span; k++) y = Math.max(y, colBottoms[c + k])
      if (y < bestY) { bestY = y; bestCol = c }
    }
    const photoRatio = p.w / Math.max(1, p.h)
    let cellH = (colW * span + gap * (span - 1)) / Math.max(0.6, Math.min(1.8, photoRatio))
    if (smartSize && p.pixels > 2.5e6) cellH *= 1.1
    cellH = Math.max(50, Math.min(ih * (0.35 + 0.2 * density), cellH * (0.55 + 0.45 * density)))
    if (bestY + cellH > ih) cellH = Math.max(50, ih - bestY)
    const cellW = colW * span + gap * (span - 1)
    result.push(baseCell(p, margin + bestCol * (colW + gap), margin + bestY, cellW, cellH))
    for (let k = 0; k < span; k++) colBottoms[bestCol + k] = bestY + cellH + gap
  })
  return result
}

function shrinkAndPack(cells, stageW, stageH, margin, gap, density) {
  const d = Math.max(0.4, Math.min(1, density))
  if (d >= 0.999) return cells
  const maxX = stageW - margin
  let x = margin
  let y = margin
  let rowH = 0
  return cells.map((c) => {
    const nw = Math.max(40, c.w * d)
    const nh = Math.max(40, c.h * d)
    if (x + nw > maxX && x > margin) {
      x = margin
      y += rowH + gap
      rowH = 0
    }
    const out = { ...c, w: nw, h: nh, x, y }
    x += nw + gap
    rowH = Math.max(rowH, nh)
    return out
  })
}

/**
 * density (0.4–1): lower = smaller frames, denser re-layout, room for more photos on same canvas.
 * Does NOT add a uniform empty border around the whole collage.
 */
export function buildLayout(type, photos, stageW, stageH, margin, gap, smartSize, existingCells = null, density = 1) {
  const d = Math.max(0.4, Math.min(1, density == null ? 1 : density))
  const iw = stageW - margin * 2
  const ih = stageH - margin * 2
  if (type === 'freeform' && existingCells && existingCells.length === photos.length) {
    return existingCells.map((c) => ({ ...c }))
  }

  let cells
  if (type === 'grid') {
    cells = layoutGridDense(photos, iw, ih, margin, gap, smartSize, d)
  } else if (type === 'masonry') {
    cells = layoutMasonry(photos, iw, ih, margin, gap, smartSize)
  } else if (type === 'mosaic') {
    cells = layoutMosaic(photos, iw, ih, margin, gap, smartSize)
  } else if (type === 'polaroid') {
    cells = layoutPolaroid(photos, iw, ih, margin, gap, smartSize)
  } else if (type === 'radial') {
    cells = layoutRadial(photos, iw, ih, margin, gap, smartSize)
  } else {
    cells = layoutCollageDense(photos, iw, ih, margin, gap, smartSize, d)
  }

  if (d < 0.999 && type !== 'radial' && type !== 'polaroid') {
    cells = shrinkAndPack(cells, stageW, stageH, margin, gap, d)
  }
  return cells
}
