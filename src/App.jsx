import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { deleteProject, listProjects, loadProject, saveProject, uid } from './lib/storage'
import { qualityLabel, getAspectRatio, buildLayout } from './lib/layouts'
import { beginCellDrag } from './lib/dragSwap'
import { applyCropMemory, cropFromCell, saveCropToMemory } from './lib/crop'
import { FRAME_ASPECT_OPTIONS, applyFrameGeometry } from './lib/frameAspect'

const MAX_PHOTOS = 30

export default function App() {
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
  /** Universal scale: 50–100 (%). Shrinks all frames so more photos can fit; crop stays relative. */
  const [layoutScalePct, setLayoutScalePct] = useState(100)
  const wrapRef = useRef(null)
  const fileRef = useRef(null)
  const dragRef = useRef(null)
  const cellsRef = useRef([])
  const [panMode, setPanMode] = useState(false)
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
        frameAspectW: c.frameAspectW,
        frameAspectH: c.frameAspectH,
        aspectRatio: c.aspectRatio,
        lockAspect: !!c.lockAspect,
        ...crop,
      }
      // Keep latest crop in memory so restore always works after rebuild
      cropMemory.current.set(c.photoId, crop)
    })
    const enriched = photoList.map((p) => ({ ...p, ...(prevByPhoto[p.id] || {}) }))
    // Density 0.5–1: lower = smaller frames, denser pack, room for more photos on same canvas
    // (not a uniform empty border — layout reshuffles)
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
      // Always re-apply crop relative to NEW frame size (fixes crop loss)
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
        if (loaded === files.length) setPhotos((prev) => [...prev, ...next])
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
        // Keep relative crop in sync whenever ox/oy/scale change
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

  const onUniversalScale = (pct) => {
    setLayoutScalePct(pct)
    // Immediate visual scale without waiting for effect (effect also runs)
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
      const imgRatio = photo.w / photo.h
      const cellRatio = rw / rh
      let dw, dh
      if (imgRatio > cellRatio) { dh = rh; dw = dh * imgRatio }
      else { dw = rw; dh = dw / imgRatio }
      const sc = cell.scale || 1
      dw *= sc; dh *= sc
      const dx = -rw / 2 + (rw - dw) / 2 + (cell.ox || 0) * scale
      const dy = -rh / 2 + (rh - dh) / 2 + (cell.oy || 0) * scale
      ctx.drawImage(photo.img, dx, dy, dw, dh)
      if (cell.showCaption && cell.caption) {
        const sizeMap = { sm: 11, md: 14, lg: 18 }
        const fontPx = (sizeMap[cell.captionSize] || 14) * scale
        ctx.font = `600 ${fontPx}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const bg = cell.captionBg || 'gradient'
        if (bg === 'gradient') {
          const g = ctx.createLinearGradient(0, rh / 2 - 40 * scale, 0, rh / 2)
          g.addColorStop(0, 'rgba(0,0,0,0)')
          g.addColorStop(1, 'rgba(0,0,0,0.72)')
          ctx.fillStyle = g
          ctx.fillRect(-rw / 2, rh / 2 - 44 * scale, rw, 44 * scale)
          ctx.fillStyle = '#fff'
        } else if (bg === 'solid-dark') {
          ctx.fillStyle = 'rgba(0,0,0,0.7)'
          ctx.fillRect(-rw / 2, rh / 2 - 28 * scale, rw, 28 * scale)
          ctx.fillStyle = '#fff'
        } else if (bg === 'solid-light') {
          ctx.fillStyle = 'rgba(255,255,255,0.88)'
          ctx.fillRect(-rw / 2, rh / 2 - 28 * scale, rw, 28 * scale)
          ctx.fillStyle = '#1a1410'
        } else {
          ctx.fillStyle = '#fff'
          ctx.shadowColor = 'rgba(0,0,0,0.85)'
          ctx.shadowBlur = 6 * scale
        }
        ctx.fillText(cell.caption, 0, rh / 2 - 14 * scale, rw - 16 * scale)
        ctx.shadowBlur = 0
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
      alert('Could not save project. Photos may be too large for browser storage.')
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
    beginCellDrag(e, cell, { panMode, setSelectedId, setCells, cropMemory, dragRef })
  }

  const onCellWheel = (e, cell) => {
    if (cell.id !== selectedId) return
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    setCells((prev) =>
      prev.map((c) => {
        if (c.id !== cell.id) return c
        const next = { ...c, scale: Math.min(5, Math.max(0.5, (c.scale || 1) + delta)) }
        return saveCropToMemory(next, cropMemory)
      }),
    )
  }

  return (
    <div className={`app ${theme === 'none' ? '' : `theme-${theme}`}`}>
      <header className="app-header">
        <h1>
          <span className="logo">🖼️</span>
          Family <span className="brand">Frame</span>
          <span className="tagline">for us</span>
        </h1>
        <div className="header-actions">
          <button type="button" className="secondary" onClick={() => setView(view === 'projects' ? 'studio' : 'projects')}>
            {view === 'projects' ? '← Studio' : 'Projects'}
          </button>
          <button type="button" className="secondary" onClick={() => rebuild()} disabled={!photos.length}>↻ Surprise me</button>
          <button type="button" onClick={handleSaveProject} disabled={!photos.length}>💾 Save project</button>
          <button type="button" onClick={exportPNG} disabled={!photos.length}>⬇ Save PNG</button>
          <button type="button" className="secondary" onClick={() => window.print()} disabled={!photos.length}>🖨 Print</button>
        </div>
      </header>

      <div className="main">
        <aside className="sidebar">
          {view === 'projects' ? (
            <div className="control-group">
              <div className="section-title">Projects</div>
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" />
              <div className="row-btns">
                <button type="button" onClick={handleNewProject}>New</button>
                <button type="button" className="secondary" onClick={handleSaveProject} disabled={!photos.length}>Save</button>
              </div>
              <div className="project-list">
                {projects.length === 0 && <p className="hint">No saved projects yet.</p>}
                {projects.map((p) => (
                  <div key={p.id} className={`project-item ${p.id === projectId ? 'active' : ''}`} onClick={() => handleLoadProject(p.id)} role="button" tabIndex={0}>
                    <div>
                      <div className="name">{p.name}</div>
                      <div className="meta">{p.photoCount || 0} photos</div>
                    </div>
                    <button type="button" className="del" onClick={(e) => handleDeleteProject(p.id, e)}>×</button>
                  </div>
                ))}
              </div>
              {status && <p className="hint">{status}</p>}
            </div>
          ) : (
            <>
              <div>
                <div className="section-title">Our photos</div>
                <div
                  className="upload-zone"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragover') }}
                  onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); loadFiles(e.dataTransfer.files) }}
                >
                  <strong>Drop family photos here</strong>
                  <p>or click · up to {MAX_PHOTOS}</p>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { loadFiles(e.target.files); e.target.value = '' }} />
                </div>
                <div className="photo-list">
                  {photos.map((p) => (
                    <div key={p.id} className="photo-item">
                      <img src={p.url} alt="" />
                      <div className="meta">{p.name} · {qualityLabel(p.pixels)}</div>
                      <button type="button" onClick={() => removePhoto(p.id)}>×</button>
                    </div>
                  ))}
                </div>
              </div>

              {selected && (
                <div className="control-group">
                  <div className="section-title">Selected photo</div>
                  <div className="selected-actions">
                    <button type="button" className={`secondary ${panMode ? 'on' : ''}`} onClick={() => setPanMode((v) => !v)}>
                      {panMode ? 'Moving photo…' : 'Move photo'}
                    </button>
                    <button type="button" className="secondary" onClick={() => updateSelected({ rotate: ((selected.rotate || 0) + 90) % 360 })}>Rotate</button>
                    <button type="button" className="secondary" onClick={() => {
                      saveCropToMemory(selected, cropMemory)
                      updateSelected({ scale: Math.min(5, (selected.scale || 1) + 0.15) })
                    }}>＋ Zoom</button>
                    <button type="button" className="secondary" onClick={() => {
                      saveCropToMemory(selected, cropMemory)
                      updateSelected({ scale: Math.max(0.5, (selected.scale || 1) - 0.15) })
                    }}>－ Zoom</button>
                    <button type="button" className="secondary" onClick={() => {
                      const mem = cropMemory.current.get(selected.photoId)
                      if (!mem) return
                      const w = Math.max(1, selected.w)
                      const h = Math.max(1, selected.h)
                      const oxRel = mem.oxRel != null ? mem.oxRel : (mem.ox || 0) / w
                      const oyRel = mem.oyRel != null ? mem.oyRel : (mem.oy || 0) / h
                      updateSelected({ scale: mem.scale || 1, oxRel, oyRel, ox: oxRel * w, oy: oyRel * h })
                    }}>Restore crop</button>
                    <button type="button" className="secondary" onClick={() => {
                      // Reset view but keep last crop in memory so Restore still works
                      updateSelected({ scale: 1, ox: 0, oy: 0, oxRel: 0, oyRel: 0 })
                    }}>Reset view</button>
                    <button type="button" className="secondary" onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = 'image/*'
                      input.onchange = () => {
                        const file = input.files && input.files[0]
                        if (!file || !selected) return
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
                    }}>Replace</button>
                    <button type="button" className="secondary danger" onClick={() => selectedPhoto && removePhoto(selectedPhoto.id)}>Remove</button>
                  </div>

                  <div className="section-title" style={{ marginTop: 12 }}>Frame size &amp; position</div>
                  <p className="hint" style={{ marginBottom: 6 }}>
                    Top-left origin (X, Y). W/H in stage pixels. Crop stays relative — original photo kept in memory (lossless until export).
                  </p>
                  <label>Frame aspect</label>
                  <select
                    value={selected.frameAspect || 'free'}
                    onChange={(e) => updateSelected({ frameAspect: e.target.value })}
                  >
                    {FRAME_ASPECT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {(selected.frameAspect || 'free') === 'custom' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={selected.frameAspectW ?? 1}
                        onChange={(e) => updateSelected({ frameAspectW: Math.max(1, +e.target.value || 1) })}
                        placeholder="W"
                        title="Custom aspect width"
                      />
                      <span style={{ alignSelf: 'center', color: 'var(--muted)' }}>:</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={selected.frameAspectH ?? 1}
                        onChange={(e) => updateSelected({ frameAspectH: Math.max(1, +e.target.value || 1) })}
                        placeholder="H"
                        title="Custom aspect height"
                      />
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8, fontSize: '0.8rem' }}>
                    <label>
                      X (left)
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={Math.round(selected.x || 0)}
                        onChange={(e) => updateSelected({ x: Math.max(0, +e.target.value || 0) })}
                      />
                    </label>
                    <label>
                      Y (top)
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={Math.round(selected.y || 0)}
                        onChange={(e) => updateSelected({ y: Math.max(0, +e.target.value || 0) })}
                      />
                    </label>
                    <label>
                      Width
                      <input
                        type="number"
                        min={40}
                        step={1}
                        value={Math.round(selected.w || 40)}
                        onChange={(e) => updateSelected({ w: Math.max(40, +e.target.value || 40) })}
                      />
                    </label>
                    <label>
                      Height
                      <input
                        type="number"
                        min={40}
                        step={1}
                        value={Math.round(selected.h || 40)}
                        onChange={(e) => updateSelected({ h: Math.max(40, +e.target.value || 40) })}
                      />
                    </label>
                  </div>
                  <p className="hint" style={{ marginTop: 4 }}>
                    {selected.lockAspect || (selected.frameAspect && selected.frameAspect !== 'free')
                      ? 'Aspect locked — changing W or H keeps ratio from top-left.'
                      : 'Free size — W and H independent.'}
                    {selectedPhoto ? ` · Photo ${selectedPhoto.w}×${selectedPhoto.h} (original kept)` : ''}
                  </p>

                  <div className="section-title" style={{ marginTop: 10 }}>Photo caption</div>
                  <input type="text" value={selected.caption || ''} placeholder="e.g. Grandma · 1998" onChange={(e) => updateSelected({ caption: e.target.value })} />
                  <div className="toggle-row">
                    <label>Show on photo</label>
                    <div className={`toggle ${selected.showCaption ? 'on' : ''}`} onClick={() => updateSelected({ showCaption: !selected.showCaption })} role="switch" />
                  </div>
                  <label>Background</label>
                  <select value={selected.captionBg || 'gradient'} onChange={(e) => updateSelected({ captionBg: e.target.value })}>
                    <option value="gradient">Dark gradient</option>
                    <option value="solid-dark">Solid dark</option>
                    <option value="solid-light">Solid light</option>
                    <option value="pill">Pill badge</option>
                    <option value="none">None</option>
                  </select>
                  <p className="hint">Drag this photo onto another to <strong>swap</strong> them.</p>
                </div>
              )}

              <div className="control-group">
                <div className="section-title">Frame shape</div>
                <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
                  <option value="1:1">1 : 1</option>
                  <option value="4:5">4 : 5</option>
                  <option value="3:2">3 : 2</option>
                  <option value="16:9">16 : 9</option>
                  <option value="A4P">A4 Portrait</option>
                  <option value="A4L">A4 Landscape</option>
                  <option value="custom">Custom…</option>
                </select>
                {aspect === 'custom' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" min={1} value={customW} onChange={(e) => setCustomW(+e.target.value || 1)} />
                    <input type="number" min={1} value={customH} onChange={(e) => setCustomH(+e.target.value || 1)} />
                  </div>
                )}
              </div>

              <div className="control-group">
                <div className="section-title">Arrangement</div>
                <select value={layoutType} onChange={(e) => setLayoutType(e.target.value)}>
                  <option value="collage">Collage grid</option>
                  <option value="mosaic">Mosaic (mixed sizes)</option>
                  <option value="grid">Equal grid</option>
                  <option value="masonry">Masonry columns</option>
                  <option value="polaroid">Polaroid stack</option>
                  <option value="radial">Family tree (radial)</option>
                  <option value="freeform">Freeform (manual)</option>
                </select>
              </div>

              <div className="control-group">
                <div className="section-title">Keep it sharp</div>
                <div className="toggle-row">
                  <label>Smart size matching</label>
                  <div className={`toggle ${smartSize ? 'on' : ''}`} onClick={() => setSmartSize((v) => !v)} role="switch" />
                </div>
              </div>

              <div className="control-group">
                <div className="section-title">Photo density</div>
                <label>How many fit <span>{layoutScalePct}%</span></label>
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={5}
                  value={layoutScalePct}
                  onChange={(e) => onUniversalScale(+e.target.value)}
                />
                <p className="hint">
                  Lower = smaller frames and a tighter re-layout on the same canvas (room for more photos). Not an empty border. Crop on each photo is kept.
                </p>
                <div className="selected-actions" style={{ marginTop: 6 }}>
                  <button type="button" className="secondary" onClick={() => onUniversalScale(55)}>More photos 55%</button>
                  <button type="button" className="secondary" onClick={() => onUniversalScale(75)}>Balanced 75%</button>
                  <button type="button" className="secondary" onClick={() => onUniversalScale(100)}>Large 100%</button>
                </div>
              </div>

              <div className="control-group">
                <div className="section-title">Style</div>
                <label>Gap <span>{gap}px</span></label>
                <input type="range" min={0} max={24} value={gap} onChange={(e) => setGap(+e.target.value)} />
                <label>Margin <span>{margin}px</span></label>
                <input type="range" min={0} max={40} value={margin} onChange={(e) => setMargin(+e.target.value)} />
                <label>Background</label>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
              </div>

              <div className="control-group">
                <div className="section-title">Mood</div>
                <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                  <option value="none">Natural</option>
                  <option value="sepia">Vintage sepia</option>
                  <option value="warm">Warm family</option>
                  <option value="cool">Cool modern</option>
                  <option value="bw">Black & white</option>
                </select>
              </div>

              <div className="control-group">
                <div className="section-title">Collage caption</div>
                <input type="text" value={caption} placeholder="e.g. Our family · 2026" onChange={(e) => setCaption(e.target.value)} />
                <div className="toggle-row">
                  <label>Show on collage</label>
                  <div className={`toggle ${showCaption ? 'on' : ''}`} onClick={() => setShowCaption((v) => !v)} role="switch" />
                </div>
              </div>

              <div className="row-btns">
                <button type="button" className="secondary" onClick={clearAll}>Start over</button>
                <button type="button" className="secondary" onClick={() => { computeStage(); rebuild() }}>Fit view</button>
              </div>
              <p className="hint">Drag a photo onto another to <strong>swap</strong>. Full engine: <a href="./engine.html" style={{color:'var(--accent)'}}>engine.html</a></p>
            </>
          )}
        </aside>

        <div className="workspace">
          <div className="canvas-wrap" ref={wrapRef}>
            <div
              className="stage"
              style={{
                width: stageW, height: stageH, background: bgColor,
                filter:
                  theme === 'sepia' ? 'sepia(0.35) contrast(1.05)' :
                  theme === 'warm' ? 'sepia(0.15) saturate(1.15)' :
                  theme === 'cool' ? 'saturate(0.9) hue-rotate(10deg)' :
                  theme === 'bw' ? 'grayscale(1) contrast(1.1)' : undefined,
              }}
              onClick={() => setSelectedId(null)}
            >
              {!photos.length && (
                <div className="empty">
                  <div className="icon">📷</div>
                  <h3>Start your family collage</h3>
                  <p>Drop photos or use the panel.</p>
                </div>
              )}
              {cells.map((cell) => {
                const photo = photos.find((p) => p.id === cell.photoId)
                if (!photo) return null
                return (
                  <div
                    key={cell.id}
                    className={`cell ${cell.id === selectedId ? 'selected' : ''}`}
                    data-id={cell.id}
                    style={{ left: cell.x, top: cell.y, width: cell.w, height: cell.h, borderRadius: cellRadius, transform: cell.rotate ? `rotate(${cell.rotate}deg)` : undefined }}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(cell.id) }}
                    onPointerDown={(e) => onCellPointerDown(e, cell)}
                    onWheel={(e) => onCellWheel(e, cell)}
                  >
                    <img
                      src={photo.url}
                      alt={photo.name}
                      draggable={false}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        // % translate tracks frame size → crop survives resize/density change
                        transform: `translate(${(cell.oxRel != null ? cell.oxRel : (cell.ox || 0) / Math.max(1, cell.w)) * 100}%, ${(cell.oyRel != null ? cell.oyRel : (cell.oy || 0) / Math.max(1, cell.h)) * 100}%) scale(${cell.scale || 1})`,
                        transformOrigin: 'center center',
                        pointerEvents: 'none',
                      }}
                    />
                    {cell.showCaption && cell.caption && (
                      <div className={`cell-caption bg-${cell.captionBg || 'gradient'} size-${cell.captionSize || 'md'}`}>
                        {cell.caption}
                      </div>
                    )}
                  </div>
                )
              })}
              {showCaption && caption && <div className="global-caption">{caption}</div>}
            </div>
          </div>
          <div className="status-bar">
            <span>{photos.length ? `${photos.length} / ${MAX_PHOTOS} photos` : 'No photos yet'}</span>
            <span>{stageW} × {stageH} px</span>
            <span>{projectName}{status ? ` · ${status}` : ''}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
