import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { deleteProject, listProjects, loadProject, saveProject, uid } from './lib/storage'

const MAX_PHOTOS = 30

function qualityLabel(pixels) {
  if (pixels >= 2_000_000) return 'HIGH'
  if (pixels >= 600_000) return 'MED'
  return 'LOW'
}

function getAspectRatio(aspect, customW, customH) {
  if (aspect === 'custom') return Math.max(1, customW) / Math.max(1, customH)
  const map = {
    '1:1': 1, '4:5': 4 / 5, '3:2': 3 / 2, '16:9': 16 / 9,
    A4P: 210 / 297, A4L: 297 / 210, '5:7': 5 / 7,
  }
  return map[aspect] || 1
}

function orderedPhotos(photos, smartSize) {
  if (!smartSize) return photos.slice()
  return photos.slice().sort((a, b) => b.pixels - a.pixels)
}

function layoutGrid(photos, iw, ih, margin, gap, smartSize) {
  const n = photos.length
  if (!n) return []
  const ordered = orderedPhotos(photos, smartSize)
  const cols = Math.ceil(Math.sqrt(n * (iw / ih)))
  const rows = Math.ceil(n / cols)
  const cellW = (iw - gap * (cols - 1)) / cols
  const cellH = (ih - gap * (rows - 1)) / rows
  return ordered.map((p, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      id: uid(),
      photoId: p.id,
      x: margin + col * (cellW + gap),
      y: margin + row * (cellH + gap),
      w: cellW,
      h: cellH,
      scale: 1, ox: 0, oy: 0,
      caption: p.caption || '',
      showCaption: !!p.showCaption,
      captionFont: p.captionFont || 'sans',
      captionSize: p.captionSize || 'md',
      captionBg: p.captionBg || 'gradient',
    }
  })
}

function layoutCollage(photos, iw, ih, margin, gap, smartSize) {
  const n = photos.length
  if (!n) return []
  const ordered = orderedPhotos(photos, smartSize)
  const stageRatio = iw / ih
  let cols = Math.round(Math.sqrt(n * stageRatio))
  cols = Math.max(2, Math.min(6, cols))
  if (n <= 4) cols = Math.min(cols, 2)
  if (n <= 6) cols = Math.min(cols, 3)
  const colW = (iw - gap * (cols - 1)) / cols
  const colBottoms = new Array(cols).fill(0)
  const result = []
  ordered.forEach((p, idx) => {
    const span = (smartSize && p.pixels > 2e6 && idx < n * 0.35) ? Math.min(2, cols) : 1
    let bestCol = 0
    let bestY = Infinity
    for (let c = 0; c <= cols - span; c++) {
      let y = 0
      for (let k = 0; k < span; k++) y = Math.max(y, colBottoms[c + k])
      if (y < bestY) { bestY = y; bestCol = c }
    }
    const photoRatio = p.w / Math.max(1, p.h)
    let cellH = (colW * span + gap * (span - 1)) / Math.max(0.6, Math.min(1.8, photoRatio))
    if (smartSize && p.pixels > 2.5e6) cellH *= 1.15
    cellH = Math.max(60, Math.min(ih * 0.55, cellH))
    if (bestY + cellH > ih) cellH = Math.max(50, ih - bestY)
    const cellW = colW * span + gap * (span - 1)
    result.push({
      id: uid(),
      photoId: p.id,
      x: margin + bestCol * (colW + gap),
      y: margin + bestY,
      w: cellW,
      h: cellH,
      scale: 1, ox: 0, oy: 0,
      caption: p.caption || '',
      showCaption: !!p.showCaption,
      captionFont: p.captionFont || 'sans',
      captionSize: p.captionSize || 'md',
      captionBg: p.captionBg || 'gradient',
    })
    for (let k = 0; k < span; k++) colBottoms[bestCol + k] = bestY + cellH + gap
  })
  return result
}

