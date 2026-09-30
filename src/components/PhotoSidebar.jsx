import { qualityLabel } from '../lib/layouts'
import { FRAME_ASPECT_OPTIONS } from '../lib/frameAspect'
import { MAX_PHOTOS } from '../hooks/useCollageEngine'

export default function PhotoSidebar({
  fileRef, photos, loadFiles, removePhoto, clearAll,
  selected, selectedPhoto, panMode, setPanMode, updateSelected,
  zoomSelected, restoreCrop, replaceSelected,
  aspect, setAspect, customW, setCustomW, customH, setCustomH,
  layoutType, setLayoutType, smartSize, setSmartSize,
  layoutScalePct, setLayoutScalePct,
  bgColor, setBgColor, theme, setTheme, cellRadius, setCellRadius,
  caption, setCaption, showCaption, setShowCaption,
}) {
  return (
    <>
      <div className="control-group">
        <div className="section-title">Our photos</div>
        <div
          className="upload-zone"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragover') }}
          onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
          onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); loadFiles(e.dataTransfer.files) }}
          role="button"
          tabIndex={0}
          aria-label="Upload photos"
        >
          <strong>Drop family photos here</strong>
          <p>or click · up to {MAX_PHOTOS}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => { loadFiles(e.target.files); e.target.value = '' }}
          />
        </div>
        <div className="photo-list">
          {photos.map((p) => (
            <div key={p.id} className="photo-item">
              <img src={p.url} alt="" />
              <div className="meta">{p.name} · {qualityLabel(p.pixels)}</div>
              <button type="button" aria-label="Remove photo" onClick={() => removePhoto(p.id)}>×</button>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="control-group selected-card">
          <div className="section-title">Selected frame</div>
          <div className="selected-actions">
            <button type="button" className={`secondary ${panMode ? 'on' : ''}`} onClick={() => setPanMode((v) => !v)} aria-pressed={panMode}>
              {panMode ? 'Moving…' : 'Move photo'}
            </button>
            <button type="button" className="secondary" onClick={() => updateSelected({ rotate: ((selected.rotate || 0) + 90) % 360 })}>Rotate</button>
            <button type="button" className="secondary" onClick={() => zoomSelected(0.15)}>＋ Zoom</button>
            <button type="button" className="secondary" onClick={() => zoomSelected(-0.15)}>－ Zoom</button>
            <button type="button" className="secondary" onClick={restoreCrop}>Restore crop</button>
            <button type="button" className="secondary" onClick={() => updateSelected({ scale: 1, ox: 0, oy: 0, oxRel: 0, oyRel: 0 })}>Reset view</button>
            <button type="button" className="secondary" onClick={replaceSelected}>Replace</button>
            <button type="button" className="secondary danger" onClick={() => selectedPhoto && removePhoto(selectedPhoto.id)}>Remove</button>
          </div>
          <p className="hint">Drag onto another to <strong>swap</strong>. Move / wheel = crop. Scale ≥ 1 keeps the frame full.</p>

          <div className="section-title tight">Frame size &amp; position</div>
          <label>Frame aspect</label>
          <select value={selected.frameAspect || 'free'} onChange={(e) => updateSelected({ frameAspect: e.target.value })}>
            {FRAME_ASPECT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {(selected.frameAspect || 'free') === 'custom' && (
            <div className="inline-pair">
              <input type="number" min={1} value={selected.frameAspectW ?? 1} onChange={(e) => updateSelected({ frameAspectW: Math.max(1, +e.target.value || 1) })} title="Aspect W" />
              <span className="pair-sep">:</span>
              <input type="number" min={1} value={selected.frameAspectH ?? 1} onChange={(e) => updateSelected({ frameAspectH: Math.max(1, +e.target.value || 1) })} title="Aspect H" />
            </div>
          )}
          <div className="geom-grid">
            <label>X<input type="number" min={0} value={Math.round(selected.x || 0)} onChange={(e) => updateSelected({ x: Math.max(0, +e.target.value || 0) })} /></label>
            <label>Y<input type="number" min={0} value={Math.round(selected.y || 0)} onChange={(e) => updateSelected({ y: Math.max(0, +e.target.value || 0) })} /></label>
            <label>W<input type="number" min={40} value={Math.round(selected.w || 40)} onChange={(e) => updateSelected({ w: Math.max(40, +e.target.value || 40) })} /></label>
            <label>H<input type="number" min={40} value={Math.round(selected.h || 40)} onChange={(e) => updateSelected({ h: Math.max(40, +e.target.value || 40) })} /></label>
          </div>
          <p className="hint">
            {selected.lockAspect || (selected.frameAspect && selected.frameAspect !== 'free')
              ? 'Aspect locked — W/H keep ratio from top-left.'
              : 'Free size — W and H independent.'}
            {selectedPhoto ? ` · Original ${selectedPhoto.w}×${selectedPhoto.h}` : ''}
          </p>

          <div className="section-title tight">Caption</div>
          <input type="text" value={selected.caption || ''} placeholder="e.g. Grandma · 1998" onChange={(e) => updateSelected({ caption: e.target.value })} />
          <div className="toggle-row">
            <label>Show on photo</label>
            <div className={`toggle ${selected.showCaption ? 'on' : ''}`} onClick={() => updateSelected({ showCaption: !selected.showCaption })} role="switch" aria-checked={!!selected.showCaption} />
          </div>
          <select value={selected.captionBg || 'gradient'} onChange={(e) => updateSelected({ captionBg: e.target.value })} aria-label="Caption background">
            <option value="gradient">Dark gradient</option>
            <option value="solid-dark">Solid dark</option>
            <option value="solid-light">Solid light</option>
            <option value="pill">Pill badge</option>
            <option value="none">None</option>
          </select>
        </div>
      )}

      <details className="panel-details" open>
        <summary className="section-title">Layout</summary>
        <div className="control-group">
          <label>Canvas shape</label>
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
            <div className="inline-pair">
              <input type="number" min={1} value={customW} onChange={(e) => setCustomW(+e.target.value || 1)} />
              <input type="number" min={1} value={customH} onChange={(e) => setCustomH(+e.target.value || 1)} />
            </div>
          )}
          <label>Arrangement</label>
          <select value={layoutType} onChange={(e) => setLayoutType(e.target.value)}>
            <option value="collage">Collage grid</option>
            <option value="mosaic">Mosaic</option>
            <option value="grid">Equal grid</option>
            <option value="masonry">Masonry</option>
            <option value="polaroid">Polaroid</option>
            <option value="radial">Radial</option>
            <option value="freeform">Freeform</option>
          </select>
          <div className="toggle-row">
            <label>Smart size match</label>
            <div className={`toggle ${smartSize ? 'on' : ''}`} onClick={() => setSmartSize((v) => !v)} role="switch" aria-checked={smartSize} />
          </div>
          <label>Density <span>{layoutScalePct}%</span></label>
          <input type="range" min={50} max={100} step={5} value={layoutScalePct} onChange={(e) => setLayoutScalePct(+e.target.value)} />
          <div className="selected-actions">
            <button type="button" className="secondary" onClick={() => setLayoutScalePct(55)}>55%</button>
            <button type="button" className="secondary" onClick={() => setLayoutScalePct(75)}>75%</button>
            <button type="button" className="secondary" onClick={() => setLayoutScalePct(100)}>100%</button>
          </div>
        </div>
      </details>

      <details className="panel-details">
        <summary className="section-title">Style</summary>
        <div className="control-group">
          <label>Background</label>
          <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
          <label>Corner radius <span>{cellRadius}px</span></label>
          <input type="range" min={0} max={24} value={cellRadius} onChange={(e) => setCellRadius(+e.target.value)} />
          <label>Mood</label>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="none">Natural</option>
            <option value="bw">Black &amp; white</option>
            <option value="warm">Warm</option>
            <option value="cool">Cool</option>
          </select>
          <label>Collage caption</label>
          <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Optional title on export" />
          <div className="toggle-row">
            <label>Show collage caption</label>
            <div className={`toggle ${showCaption ? 'on' : ''}`} onClick={() => setShowCaption((v) => !v)} role="switch" aria-checked={showCaption} />
          </div>
        </div>
      </details>

      <div className="row-btns">
        <button type="button" className="secondary" onClick={clearAll} disabled={!photos.length}>Start over</button>
      </div>
    </>
  )
}
