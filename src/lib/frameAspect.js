/** Per-frame aspect ratio helpers */

export const FRAME_ASPECT_OPTIONS = [
  { value: 'free', label: 'Free (any size)' },
  { value: 'lock', label: 'Lock current' },
  { value: 'photo', label: 'Match photo' },
  { value: '1:1', label: '1 : 1' },
  { value: '4:5', label: '4 : 5' },
  { value: '3:2', label: '3 : 2' },
  { value: '16:9', label: '16 : 9' },
  { value: '5:7', label: '5 : 7' },
  { value: 'A4P', label: 'A4 Portrait' },
  { value: 'A4L', label: 'A4 Landscape' },
  { value: 'custom', label: 'Custom W:H' },
]

export function frameAspectRatio(cell, photo) {
  const mode = cell.frameAspect || 'free'
  if (mode === 'free') return null
  if (mode === 'lock') {
    const w = Math.max(1, cell.w || 1)
    const h = Math.max(1, cell.h || 1)
    return w / h
  }
  if (mode === 'photo' && photo) {
    const pw = photo.w || photo.img?.naturalWidth || 1
    const ph = photo.h || photo.img?.naturalHeight || 1
    return Math.max(1, pw) / Math.max(1, ph)
  }
  if (mode === 'custom') {
    const cw = Math.max(1, cell.frameAspectW || 1)
    const ch = Math.max(1, cell.frameAspectH || 1)
    return cw / ch
  }
  const map = {
    '1:1': 1,
    '4:5': 4 / 5,
    '3:2': 3 / 2,
    '16:9': 16 / 9,
    '5:7': 5 / 7,
    A4P: 210 / 297,
    A4L: 297 / 210,
  }
  return map[mode] || null
}

/** Apply geometry patch keeping top-left fixed when aspect is locked. */
export function applyFrameGeometry(cell, patch, photo) {
  let next = { ...cell, ...patch }
  const ratio = frameAspectRatio(next, photo)
  if (ratio == null) {
    next.lockAspect = false
    return next
  }
  next.lockAspect = true
  next.aspectRatio = ratio
  const hasW = 'w' in patch
  const hasH = 'h' in patch
  if (hasW && !hasH) {
    next.h = Math.max(40, next.w / ratio)
  } else if (hasH && !hasW) {
    next.w = Math.max(40, next.h * ratio)
  } else if (hasW && hasH) {
    // Prefer width-driven ratio when both change
    next.h = Math.max(40, next.w / ratio)
  } else if ('frameAspect' in patch || 'frameAspectW' in patch || 'frameAspectH' in patch) {
    // Mode change: keep width, adjust height from top-left
    next.h = Math.max(40, Math.max(40, next.w) / ratio)
  }
  return next
}
