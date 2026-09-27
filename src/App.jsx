import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { deleteProject, listProjects, loadProject, saveProject, uid } from './lib/storage'
import { qualityLabel, getAspectRatio, buildLayout } from './lib/layouts'

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
  const wrapRef = useRef(null)
  const fileRef = useRef(null)
  const dragRef = useRef(null)

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

  const rebuild = useCallback((photoList = photos, type = layoutType) => {
    const { w, h } = computeStage()
    if (!photoList.length) {
      setCells([])
      return
    }
    const prevByPhoto = {}
    cells.forEach((c) => {
      prevByPhoto[c.photoId] = {
        caption: c.caption, showCaption: c.showCaption,
        captionFont: c.captionFont, captionSize: c.captionSize, captionBg: c.captionBg,
        scale: c.scale, ox: c.ox, oy: c.oy,
      }
    })
    const enriched = photoList.map((p) => ({ ...p, ...(prevByPhoto[p.id] || {}) }))
    const next = buildLayout(type, enriched, w, h, margin, gap, smartSize)
    next.forEach((c) => {
      const prev = prevByPhoto[c.photoId]
      if (prev) {
        Object.assign(c, {
          scale: prev.scale || 1, ox: prev.ox || 0, oy: prev.oy || 0,
          caption: prev.caption || '', showCaption: !!prev.showCaption,
          captionFont: prev.captionFont || 'sans', captionSize: prev.captionSize || 'md',
          captionBg: prev.captionBg || 'gradient',
        })
      }
    })
    setCells(next)
  }, [photos, layoutType, margin, gap, smartSize, computeStage, cells])

  useEffect(() => {
    const onResize = () => computeStage()
    window.addEventListener('resize', onResize)
    computeStage()
    return () => window.removeEventListener('resize', onResize)
  }, [computeStage])

  useEffect(() => {
    rebuild()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, customW, customH, layoutType, gap, margin, smartSize, photos.length])

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
    setCells((prev) => prev.map((c) => (c.id === selectedId ? { ...c, ...patch } : c)))
  }

  // Drag frame — drop on another cell to SWAP photos
  const onCellPointerDown = (e, cell) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    setSelectedId(cell.id)
    dragRef.current = {
      id: cell.id,
      startX: e.clientX, startY: e.clientY,
      origX: cell.x, origY: cell.y,
      lastX: e.clientX, lastY: e.clientY,
    }
    const onMove = (ev) => {
      const d = dragRef.current
      if (!d) return
      d.lastX = ev.clientX
      d.lastY = ev.clientY
      const dx = ev.clientX - d.startX
      const dy = ev.clientY - d.startY
      setCells((prev) =>
        prev.map((c) =>
          c.id === d.id ? { ...c, x: Math.max(0, d.origX + dx), y: Math.max(0, d.origY + dy) } : c,
        ),
      )
    }
    const onUp = (ev) => {
      const d = dragRef.current
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (!d) return
      const x = ev.clientX ?? d.lastX
      const y = ev.clientY ?? d.lastY
      const el = document.elementFromPoint(x, y)
      const targetId = el?.closest?.('.cell')?.getAttribute?.('data-id')
      if (targetId && targetId !== d.id) {
        setCells((prev) => {
          const source = prev.find((c) => c.id === d.id)
          const target = prev.find((c) => c.id === targetId)
          if (!source || !target) return prev
          const take = (c) => ({
            photoId: c.photoId, scale: c.scale || 1, ox: c.ox || 0, oy: c.oy || 0,
            caption: c.caption || '', showCaption: !!c.showCaption,
            captionFont: c.captionFont || 'sans', captionSize: c.captionSize || 'md',
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
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
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
      ctx.drawImage(photo.img, -rw / 2 + (rw - dw) / 2 + (cell.ox || 0) * scale, -rh / 2 + (rh - dh) / 2 + (cell.oy || 0) * scale, dw, dh)
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
          <button type="button" onClick={exportPNG} disabled={!photos.length}>⬇ Save PNG</button>
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
                <button type="button" className="secondary" onClick={() => updateSelected({ scale: Math.min(5, (selected.scale || 1) + 0.15) })}>＋ Zoom</button>
                <button type="button" className="secondary" onClick={() => updateSelected({ scale: Math.max(0.5, (selected.scale || 1) - 0.15) })}>－ Zoom</button>
                <button type="button" className="secondary" onClick={() => updateSelected({ scale: 1, ox: 0, oy: 0 })}>Reset view</button>
                <button type="button" className="secondary danger" onClick={() => selectedPhoto && removePhoto(selectedPhoto.id)}>Remove</button>
              </div>
              <p className="hint">Drag this photo onto another to <strong>swap</strong> them.</p>
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
              <option value="grid">Equal grid</option>
              <option value="masonry">Masonry</option>
            </select>
          </div>
          <div className="control-group">
            <div className="section-title">Frame shape</div>
            <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
              <option value="1:1">1 : 1</option>
              <option value="4:5">4 : 5</option>
              <option value="3:2">3 : 2</option>
              <option value="16:9">16 : 9</option>
            </select>
          </div>
          <div className="row-btns">
            <button type="button" className="secondary" onClick={clearAll}>Start over</button>
          </div>
          <p className="hint">Drag a photo onto another to <strong>swap</strong>.</p>
        </aside>
        <div className="workspace">
          <div className="canvas-wrap" ref={wrapRef}>
            <div className="stage" style={{ width: stageW, height: stageH, background: bgColor }} onClick={() => setSelectedId(null)}>
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
                    style={{ left: cell.x, top: cell.y, width: cell.w, height: cell.h, borderRadius: cellRadius }}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(cell.id) }}
                    onPointerDown={(e) => onCellPointerDown(e, cell)}
                  >
                    <img src={photo.url} alt={photo.name} style={{ transform: `translate(${cell.ox || 0}px, ${cell.oy || 0}px) scale(${cell.scale || 1})`, transformOrigin: 'center center' }} />
                    {cell.showCaption && cell.caption && (
                      <div className={`cell-caption bg-${cell.captionBg || 'gradient'} size-${cell.captionSize || 'md'}`}>{cell.caption}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="status-bar">
            <span>{photos.length ? `${photos.length} / ${MAX_PHOTOS} photos` : 'No photos yet'}</span>
            <span>{stageW} × {stageH} px</span>
          </div>
        </div>
      </div>
    </div>
  )
}
