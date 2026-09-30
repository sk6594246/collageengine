import { imageStyleForCell } from '../lib/crop'

export default function CollageStage({
  wrapRef, stageW, stageH, bgColor, photos, cells, selectedId, setSelectedId,
  cellRadius, onCellPointerDown, onCellWheel, showCaption, caption,
}) {
  return (
    <div className="workspace">
      <div className="canvas-wrap" ref={wrapRef}>
        <div
          className="stage"
          style={{ width: stageW, height: stageH, background: bgColor }}
          onClick={() => setSelectedId(null)}
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
                className={`cell ${cell.id === selectedId ? 'selected' : ''}`}
                data-id={cell.id}
                style={{
                  left: cell.x,
                  top: cell.y,
                  width: cell.w,
                  height: cell.h,
                  borderRadius: cellRadius,
                  transform: cell.rotate ? `rotate(${cell.rotate}deg)` : undefined,
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedId(cell.id) }}
                onPointerDown={(e) => onCellPointerDown(e, cell)}
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
      <div className="status-bar">
        <span>{photos.length ? `${photos.length} / 30 photos` : 'No photos yet'}</span>
        <span>{stageW} × {stageH} px</span>
        <span className="status-hint">Tap a frame · drag to swap · wheel to zoom</span>
      </div>
    </div>
  )
}
