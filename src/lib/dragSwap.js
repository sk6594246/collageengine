/** Reliable photo swap on drag-drop between cells + pan with relative crop memory */
import { saveCropToMemory } from './crop'

export function beginCellDrag(e, cell, { panMode, setSelectedId, setCells, cropMemory, dragRef }) {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  setSelectedId(cell.id)
  const isPan = panMode || e.shiftKey
  const sourceEl = e.currentTarget
  if (!isPan && sourceEl) {
    sourceEl.style.pointerEvents = 'none'
    sourceEl.style.opacity = '0.55'
  }
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
  }
  const onMove = (ev) => {
    const d = dragRef.current
    if (!d) return
    d.lastX = ev.clientX
    d.lastY = ev.clientY
    const dx = ev.clientX - d.startX
    const dy = ev.clientY - d.startY
    if (d.type === 'pan') {
      setCells((prev) =>
        prev.map((c) => {
          if (c.id !== d.id) return c
          const w = Math.max(1, c.w)
          const h = Math.max(1, c.h)
          const sc = Math.max(1, c.scale || 1)
          // scale 1 → no pan (would show gray bars); zoomed → clamp pan
          let ox = d.origOx + dx
          let oy = d.origOy + dy
          if (sc <= 1) {
            ox = 0
            oy = 0
          } else {
            const maxX = w * (sc - 1) * 0.5
            const maxY = h * (sc - 1) * 0.5
            ox = Math.max(-maxX, Math.min(maxX, ox))
            oy = Math.max(-maxY, Math.min(maxY, oy))
          }
          return { ...c, ox, oy, oxRel: ox / w, oyRel: oy / h, scale: sc }
        }),
      )
    } else {
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
    if (d.type === 'pan') {
      setCells((prev) => {
        const c = prev.find((x) => x.id === d.id)
        if (c) saveCropToMemory(c, cropMemory)
        return prev
      })
      return
    }
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
    if (!targetId) return
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
