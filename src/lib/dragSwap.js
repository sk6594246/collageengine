/** Photo swap on drag-drop + pan with cover-aware clamp (Windows-style selective crop) */
import { saveCropToMemory, coverSize, clampPan } from './crop'

const DRAG_THRESHOLD = 6 // px — below this = click select only (keeps selection for Frame mode button)

/**
 * @param photo optional { w, h } for accurate pan limits at scale 1
 */
export function beginCellDrag(e, cell, { panMode, setSelectedId, setCells, cropMemory, dragRef, photo }) {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  setSelectedId(cell.id)
  const isPan = panMode || e.shiftKey
  const sourceEl = e.currentTarget
  dragRef.current = {
    id: cell.id,
    type: isPan ? 'pan' : 'drag',
    startX: e.clientX,
    startY: e.clientY,
    origX: cell.x,
    origY: cell.y,
    origOx: cell.ox || 0,
    origOy: cell.oy || 0,
    lastX: e.clientX,
    lastY: e.clientY,
    sourceEl,
    moved: false,
    photoW: photo?.w || photo?.img?.naturalWidth || 0,
    photoH: photo?.h || photo?.img?.naturalHeight || 0,
  }
  const onMove = (ev) => {
    const d = dragRef.current
    if (!d) return
    d.lastX = ev.clientX
    d.lastY = ev.clientY
    const dx = ev.clientX - d.startX
    const dy = ev.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      d.moved = true
      if (d.type === 'drag' && d.sourceEl) {
        d.sourceEl.style.pointerEvents = 'none'
        d.sourceEl.style.opacity = '0.55'
      }
    }
    if (d.type === 'pan') {
      setCells((prev) =>
        prev.map((c) => {
          if (c.id !== d.id) return c
          const w = Math.max(1, c.w)
          const h = Math.max(1, c.h)
          const sc = Math.max(1, c.scale || 1)
          let ox = d.origOx + dx
          let oy = d.origOy + dy
          const pw = d.photoW || w
          const ph = d.photoH || h
          const { w: coverW, h: coverH } = coverSize(w, h, pw, ph)
          const clamped = clampPan(ox, oy, w, h, coverW, coverH, sc)
          ox = clamped.ox
          oy = clamped.oy
          return { ...c, ox, oy, oxRel: ox / w, oyRel: oy / h, scale: sc }
        }),
      )
    } else if (d.moved) {
      setCells((prev) =>
        prev.map((c) => (c.id === d.id ? { ...c, x: Math.max(0, d.origX + dx), y: Math.max(0, d.origY + dy) } : c)),
      )
    }
  }
  const onUp = (ev) => {
    const d = dragRef.current
    dragRef.current = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    if (!d) return
    if (d.sourceEl) {
      d.sourceEl.style.pointerEvents = ''
      d.sourceEl.style.opacity = ''
    }
    setSelectedId(d.id)
    if (d.type === 'pan') {
      setCells((prev) => {
        const c = prev.find((x) => x.id === d.id)
        if (c) saveCropToMemory(c, cropMemory)
        return prev
      })
      return
    }
    if (!d.moved) return
    const x = ev.clientX ?? d.lastX
    const y = ev.clientY ?? d.lastY
    const stack = (document.elementsFromPoint?.(x, y) || [document.elementFromPoint(x, y)]).filter(Boolean)
    let targetId = null
    for (const node of stack) {
      const cellEl = node.closest?.('.cell')
      if (!cellEl) continue
      const id = cellEl.getAttribute('data-id')
      if (id && id !== d.id) {
        targetId = id
        break
      }
    }
    if (!targetId) {
      setCells((prev) =>
        prev.map((c) => (c.id === d.id ? { ...c, x: d.origX, y: d.origY } : c)),
      )
      return
    }
    setCells((prev) => {
      const source = prev.find((c) => c.id === d.id)
      const target = prev.find((c) => c.id === targetId)
      if (!source || !target) return prev
      const take = (c) => ({
        photoId: c.photoId,
        scale: c.scale || 1,
        ox: c.ox || 0,
        oy: c.oy || 0,
        oxRel: c.oxRel,
        oyRel: c.oyRel,
        rotate: c.rotate || 0,
        caption: c.caption || '',
        showCaption: !!c.showCaption,
        captionFont: c.captionFont || 'sans',
        captionSize: c.captionSize || 'md',
        captionBg: c.captionBg || 'gradient',
      })
      const s = take(source)
      const t = take(target)
      return prev.map((c) => {
        if (c.id === d.id) return { ...c, x: d.origX, y: d.origY, ...t }
        if (c.id === targetId) return { ...c, ...s }
        return c
      })
    })
    setSelectedId(d.id)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