function layoutMasonry(photos, iw, ih, margin, gap, smartSize) {
  const n = photos.length
  if (!n) return []
  const ordered = orderedPhotos(photos, smartSize)
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(n))))
  const colW = (iw - gap * (cols - 1)) / cols
  const colH = new Array(cols).fill(0)
  return ordered.map((p) => {
    let shortest = 0
    for (let c = 1; c < cols; c++) if (colH[c] < colH[shortest]) shortest = c
    const photoRatio = p.w / Math.max(1, p.h)
    const baseH = colW / photoRatio
    const scale = smartSize ? Math.min(1.6, Math.max(0.6, Math.sqrt(p.pixels / 1e6))) : 1
    const ch = Math.min(ih * 0.55, Math.max(50, baseH * scale))
    const cell = {
      id: uid(),
      photoId: p.id,
      x: margin + shortest * (colW + gap),
      y: margin + colH[shortest],
      w: colW,
      h: ch,
      scale: 1, ox: 0, oy: 0,
      caption: p.caption || '',
      showCaption: !!p.showCaption,
      captionFont: p.captionFont || 'sans',
      captionSize: p.captionSize || 'md',
      captionBg: p.captionBg || 'gradient',
    }
    colH[shortest] += ch + gap
    return cell
  })
}

function buildLayout(type, photos, stageW, stageH, margin, gap, smartSize) {
  const iw = stageW - margin * 2
  const ih = stageH - margin * 2
  if (type === 'grid') return layoutGrid(photos, iw, ih, margin, gap, smartSize)
  if (type === 'masonry') return layoutMasonry(photos, iw, ih, margin, gap, smartSize)
  return layoutCollage(photos, iw, ih, margin, gap, smartSize)
}

