/** Layout helpers for Family Frame */
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
    return {
      id: uid(),
      photoId: p.id,
      x: margin + col * (cellW + gap),
      y: margin + row * (cellH + gap),
      w: cellW,
      h: cellH,
      scale: 1, ox: 0, oy: 0,
      caption: p.caption || '',
      showCaption: !!p.showCaption,
      captionFont: p.captionFont || 'sans',
      captionSize: p.captionSize || 'md',
      captionBg: p.captionBg || 'gradient',
    }
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
    result.push({
      id: uid(),
      photoId: p.id,
      x: margin + bestCol * (colW + gap),
      y: margin + bestY,
      w: cellW,
      h: cellH,
      scale: 1, ox: 0, oy: 0,
      caption: p.caption || '',
      showCaption: !!p.showCaption,
      captionFont: p.captionFont || 'sans',
      captionSize: p.captionSize || 'md',
      captionBg: p.captionBg || 'gradient',
    })
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
    const cell = {
      id: uid(),
      photoId: p.id,
      x: margin + shortest * (colW + gap),
      y: margin + colH[shortest],
      w: colW,
      h: ch,
      scale: 1, ox: 0, oy: 0,
      caption: p.caption || '',
      showCaption: !!p.showCaption,
      captionFont: p.captionFont || 'sans',
      captionSize: p.captionSize || 'md',
      captionBg: p.captionBg || 'gradient',
    }
    colH[shortest] += ch + gap
    return cell
  })
}

export function buildLayout(type, photos, stageW, stageH, margin, gap, smartSize) {
  const iw = stageW - margin * 2
  const ih = stageH - margin * 2
  if (type === 'grid') return layoutGrid(photos, iw, ih, margin, gap, smartSize)
  if (type === 'masonry') return layoutMasonry(photos, iw, ih, margin, gap, smartSize)
  return layoutCollage(photos, iw, ih, margin, gap, smartSize)
}
