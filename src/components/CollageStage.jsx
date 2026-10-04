import { imageStyleForCell } from '../lib/crop'

export default function CollageStage({
  wrapRef, stageW, stageH, bgColor, photos, cells, selectedId, setSelectedId,
  cellRadius, onCellPointerDown, onCellWheel, showCaption, caption, panMode,
  viewZoom = 1, setCanvasZoom, zoomCanvasBy,
}) {
  return (
    <div className="workspace">
      <div className="canvas-wrap" ref={wrapRef}>
        <div
          className="stage-scale"
          style={{ width: stageW * viewZoom, height: stageH * viewZoom }}
        >
        <div
          className="stage"
          style={{
            width: stageW,
            height: stageH,
            background: bgColor,
            transform: `scale(${viewZoom})`,
            transformOrigin: 'top left',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null)
          }}
          role="img"
          aria-label="Collage canvas"
        >
          {!photos.length && (
            <div className="empty">
              <div className="icon" aria-hidden>📷</div>
              <h3>Start your family collage</h3>
              <p>Drop photos in the panel or open Tools on mobile.</p>
            </div>
          )}
          {cells.map((cell) => {
            const photo = photos.find((p) => p.id === cell.photoId)
            if (!photo) return null
            return (
              <div
                key={cell.id}
                className={`cell ${cell.id === selectedId ? 'selected' : ''} ${panMode && cell.id === selectedId ? 'frame-mode-active' : ''}`}
                data-id={cell.id}
                style={{
                  left: cell.x,
                  top: cell.y,
                  width: cell.w,
                  height: cell.h,
                  borderRadius: cellRadius,
                  transform: cell.rotate ? `rotate(${cell.rotate}deg)` : undefined,
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedId(cell.id)
                }}
                onPointerDown={(e) => {
                  const wrap = wrapRef?.current
                  const st = wrap ? wrap.scrollTop : 0
                  const sl = wrap ? wrap.scrollLeft : 0
                  onCellPointerDown(e, cell)
                  const restore = () => {
                    if (!wrap) return
                    wrap.scrollTop = st
                    wrap.scrollLeft = sl
                  }
                  restore()
                  requestAnimationFrame(restore)
                  setTimeout(restore, 0)
                }}
                onFocus={(e) => {
                  const wrap = wrapRef?.current
                  if (!wrap) return
                  const st = wrap.scrollTop
                  const sl = wrap.scrollLeft
                  requestAnimationFrame(() => {
                    wrap.scrollTop = st
                    wrap.scrollLeft = sl
                  })
                }}
                onWheel={(e) => onCellWheel(e, cell)}
                role="button"
                tabIndex={0}
                aria-label={photo.name || 'Photo frame'}
                aria-pressed={cell.id === selectedId}
              >
                <img src={photo.url} alt={photo.name || ''} draggable={false} style={imageStyleForCell(cell, photo)} />
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
      </div>
      <div className="status-bar">
        <span>{photos.length ? `${photos.length} / 30 photos` : 'No photos yet'}</span>
        <span>{stageW} × {stageH} px</span>
        <span className="canvas-zoom-controls" title="View zoom only — does not change export size">
          <button type="button" className="zoom-btn" onClick={() => zoomCanvasBy?.(-0.1)} disabled={viewZoom <= 0.4} aria-label="Zoom out">−</button>
          <button type="button" className="zoom-btn zoom-label" onClick={() => setCanvasZoom?.(1)} title="Reset to 100%">
            {Math.round(viewZoom * 100)}%
          </button>
          <button type="button" className="zoom-btn" onClick={() => zoomCanvasBy?.(0.1)} disabled={viewZoom >= 1.5} aria-label="Zoom in">+</button>
        </span>
        {panMode
          ? <span className="frame-mode-flag">Frame mode ON · drag to crop</span>
          : <span className="status-hint">Select · drag · Frame mode · zoom for overview</span>}
      </div>
    </div>
  )
}
