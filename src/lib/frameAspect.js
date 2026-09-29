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
  { value: 'custom', label: 'Custom…' },
]

const PRESET = {
  '1:1': 1,
  '4:5': 4 / 5,
  '3:2': 3 / 2,
  '16:9': 16 / 9,
  '5:7': 5 / 7,
  A4P: 210 / 297,
  A4L: 297 / 210,
}

/**
 * Resolve target width/height ratio for a cell, or null if free.
 */
export function resolveFrameRatio(cell, photo) {
  const mode = cell.frameAspect || 'free'
  if (mode === 'free') return null
  if (mode === 'lock') {
    if (cell.aspectRatio != null && cell.aspectRatio > 0) return cell.aspectRatio
    return Math.max(1, cell.w || 1) / Math.max(1, cell.h || 1)
  }
  if (mode === 'photo' && photo) {
    return Math.max(1, photo.w || 1) / Math.max(1, photo.h || 1)
  }
  if (mode === 'custom') {
    const cw = Math.max(1, cell.frameAspectW || 1)
    const ch = Math.max(1, cell.frameAspectH || 1)
    return cw / ch
  }
  return PRESET[mode] || null
}

/**
 * Apply numeric geometry patch (x,y,w,h) with optional aspect lock.
 * Position is always top-left of the frame. Crop stays relative.
 */
export function applyFrameGeometry(cell, patch, photo) {
  let next = { ...cell, ...patch }
  const ratio = resolveFrameRatio(next, photo)

  // When aspect mode changes to a fixed ratio, snap height from current width (top-left fixed)
  if ('frameAspect' in patch || 'frameAspectW' in patch || 'frameAspectH' in patch) {
    const r = resolveFrameRatio(next, photo)
    if (r != null) {
      next.aspectRatio = r
      next.lockAspect = true
      if (!('h' in patch) && !('w' in patch)) {
        next.h = Math.max(40, next.w / r)
      }
    } else {
      next.lockAspect = false
    }
  }

  if (ratio != null) {
    next.lockAspect = true
    next.aspectRatio = ratio
    if ('w' in patch && !('h' in patch)) {
      next.h = Math.max(40, next.w / ratio)
    } else if ('h' in patch && !('w' in patch)) {
      next.w = Math.max(40, next.h * ratio)
    } else if ('w' in patch && 'h' in patch) {
      // Prefer width as driver when both provided under lock
      next.h = Math.max(40, next.w / ratio)
    }
  }

  next.w = Math.max(40, next.w || 40)
  next.h = Math.max(40, next.h || 40)
  next.x = Math.max(0, next.x ?? cell.x ?? 0)
  next.y = Math.max(0, next.y ?? cell.y ?? 0)

  // Keep relative crop aligned to new frame size
  const w = Math.max(1, next.w)
  const h = Math.max(1, next.h)
  const oxRel = next.oxRel != null ? next.oxRel : (next.ox || 0) / Math.max(1, cell.w || w)
  const oyRel = next.oyRel != null ? next.oyRel : (next.oy || 0) / Math.max(1, cell.h || h)
  next.oxRel = oxRel
  next.oyRel = oyRel
  next.ox = oxRel * w
  next.oy = oyRel * h

  return next
}
