import { uid } from './storage'

/** Create a blank placeholder cell on the stage */
export function createPlaceholderCell(stageW, stageH, margin, existingCount) {
  const id = uid()
  const w = Math.min(180, Math.max(80, Math.floor(stageW * 0.22)))
  const h = Math.min(180, Math.max(80, Math.floor(stageH * 0.22)))
  const n = existingCount || 0
  const x = Math.max(margin, Math.min(stageW - w - margin, margin + (n % 4) * (w * 0.15)))
  const y = Math.max(margin, Math.min(stageH - h - margin, margin + Math.floor(n / 4) * (h * 0.15) + (n % 3) * 12))
  return {
    id,
    photoId: null,
    isPlaceholder: true,
    placeholderText: 'Placeholder',
    x, y, w, h,
    scale: 1, ox: 0, oy: 0, oxRel: 0, oyRel: 0,
    rotate: 0,
    lockAspect: false,
    frameAspect: 'free',
    caption: 'Placeholder',
    showCaption: false,
    captionFont: 'sans',
    captionSize: 'md',
    captionBg: 'none',
  }
}
