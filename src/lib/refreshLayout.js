import { packCells, sortCellsReadingOrder } from './pack'
import { applyCropMemory, cropFromCell } from './crop'

/**
 * Refresh layout:
 * - If cells exist: keep sequence (TL→BR), size & aspect; only re-pack positions (overflow OK)
 * - If no cells: caller should use full buildLayout (first layout)
 */
export function refreshKeepSizes(cells, photoList, stageW, stageH, gap, margin, buildExtrasFn) {
  if (!photoList?.length) return []
  if (!cells?.length) return null

  const ordered = sortCellsReadingOrder(cells)
  const onStageIds = new Set(ordered.map((c) => c.photoId))
  let next = ordered.map((c) => ({ ...c }))
  next = packCells(next, stageW, stageH, gap, margin, { keepExactSize: true })

  const missing = photoList.filter((p) => !onStageIds.has(p.id))
  if (missing.length && typeof buildExtrasFn === 'function') {
    const extras = buildExtrasFn(missing) || []
    let maxBottom = margin
    next.forEach((c) => {
      maxBottom = Math.max(maxBottom, (c.y || 0) + (c.h || 0))
    })
    const shifted = packCells(extras, stageW, stageH, gap, margin, { keepExactSize: false }).map((c) => ({
      ...c,
      y: (c.y || margin) + maxBottom + gap - margin,
    }))
    next = next.concat(shifted)
  }
  return next
}

export function snapshotCellMeta(cells, cropMemory) {
  const prevByPhoto = {}
  ;(cells || []).forEach((c) => {
    const crop = cropFromCell(c)
    prevByPhoto[c.photoId] = {
      caption: c.caption,
      showCaption: c.showCaption,
      captionFont: c.captionFont,
      captionSize: c.captionSize,
      captionBg: c.captionBg,
      frameAspect: c.frameAspect || 'free',
      frameAspectW: c.frameAspectW,
      frameAspectH: c.frameAspectH,
      aspectRatio: c.aspectRatio,
      lockAspect: !!c.lockAspect,
      w: c.w,
      h: c.h,
      x: c.x,
      y: c.y,
      rotate: c.rotate || 0,
      ...crop,
    }
    if (cropMemory?.current) cropMemory.current.set(c.photoId, crop)
  })
  return prevByPhoto
}

export function mergeMetaOntoCells(cells, prevByPhoto, cropMemory) {
  return (cells || []).map((c) => {
    const prev = prevByPhoto[c.photoId]
    const mem = cropMemory?.current?.get(c.photoId)
    let cell = { ...c }
    if (prev) {
      cell = {
        ...cell,
        caption: prev.caption || '',
        showCaption: !!prev.showCaption,
        captionFont: prev.captionFont || 'sans',
        captionSize: prev.captionSize || 'md',
        captionBg: prev.captionBg || 'gradient',
        frameAspect: prev.frameAspect || 'free',
        frameAspectW: prev.frameAspectW,
        frameAspectH: prev.frameAspectH,
        aspectRatio: prev.aspectRatio,
        lockAspect: !!prev.lockAspect,
      }
    }
    return applyCropMemory(cell, mem || prev)
  })
}
