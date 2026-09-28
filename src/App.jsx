import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { deleteProject, listProjects, loadProject, saveProject, uid } from './lib/storage'
import { qualityLabel, getAspectRatio, buildLayout } from './lib/layouts'
import { beginCellDrag } from './lib/dragSwap'
import { applyCropMemory, cropFromCell, saveCropToMemory } from './lib/crop'

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
        ...crop,
      }
      cropMemory.current.set(c.photoId, crop)
    })
    const enriched = photoList.map((p) => ({ ...p, ...(prevByPhoto[p.id] || {}) }))
    // Lower density = denser re-layout (more photos on same canvas), not empty border
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
        let next = { ...c, ...patch }
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
        return next
      }),
    )
  }

  const onUniversalScale = (pct) => setLayoutScalePct(pct)

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
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        ctx.fillRect(-rw / 2, rh / 2 - 28 * scale, rw, 28 * scale)
        ctx.fillStyle = '#fff'
        ctx.font = `600 ${14 * scale}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(cell.caption, 0, rh / 2 - 14 * scale, rw - 16 * scale)
      }
      ctx.restore()
    })
    const link = document.createElement('a')
    link.download = `${projectName || 'family-collage'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
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

  return (
    <div className={`app ${theme === 'none' ? '' : `theme-${theme}`}`}>
      <header className="app-header">
        <h1><span className="logo">🖼️</span> Family <span className="brand">Frame</span> <span className="tagline">for us</span></h1>
        <div className="header-actions">
          <button type="button" className="secondary" onClick={() => setView(view === 'projects' ? 'studio' : 'projects')}>{view === 'projects' ? '← Studio' : 'Projects'}</button>
          <button type="button" className="secondary" onClick={() => rebuild()} disabled={!photos.length}>↻ Surprise me</button>
          <button type="button" onClick={exportPNG} disabled={!photos.length}>⬇ Save PNG</button>
          <button type="button" className="secondary" onClick={() => window.print()} disabled={!photos.length}>🖨 Print</button>
        </div>
      </header>
      <div className="main">
        <aside className="sidebar">
          <div>
            <div className="section-title">Our photos</div>
            <div className="upload-zone" onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragover') }}
              onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); loadFiles(e.dataTransfer.files) }}>
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
                <button type="button" className={`secondary ${panMode ? 'on' : ''}`} onClick={() => setPanMode((v) => !v)}>{panMode ? 'Moving photo…' : 'Move photo'}</button>
                <button type="button" className="secondary" onClick={() => updateSelected({ rotate: ((selected.rotate || 0) + 90) % 360 })}>Rotate</button>
                <button type="button" className="secondary" onClick={() => { saveCropToMemory(selected, cropMemory); updateSelected({ scale: Math.min(5, (selected.scale || 1) + 0.15) }) }}>＋ Zoom</button>
                <button type="button" className="secondary" onClick={() => { saveCropToMemory(selected, cropMemory); updateSelected({ scale: Math.max(0.5, (selected.scale || 1) - 0.15) }) }}>－ Zoom</button>
                <button type="button" className="secondary" onClick={() => {
                  const mem = cropMemory.current.get(selected.photoId)
                  if (!mem) return
                  const w = Math.max(1, selected.w)
                  const h = Math.max(1, selected.h)
                  const oxRel = mem.oxRel != null ? mem.oxRel : (mem.ox || 0) / w
                  const oyRel = mem.oyRel != null ? mem.oyRel : (mem.oy || 0) / h
                  updateSelected({ scale: mem.scale || 1, oxRel, oyRel, ox: oxRel * w, oy: oyRel * h })
                }}>Restore crop</button>
                <button type="button" className="secondary" onClick={() => updateSelected({ scale: 1, ox: 0, oy: 0, oxRel: 0, oyRel: 0 })}>Reset view</button>
                <button type="button" className="secondary" onClick={replaceSelected}>Replace</button>
                <button type="button" className="secondary danger" onClick={() => selectedPhoto && removePhoto(selectedPhoto.id)}>Remove</button>
              </div>
              <p className="hint">Drag onto another to <strong>swap</strong>. Move photo / wheel = crop. Restore crop keeps faces after layout change.</p>
              <input type="text" value={selected.caption || ''} placeholder="Caption" onChange={(e) => updateSelected({ caption: e.target.value })} />
              <div className="toggle-row">
                <label>Show on photo</label>
                <div className={`toggle ${selected.showCaption ? 'on' : ''}`} onClick={() => updateSelected({ showCaption: !selected.showCaption })} role="switch" />
              </div>
            </div>
          )}
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
            <div className="section-title">Frame shape</div>
            <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
              <option value="1:1">1 : 1</option>
              <option value="4:5">4 : 5</option>
              <option value="3:2">3 : 2</option>
              <option value="16:9">16 : 9</option>
              <option value="A4P">A4 Portrait</option>
              <option value="A4L">A4 Landscape</option>
            </select>
          </div>
          <div className="control-group">
            <div className="toggle-row">
              <label>Smart size matching</label>
              <div className={`toggle ${smartSize ? 'on' : ''}`} onClick={() => setSmartSize((v) => !v)} role="switch" />
            </div>
          </div>
          <div className="control-group">
            <div className="section-title">Photo density</div>
            <label>How many fit <span>{layoutScalePct}%</span></label>
            <input type="range" min={50} max={100} step={5} value={layoutScalePct} onChange={(e) => onUniversalScale(+e.target.value)} />
            <p className="hint">Lower = smaller frames + re-shuffle so more photos fit the same canvas (not an empty border).</p>
            <div className="selected-actions" style={{ marginTop: 6 }}>
              <button type="button" className="secondary" onClick={() => onUniversalScale(55)}>More photos 55%</button>
              <button type="button" className="secondary" onClick={() => onUniversalScale(75)}>Balanced 75%</button>
              <button type="button" className="secondary" onClick={() => onUniversalScale(100)}>Large 100%</button>
            </div>
          </div>
          <div className="row-btns">
            <button type="button" className="secondary" onClick={clearAll}>Start over</button>
          </div>
        </aside>
        <div className="workspace">
          <div className="canvas-wrap" ref={wrapRef}>
            <div className="stage" style={{ width: stageW, height: stageH, background: bgColor }} onClick={() => setSelectedId(null)}>
              {!photos.length && (<div className="empty"><div className="icon">📷</div><h3>Start your family collage</h3><p>Drop photos or use the panel.</p></div>)}
              {cells.map((cell) => {
                const photo = photos.find((p) => p.id === cell.photoId)
                if (!photo) return null
                const oxR = cell.oxRel != null ? cell.oxRel : (cell.ox || 0) / Math.max(1, cell.w)
                const oyR = cell.oyRel != null ? cell.oyRel : (cell.oy || 0) / Math.max(1, cell.h)
                return (
                  <div key={cell.id} className={`cell ${cell.id === selectedId ? 'selected' : ''}`} data-id={cell.id}
                    style={{ left: cell.x, top: cell.y, width: cell.w, height: cell.h, borderRadius: cellRadius, transform: cell.rotate ? `rotate(${cell.rotate}deg)` : undefined }}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(cell.id) }}
                    onPointerDown={(e) => onCellPointerDown(e, cell)}
                    onWheel={(e) => onCellWheel(e, cell)}>
                    <img src={photo.url} alt={photo.name} draggable={false}
                      style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                        transform: `translate(${oxR * 100}%, ${oyR * 100}%) scale(${cell.scale || 1})`,
                        transformOrigin: 'center center', pointerEvents: 'none',
                      }} />
                    {cell.showCaption && cell.caption && (<div className={`cell-caption bg-${cell.captionBg || 'gradient'} size-${cell.captionSize || 'md'}`}>{cell.caption}</div>)}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="status-bar">
            <span>{photos.length ? `${photos.length} / ${MAX_PHOTOS} photos` : 'No photos yet'}</span>
            <span>{stageW} × {stageH} px · density {layoutScalePct}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
