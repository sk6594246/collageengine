export default function ProjectsPanel({
  projectName, setProjectName, projects, projectId, status,
  handleNewProject, handleSaveProject, handleLoadProject, handleDeleteProject, photos,
}) {
  return (
    <div className="control-group">
      <div className="section-title">Projects</div>
      <input
        type="text"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        placeholder="Project name"
        aria-label="Project name"
      />
      <div className="row-btns">
        <button type="button" onClick={handleNewProject}>New</button>
        <button type="button" className="secondary" onClick={handleSaveProject} disabled={!photos.length}>Save</button>
      </div>
      <div className="project-list">
        {projects.length === 0 && <p className="hint">No saved projects yet. Build a collage, then Save.</p>}
        {projects.map((p) => (
          <div
            key={p.id}
            className={`project-item ${p.id === projectId ? 'active' : ''}`}
            onClick={() => handleLoadProject(p.id)}
            onKeyDown={(e) => e.key === 'Enter' && handleLoadProject(p.id)}
            role="button"
            tabIndex={0}
          >
            <div>
              <div className="name">{p.name}</div>
              <div className="meta">{p.photoCount || 0} photos</div>
            </div>
            <button type="button" className="del" aria-label="Delete project" onClick={(e) => handleDeleteProject(p.id, e)}>×</button>
          </div>
        ))}
      </div>
      {status && <p className="hint">{status}</p>}
    </div>
  )
}