export default function App() {
  const [view, setView] = useState('studio') // studio | projects
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

  const selected = useMemo(
    () => cells.find((c) => c.id === selectedId) || null,
    [cells, selectedId],
  )
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
    // Preserve captions from previous cells by photoId
    const prevByPhoto = {}
    cells.forEach((c) => {
      prevByPhoto[c.photoId] = {
        caption: c.caption,
        showCaption: c.showCaption,
        captionFont: c.captionFont,
        captionSize: c.captionSize,
        captionBg: c.captionBg,
        scale: c.scale,
        ox: c.ox,
        oy: c.oy,
      }
    })
    const enriched = photoList.map((p) => ({
      ...p,
      ...(prevByPhoto[p.id] || {}),
    }))
    const next = buildLayout(type, enriched, w, h, margin, gap, smartSize)
    // re-apply crop if we had it
    next.forEach((c) => {
      const prev = prevByPhoto[c.photoId]
      if (prev) {
        c.scale = prev.scale || 1
        c.ox = prev.ox || 0
        c.oy = prev.oy || 0
        c.caption = prev.caption || ''
        c.showCaption = !!prev.showCaption
        c.captionFont = prev.captionFont || 'sans'
        c.captionSize = prev.captionSize || 'md'
        c.captionBg = prev.captionBg || 'gradient'
      }
    })
    setCells(next)
  }, [photos, layoutType, margin, gap, smartSize, computeStage, cells])

  useEffect(() => {
    const onResize = () => {
      computeStage()
    }
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
    if (remaining <= 0) {
      alert('Maximum 30 photos reached.')
      return
    }
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/')).slice(0, remaining)
    if (!files.length) return
    let loaded = 0
    const next = []
    files.forEach((file) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        next.push({
          id: uid(),
          url,
          img,
          w: img.naturalWidth,
          h: img.naturalHeight,
          pixels: img.naturalWidth * img.naturalHeight,
          name: file.name,
        })
        loaded++
        if (loaded === files.length) {
          setPhotos((prev) => [...prev, ...next])
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        loaded++
        if (loaded === files.length && next.length) {
          setPhotos((prev) => [...prev, ...next])
        }
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
      if (imgRatio > cellRatio) {
        dh = rh
        dw = dh * imgRatio
      } else {
        dw = rw
        dh = dw / imgRatio
      }
      const sc = cell.scale || 1
      dw *= sc
      dh *= sc
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
        if (bg === 'gradient' || bg === 'solid-dark') {
          if (bg === 'gradient') {
            const g = ctx.createLinearGradient(0, rh / 2 - 40 * scale, 0, rh / 2)
            g.addColorStop(0, 'rgba(0,0,0,0)')
            g.addColorStop(1, 'rgba(0,0,0,0.72)')
            ctx.fillStyle = g
          } else {
            ctx.fillStyle = 'rgba(0,0,0,0.7)'
          }
          ctx.fillRect(-rw / 2, rh / 2 - (bg === 'gradient' ? 44 : 28) * scale, rw, (bg === 'gradient' ? 44 : 28) * scale)
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
        const ctx = c.getContext('2d')
        ctx.drawImage(photo.img, 0, 0)
        resolve(c.toDataURL('image/jpeg', 0.85))
      } catch {
        resolve(null)
      }
    })

  const handleSaveProject = async () => {
    const name = projectName.trim() || 'My collage'
    const id = projectId || uid()
    setStatus('Saving…')
    try {
      const photoData = []
      for (const p of photos) {
        const dataUrl = await photoToDataURL(p)
        photoData.push({
          id: p.id,
          name: p.name,
          w: p.w,
          h: p.h,
          pixels: p.pixels,
          dataUrl,
        })
      }
      const payload = {
        id,
        name,
        photoCount: photos.length,
        updatedAt: Date.now(),
        settings: {
          aspect, customW, customH, layoutType, smartSize, gap, margin,
          cellRadius, bgColor, theme, caption, showCaption,
        },
        cells: cells.map((c) => ({
          photoId: c.photoId,
          x: c.x, y: c.y, w: c.w, h: c.h,
          scale: c.scale, ox: c.ox, oy: c.oy,
          caption: c.caption, showCaption: c.showCaption,
          captionFont: c.captionFont, captionSize: c.captionSize, captionBg: c.captionBg,
        })),
        photos: photoData,
      }
      await saveProject(payload)
      setProjectId(id)
      setProjectName(name)
      const list = await listProjects()
      setProjects(list)
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
        await new Promise((res, rej) => {
          img.onload = res
          img.onerror = rej
          img.src = p.dataUrl
        })
        loadedPhotos.push({
          id: p.id,
          url: p.dataUrl,
          img,
          w: p.w || img.naturalWidth,
          h: p.h || img.naturalHeight,
          pixels: p.pixels || img.naturalWidth * img.naturalHeight,
          name: p.name || 'photo',
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
      // restore cells after photos settle
      setTimeout(() => {
        if (data.cells?.length) {
          setCells(data.cells.map((c) => ({ ...c, id: uid() })))
        } else {
          rebuild(loadedPhotos, s.layoutType || 'collage')
        }
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

  // Drag cells
  const onCellPointerDown = (e, cell) => {
    if (e.button !== 0) return
    e.preventDefault()
    setSelectedId(cell.id)
    dragRef.current = {
      id: cell.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: cell.x,
      origY: cell.y,
    }
    const onMove = (ev) => {
      const d = dragRef.current
      if (!d) return
      const dx = ev.clientX - d.startX
      const dy = ev.clientY - d.startY
      setCells((prev) =>
        prev.map((c) =>
          c.id === d.id
            ? { ...c, x: Math.max(0, d.origX + dx), y: Math.max(0, d.origY + dy) }
            : c,
        ),
      )
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const themeClass = theme === 'none' ? '' : `theme-${theme}`

  return (
    <div className={`app ${themeClass}`}>
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
          <button type="button" className="secondary" onClick={() => rebuild()} disabled={!photos.length}>
            ↻ Surprise me
          </button>
          <button type="button" onClick={handleSaveProject} disabled={!photos.length}>
            💾 Save project
          </button>
          <button type="button" onClick={exportPNG} disabled={!photos.length}>
            ⬇ Save PNG
          </button>
          <button type="button" className="secondary" onClick={() => window.print()} disabled={!photos.length}>
            🖨 Print
          </button>
        </div>
      </header>

      <div className="main">
        <aside className="sidebar">
          {view === 'projects' ? (
            <div className="control-group">
              <div className="section-title">Projects</div>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name"
              />
              <div className="row-btns">
                <button type="button" onClick={handleNewProject}>New</button>
                <button type="button" className="secondary" onClick={handleSaveProject} disabled={!photos.length}>
                  Save
                </button>
              </div>
              <div className="project-list">
                {projects.length === 0 && (
                  <p className="hint">No saved projects yet. Create a collage and hit Save.</p>
                )}
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className={`project-item ${p.id === projectId ? 'active' : ''}`}
                    onClick={() => handleLoadProject(p.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div>
                      <div className="name">{p.name}</div>
                      <div className="meta">
                        {p.photoCount || 0} photos · {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : ''}
                      </div>
                    </div>
                    <button type="button" className="del" onClick={(e) => handleDeleteProject(p.id, e)} title="Delete">
                      ×
                    </button>
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
                  onDrop={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('dragover')
                    loadFiles(e.dataTransfer.files)
                  }}
                >
                  <strong>Drop family photos here</strong>
                  <p>or click · up to {MAX_PHOTOS} · JPG / PNG / WEBP</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      loadFiles(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </div>
                <div className="photo-list">
                  {photos.map((p) => (
                    <div key={p.id} className="photo-item">
                      <img src={p.url} alt="" />
                      <div className="meta" title={p.name}>{p.name} · {qualityLabel(p.pixels)}</div>
                      <button type="button" onClick={() => removePhoto(p.id)} title="Remove">×</button>
                    </div>
                  ))}
                </div>
              </div>

              {selected && (
                <div className="control-group">
                  <div className="section-title">Selected photo</div>
                  <div className="selected-actions">
                    <button type="button" className="secondary" onClick={() => updateSelected({ scale: Math.min(5, (selected.scale || 1) + 0.15) })}>
                      ＋ Zoom
                    </button>
                    <button type="button" className="secondary" onClick={() => updateSelected({ scale: Math.max(0.5, (selected.scale || 1) - 0.15) })}>
                      － Zoom
                    </button>
                    <button type="button" className="secondary" onClick={() => updateSelected({ scale: 1, ox: 0, oy: 0 })}>
                      Reset view
                    </button>
                    <button type="button" className="secondary danger" onClick={() => selectedPhoto && removePhoto(selectedPhoto.id)}>
                      Remove
                    </button>
                  </div>
                  <div className="section-title" style={{ marginTop: 10 }}>Photo caption</div>
                  <input
                    type="text"
                    value={selected.caption || ''}
                    placeholder="e.g. Grandma · 1998"
                    onChange={(e) => updateSelected({ caption: e.target.value })}
                  />
                  <div className="toggle-row">
                    <label>Show on photo</label>
                    <div
                      className={`toggle ${selected.showCaption ? 'on' : ''}`}
                      onClick={() => updateSelected({ showCaption: !selected.showCaption })}
                      role="switch"
                      aria-checked={!!selected.showCaption}
                    />
                  </div>
                  <label>Background</label>
                  <select
                    value={selected.captionBg || 'gradient'}
                    onChange={(e) => updateSelected({ captionBg: e.target.value })}
                  >
                    <option value="gradient">Dark gradient</option>
                    <option value="solid-dark">Solid dark</option>
                    <option value="solid-light">Solid light</option>
                    <option value="pill">Pill badge</option>
                    <option value="none">None</option>
                  </select>
                  <label>Size</label>
                  <select
                    value={selected.captionSize || 'md'}
                    onChange={(e) => updateSelected({ captionSize: e.target.value })}
                  >
                    <option value="sm">Small</option>
                    <option value="md">Medium</option>
                    <option value="lg">Large</option>
                  </select>
                </div>
              )}

              <div className="control-group">
                <div className="section-title">Frame shape</div>
                <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
                  <option value="1:1">1 : 1 (Square)</option>
                  <option value="4:5">4 : 5 (Portrait)</option>
                  <option value="3:2">3 : 2 (Classic)</option>
                  <option value="16:9">16 : 9 (Wide)</option>
                  <option value="A4P">A4 Portrait</option>
                  <option value="A4L">A4 Landscape</option>
                  <option value="5:7">5 × 7</option>
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
                  <option value="grid">Equal grid</option>
                  <option value="masonry">Masonry columns</option>
                </select>
              </div>

              <div className="control-group">
                <div className="section-title">Keep it sharp</div>
                <div className="toggle-row">
                  <label>Smart size matching</label>
                  <div
                    className={`toggle ${smartSize ? 'on' : ''}`}
                    onClick={() => setSmartSize((v) => !v)}
                    role="switch"
                    aria-checked={smartSize}
                  />
                </div>
              </div>

              <div className="control-group">
                <div className="section-title">Spacing & style</div>
                <label>Gap <span>{gap}px</span></label>
                <input type="range" min={0} max={24} value={gap} onChange={(e) => setGap(+e.target.value)} />
                <label>Margin <span>{margin}px</span></label>
                <input type="range" min={0} max={40} value={margin} onChange={(e) => setMargin(+e.target.value)} />
                <label>Corner radius <span>{cellRadius}px</span></label>
                <input type="range" min={0} max={20} value={cellRadius} onChange={(e) => setCellRadius(+e.target.value)} />
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
                <input
                  type="text"
                  value={caption}
                  placeholder="e.g. Our family · 2026"
                  onChange={(e) => setCaption(e.target.value)}
                />
                <div className="toggle-row">
                  <label>Show on collage</label>
                  <div
                    className={`toggle ${showCaption ? 'on' : ''}`}
                    onClick={() => setShowCaption((v) => !v)}
                    role="switch"
                    aria-checked={showCaption}
                  />
                </div>
              </div>

              <div className="row-btns">
                <button type="button" className="secondary" onClick={clearAll}>Start over</button>
                <button type="button" className="secondary" onClick={() => { computeStage(); rebuild() }}>Fit view</button>
              </div>
              <p className="hint">
                Tip: open <strong>Projects</strong> to create & load saved collages. Full engine (grid coords, pan mode, restore crop) is also in{' '}
                <a href="./standalone.html" style={{ color: 'var(--accent)' }}>standalone.html</a>.
              </p>
            </>
          )}
        </aside>

        <div className="workspace">
          <div className="canvas-wrap" ref={wrapRef}>
            <div
              className="stage"
              style={{
                width: stageW,
                height: stageH,
                background: bgColor,
                filter:
                  theme === 'sepia' ? 'sepia(0.35) contrast(1.05)' :
                  theme === 'warm' ? 'sepia(0.15) saturate(1.15) brightness(1.02)' :
                  theme === 'cool' ? 'saturate(0.9) hue-rotate(10deg)' :
                  theme === 'bw' ? 'grayscale(1) contrast(1.1)' : undefined,
              }}
              onClick={() => setSelectedId(null)}
            >
              {!photos.length && (
                <div className="empty">
                  <div className="icon">📷</div>
                  <h3>Start your family collage</h3>
                  <p>Drop photos or use the panel — we&apos;ll arrange them for you.</p>
                </div>
              )}
              {cells.map((cell) => {
                const photo = photos.find((p) => p.id === cell.photoId)
                if (!photo) return null
                return (
                  <div
                    key={cell.id}
                    className={`cell ${cell.id === selectedId ? 'selected' : ''}`}
                    style={{
                      left: cell.x,
                      top: cell.y,
                      width: cell.w,
                      height: cell.h,
                      borderRadius: cellRadius,
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(cell.id) }}
                    onPointerDown={(e) => onCellPointerDown(e, cell)}
                  >
                    <img
                      src={photo.url}
                      alt={photo.name}
                      style={{
                        transform: `translate(${cell.ox || 0}px, ${cell.oy || 0}px) scale(${cell.scale || 1})`,
                        transformOrigin: 'center center',
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
              {showCaption && caption && (
                <div className="global-caption">{caption}</div>
              )}
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
