import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deleteProject, listProjects, loadProject, saveProject, uid } from '../lib/storage'
import { getAspectRatio, buildLayout } from '../lib/layouts'
import { beginCellDrag } from '../lib/dragSwap'
import { applyCropMemory, cropFromCell, saveCropToMemory, drawPhotoInCell } from '../lib/crop'
import { applyFrameGeometry } from '../lib/frameAspect'

export const MAX_PHOTOS = 30

export function useCollageEngine() {
  const [view, setView] = useState('studio')
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState(null)
  const [projectName, setProjectName] = useState('My collage')
  const [photos, setPhotos] = useState([])
  const [cells, setCells] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [aspect, setAspect] = useState('1:1')
  const [customW, setCustomW] = useState(30)
  const [customH, setCustomH] = useState(20)
  const [layoutType, setLayoutType] = useState('collage')
  const [smartSize, setSmartSize] = useState(true)
  const [gap, setGap] = useState(6)
  const [margin, setMargin] = useState(12)
  const [cellRadius, setCellRadius] = useState(4)
  const [bgColor, setBgColor] = useState('#faf6f0')
  const [theme, setTheme] = useState('none')
  const [caption, setCaption] = useState('')
  const [showCaption, setShowCaption] = useState(false)
  const [stageW, setStageW] = useState(640)
  const [stageH, setStageH] = useState(640)
  const [status, setStatus] = useState('')
  const [layoutScalePct, setLayoutScalePct] = useState(100)
  const [panMode, setPanMode] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const wrapRef = useRef(null)
  const fileRef = useRef(null)
  const dragRef = useRef(null)
  const cellsRef = useRef([])
  const cropMemory = useRef(new Map())

  useEffect(() => { cellsRef.current = cells }, [cells])

  const selected = useMemo(() => cells.find((c) => c.id === selectedId) || null, [cells, selectedId])
  const selectedPhoto = useMemo(
    () => (selected ? photos.find((p) => p.id === selected.photoId) : null),
    [selected, photos],
  )

  const computeStage = useCallback(() => {
    const ratio = getAspectRatio(aspect, customW, customH)
    const wrap = wrapRef.current
    const availW = Math.max(200, (wrap ? wrap.clientWidth : 800) - 32)
    const availH = Math.max(200, (wrap ? wrap.clientHeight : 600) - 32)
    let w, h
    if (availW / availH > ratio) {
      h = Math.floor(availH)
      w = Math.floor(h * ratio)
    } else {
      w = Math.floor(availW)
      h = Math.floor(w / ratio)
    }
    w = Math.max(200, w)
    h = Math.max(200, h)
    setStageW(w)
    setStageH(h)
    return { w, h }
  }, [aspect, customW, customH])

  const rebuild = useCallback((photoList = photos, type = layoutType, scalePct = layoutScalePct) => {
    const { w, h } = computeStage()
    if (!photoList.length) {
      setCells([])
      return
    }
    const prevByPhoto = {}
    cellsRef.current.forEach((c) => {
      const crop = cropFromCell(c)
      prevByPhoto[c.photoId] = {
        caption: c.caption, showCaption: c.showCaption,
        captionFont: c.captionFont, captionSize: c.captionSize, captionBg: c.captionBg,
        frameAspect: c.frameAspect || 'free',
        frameAspectW: c.frameAspectW, frameAspectH: c.frameAspectH,
        aspectRatio: c.aspectRatio, lockAspect: !!c.lockAspect,
        ...crop,
      }
      cropMemory.current.set(c.photoId, crop)
    })
    const enriched = photoList.map((p) => ({ ...p, ...(prevByPhoto[p.id] || {}) }))
    const density = Math.max(0.4, Math.min(1, (scalePct || 100) / 100))
    let next = buildLayout(type, enriched, w, h, margin, gap, smartSize, null, density)
    next = next.map((c) => {
      const prev = prevByPhoto[c.photoId]
      const mem = cropMemory.current.get(c.photoId)
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
      cell = applyCropMemory(cell, mem || prev)
      return cell
    })
    setCells(next)
  }, [photos, layoutType, margin, gap, smartSize, computeStage, layoutScalePct])

  useEffect(() => {
    const onResize = () => computeStage()
    window.addEventListener('resize', onResize)
    computeStage()
    return () => window.removeEventListener('resize', onResize)
  }, [computeStage])

  useEffect(() => {
    rebuild()
  }, [aspect, customW, customH, layoutType, gap, margin, smartSize, photos.length, layoutScalePct])

  useEffect(() => {
    listProjects().then(setProjects).catch(() => {})
  }, [])

  const loadFiles = (fileList) => {
    const remaining = MAX_PHOTOS - photos.length
    if (remaining <= 0) return alert('Maximum 30 photos reached.')
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/')).slice(0, remaining)
    if (!files.length) return
    let loaded = 0
    const next = []
    files.forEach((file) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        next.push({
          id: uid(), url, img,
          w: img.naturalWidth, h: img.naturalHeight,
          pixels: img.naturalWidth * img.naturalHeight, name: file.name,
        })
        loaded++
        if (loaded === files.length) {
          setPhotos((prev) => [...prev, ...next])
          setStatus(`${next.length} photo${next.length > 1 ? 's' : ''} added`)
          setTimeout(() => setStatus(''), 2000)
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        loaded++
        if (loaded === files.length && next.length) setPhotos((prev) => [...prev, ...next])
      }
      img.src = url
    })
  }

  const removePhoto = (id) => {
    setPhotos((prev) => {
      const p = prev.find((x) => x.id === id)
      if (p?.url) URL.revokeObjectURL(p.url)
      return prev.filter((x) => x.id !== id)
    })
    setCells((prev) => prev.filter((c) => c.photoId !== id))
    if (selected?.photoId === id) setSelectedId(null)
  }

  const clearAll = () => {
    if (!photos.length || !confirm('Remove all photos?')) return
    photos.forEach((p) => p.url && URL.revokeObjectURL(p.url))
    setPhotos([])
    setCells([])
    setSelectedId(null)
  }

  const updateSelected = (patch) => {
    if (!selectedId) return
    setCells((prev) =>
      prev.map((c) => {
        if (c.id !== selectedId) return c
        const photo = photos.find((p) => p.id === c.photoId)
        const geomKeys = ['x', 'y', 'w', 'h', 'frameAspect', 'frameAspectW', 'frameAspectH']
        const hasGeom = geomKeys.some((k) => k in patch)
        let next = hasGeom ? applyFrameGeometry(c, patch, photo) : { ...c, ...patch }
        if ('ox' in patch || 'oy' in patch || 'scale' in patch) {
          const w = Math.max(1, next.w)
          const h = Math.max(1, next.h)
          if ('ox' in patch) next.oxRel = (next.ox || 0) / w
          if ('oy' in patch) next.oyRel = (next.oy || 0) / h
          saveCropToMemory(next, cropMemory)
        }
        if ('oxRel' in patch || 'oyRel' in patch) {
          next = applyCropMemory(next, { ...cropFromCell(next), ...patch })
          saveCropToMemory(next, cropMemory)
        }
        if (hasGeom) saveCropToMemory(next, cropMemory)
        return next
      }),
    )
  }

  const exportPNG = () => {
    if (!photos.length) return
    const scale = 3
    const canvas = document.createElement('canvas')
    canvas.width = stageW * scale
    canvas.height = stageH * scale
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    cells.forEach((cell) => {
      const photo = photos.find((p) => p.id === cell.photoId)
      if (!photo?.img) return
      ctx.save()
      const cx = (cell.x + cell.w / 2) * scale
      const cy = (cell.y + cell.h / 2) * scale
      ctx.translate(cx, cy)
      if (cell.rotate) ctx.rotate((cell.rotate * Math.PI) / 180)
      const rw = cell.w * scale
      const rh = cell.h * scale
      const r = cellRadius * scale
      ctx.beginPath()
      ctx.moveTo(-rw / 2 + r, -rh / 2)
      ctx.arcTo(rw / 2, -rh / 2, rw / 2, rh / 2, r)
      ctx.arcTo(rw / 2, rh / 2, -rw / 2, rh / 2, r)
      ctx.arcTo(-rw / 2, rh / 2, -rw / 2, -rh / 2, r)
      ctx.arcTo(-rw / 2, -rh / 2, rw / 2, -rh / 2, r)
      ctx.closePath()
      ctx.clip()
      drawPhotoInCell(ctx, photo, cell, scale)
      if (cell.showCaption && cell.caption) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        ctx.fillRect(-rw / 2, rh / 2 - 28 * scale, rw, 28 * scale)
        ctx.fillStyle = '#fff'
        ctx.font = `600 ${14 * scale}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(cell.caption, 0, rh / 2 - 14 * scale, rw - 16 * scale)
      }
      ctx.restore()
    })
    if (showCaption && caption) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, canvas.height - 60 * scale, canvas.width, 60 * scale)
      ctx.fillStyle = '#fff'
      ctx.font = `600 ${18 * scale}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(caption, canvas.width / 2, canvas.height - 22 * scale)
    }
    const link = document.createElement('a')
    link.download = `${projectName || 'family-collage'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const photoToDataURL = (photo) =>
    new Promise((resolve) => {
      try {
        const c = document.createElement('canvas')
        c.width = photo.w
        c.height = photo.h
        c.getContext('2d').drawImage(photo.img, 0, 0)
        resolve(c.toDataURL('image/jpeg', 0.85))
      } catch { resolve(null) }
    })

  const handleSaveProject = async () => {
    const name = projectName.trim() || 'My collage'
    const id = projectId || uid()
    setStatus('Saving…')
    try {
      const photoData = []
      for (const p of photos) {
        photoData.push({
          id: p.id, name: p.name, w: p.w, h: p.h, pixels: p.pixels,
          dataUrl: await photoToDataURL(p),
        })
      }
      await saveProject({
        id, name, photoCount: photos.length, updatedAt: Date.now(),
        settings: { aspect, customW, customH, layoutType, smartSize, gap, margin, cellRadius, bgColor, theme, caption, showCaption },
        cells: cells.map((c) => ({
          photoId: c.photoId, x: c.x, y: c.y, w: c.w, h: c.h,
          scale: c.scale, ox: c.ox, oy: c.oy, oxRel: c.oxRel, oyRel: c.oyRel,
          frameAspect: c.frameAspect || 'free',
          frameAspectW: c.frameAspectW, frameAspectH: c.frameAspectH,
          aspectRatio: c.aspectRatio, lockAspect: !!c.lockAspect,
          rotate: c.rotate || 0,
          caption: c.caption, showCaption: c.showCaption,
          captionFont: c.captionFont, captionSize: c.captionSize, captionBg: c.captionBg,
        })),
        photos: photoData,
      })
      setProjectId(id)
      setProjectName(name)
      setProjects(await listProjects())
      setStatus('Saved')
      setTimeout(() => setStatus(''), 2000)
    } catch (e) {
      console.error(e)
      setStatus('Save failed')
      alert('Could not save project.')
    }
  }

  const handleLoadProject = async (id) => {
    setStatus('Loading…')
    try {
      const data = await loadProject(id)
      if (!data) return
      photos.forEach((p) => p.url && URL.revokeObjectURL(p.url))
      const loadedPhotos = []
      for (const p of data.photos || []) {
        if (!p.dataUrl) continue
        const img = new Image()
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = p.dataUrl })
        loadedPhotos.push({
          id: p.id, url: p.dataUrl, img,
          w: p.w || img.naturalWidth, h: p.h || img.naturalHeight,
          pixels: p.pixels || img.naturalWidth * img.naturalHeight, name: p.name || 'photo',
        })
      }
      const s = data.settings || {}
      setAspect(s.aspect || '1:1')
      setCustomW(s.customW || 30)
      setCustomH(s.customH || 20)
      setLayoutType(s.layoutType || 'collage')
      setSmartSize(s.smartSize !== false)
      setGap(s.gap ?? 6)
      setMargin(s.margin ?? 12)
      setCellRadius(s.cellRadius ?? 4)
      setBgColor(s.bgColor || '#faf6f0')
      setTheme(s.theme || 'none')
      setCaption(s.caption || '')
      setShowCaption(!!s.showCaption)
      setPhotos(loadedPhotos)
      setProjectId(data.id)
      setProjectName(data.name || 'My collage')
      setTimeout(() => {
        if (data.cells?.length) setCells(data.cells.map((c) => ({ ...c, id: uid() })))
        else rebuild(loadedPhotos, s.layoutType || 'collage')
        setStatus('')
        setView('studio')
      }, 50)
    } catch (e) {
      console.error(e)
      setStatus('Load failed')
      alert('Could not load project.')
    }
  }

  const handleNewProject = () => {
    if (photos.length && !confirm('Start a new project? Unsaved changes will be lost.')) return
    photos.forEach((p) => p.url && URL.revokeObjectURL(p.url))
    setPhotos([])
    setCells([])
    setSelectedId(null)
    setProjectId(null)
    setProjectName('My collage')
    setCaption('')
    setShowCaption(false)
    setView('studio')
  }

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Delete this project?')) return
    await deleteProject(id)
    setProjects(await listProjects())
    if (projectId === id) handleNewProject()
  }

  const onCellPointerDown = (e, cell) => {
    const photo = photos.find((p) => p.id === cell.photoId)
    beginCellDrag(e, cell, { panMode, setSelectedId, setCells, cropMemory, dragRef, photo })
  }

  const onCellWheel = (e, cell) => {
    if (cell.id !== selectedId) return
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    setCells((prev) =>
      prev.map((c) => {
        if (c.id !== cell.id) return c
        const next = { ...c, scale: Math.min(5, Math.max(1, (c.scale || 1) + delta)) }
        return saveCropToMemory(next, cropMemory)
      }),
    )
  }

  const zoomSelected = (delta) => {
    if (!selected) return
    saveCropToMemory(selected, cropMemory)
    updateSelected({ scale: Math.min(5, Math.max(1, (selected.scale || 1) + delta)) })
  }

  const restoreCrop = () => {
    if (!selected) return
    const mem = cropMemory.current.get(selected.photoId)
    if (!mem) return
    const w = Math.max(1, selected.w)
    const h = Math.max(1, selected.h)
    const oxRel = mem.oxRel != null ? mem.oxRel : (mem.ox || 0) / w
    const oyRel = mem.oyRel != null ? mem.oyRel : (mem.oy || 0) / h
    updateSelected({ scale: mem.scale || 1, oxRel, oyRel, ox: oxRel * w, oy: oyRel * h })
  }

  const replaceSelected = () => {
    if (!selected) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files && input.files[0]
      if (!file) return
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        setPhotos((prev) => prev.map((p) => {
          if (p.id !== selected.photoId) return p
          if (p.url && p.url.startsWith('blob:')) URL.revokeObjectURL(p.url)
          return { ...p, url, img, w: img.naturalWidth, h: img.naturalHeight, pixels: img.naturalWidth * img.naturalHeight, name: file.name }
        }))
      }
      img.src = url
    }
    input.click()
  }

  return {
    view, setView, projects, projectId, projectName, setProjectName,
    photos, cells, selectedId, setSelectedId, selected, selectedPhoto,
    aspect, setAspect, customW, setCustomW, customH, setCustomH,
    layoutType, setLayoutType, smartSize, setSmartSize,
    gap, setGap, margin, setMargin, cellRadius, setCellRadius,
    bgColor, setBgColor, theme, setTheme,
    caption, setCaption, showCaption, setShowCaption,
    stageW, stageH, status, layoutScalePct, setLayoutScalePct,
    panMode, setPanMode, mobileOpen, setMobileOpen,
    wrapRef, fileRef, cropMemory,
    rebuild, loadFiles, removePhoto, clearAll, updateSelected,
    exportPNG, handleSaveProject, handleLoadProject, handleNewProject, handleDeleteProject,
    onCellPointerDown, onCellWheel, zoomSelected, restoreCrop, replaceSelected,
  }
}
