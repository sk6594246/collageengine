export default function AppHeader({
  view, setView, photos, rebuild, handleSaveProject, exportPNG, mobileOpen, setMobileOpen, status,
}) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <h1>
          <span className="logo" aria-hidden>🖼️</span>
          Family <span className="brand">Frame</span>
          <span className="tagline">for us</span>
        </h1>
        {status && <span className="status-chip" role="status">{status}</span>}
      </div>
      <div className="header-actions">
        <button
          type="button"
          className="secondary mobile-only"
          aria-label={mobileOpen ? 'Close panel' : 'Open tools'}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? '✕ Close' : '☰ Tools'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setView(view === 'projects' ? 'studio' : 'projects')}
        >
          {view === 'projects' ? '← Studio' : 'Projects'}
        </button>
        <button type="button" className="secondary" onClick={() => rebuild()} disabled={!photos.length} title="Shuffle layout">
          ↻ Shuffle
        </button>
        <button type="button" className="secondary" onClick={handleSaveProject} disabled={!photos.length}>
          💾 Save
        </button>
        <button type="button" className="primary-cta" onClick={exportPNG} disabled={!photos.length}>
          ⬇ PNG
        </button>
        <button type="button" className="secondary desktop-only" onClick={() => window.print()} disabled={!photos.length}>
          🖨 Print
        </button>
      </div>
    </header>
  )
}
