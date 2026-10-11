/** Photo swap + free move + edge-align to other frames + group move + pan crop */
import { saveCropToMemory, coverSize, clampPan } from './crop'
import { snapFramePosition, nudgeAllCells } from './alignSnap'

const DRAG_THRESHOLD = 6
const EDGE_SNAP = 8

export function beginCellDrag(e, cell, {
  panMode, setSelectedId, setCells, cropMemory, dragRef, photo,
  stageW = 640, stageH = 640, gap = 6, margin = 12,
}) {
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
    cellW: cell.w || 40,
    cellH: cell.h || 40,
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
          return { ...c, ox: clamped.ox, oy: clamped.oy, oxRel: clamped.ox / w, oyRel: clamped.oy / h, scale: sc }
        }),
      )
    } else if (d.moved) {
      setCells((prev) => {
        const others = prev.filter((c) => c.id !== d.id)
        let nx = d.origX + dx
        let ny = d.origY + dy
        const snapped = snapFramePosition(nx, ny, d.cellW, d.cellH, others, stageW, stageH, EDGE_SNAP)
        return prev.map((c) => (c.id === d.id ? { ...c, x: snapped.x, y: snapped.y } : c))
      })
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

    if (targetId) {
      setCells((prev) => {
        const source = prev.find((c) => c.id === d.id)
        const target = prev.find((c) => c.id === targetId)
        if (!source || !target) return prev
        const take = (c) => ({
          photoId: c.photoId,
          isPlaceholder: !!c.isPlaceholder,
          placeholderText: c.placeholderText || '',
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
      return
    }

    setCells((prev) => {
      const others = prev.filter((c) => c.id !== d.id)
      let nx = d.origX + ((ev.clientX ?? d.lastX) - d.startX)
      let ny = d.origY + ((ev.clientY ?? d.lastY) - d.startY)
      const snapped = snapFramePosition(nx, ny, d.cellW, d.cellH, others, stageW, stageH, EDGE_SNAP)
      return prev.map((c) => (c.id === d.id ? { ...c, x: snapped.x, y: snapped.y } : c))
    })
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

export function beginGroupDrag(e, { setCells, dragRef, stageW = 640, stageH = 640 }) {
  if (e.button !== 0) return
  if (e.target !== e.currentTarget) return
  e.preventDefault()

  dragRef.current = {
    type: 'group',
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
  }

  setCells((prev) => {
    dragRef.current.origins = prev.map((c) => ({ id: c.id, x: c.x, y: c.y, w: c.w, h: c.h }))
    return prev
  })

  const onMove = (ev) => {
    const d = dragRef.current
    if (!d || d.type !== 'group') return
    const dx = ev.clientX - d.startX
    const dy = ev.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD) d.moved = true
    if (!d.moved || !d.origins) return
    setCells((prev) => {
      const byId = Object.fromEntries(d.origins.map((o) => [o.id, o]))
      return prev.map((c) => {
        const o = byId[c.id]
        if (!o) return c
        const maxX = Math.max(0, stageW - (c.w || 0))
        const maxY = Math.max(0, stageH - (c.h || 0))
        return {
          ...c,
          x: Math.max(0, Math.min(maxX, o.x + dx)),
          y: Math.max(0, Math.min(maxY, o.y + dy)),
        }
      })
    })
  }

  const onUp = () => {
    dragRef.current = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

export { nudgeAllCells }
