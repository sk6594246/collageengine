import './App.css'
import './zoom.css'
import { useCollageEngine } from './hooks/useCollageEngine'
import AppHeader from './components/AppHeader'
import PhotoSidebar from './components/PhotoSidebar'
import CollageStage from './components/CollageStage'
import ProjectsPanel from './components/ProjectsPanel'

export default function App() {
  const eng = useCollageEngine()
  const themeClass = eng.theme === 'none' ? '' : `theme-${eng.theme}`

  return (
    <div className={`app ${themeClass}`}>
      <AppHeader
        view={eng.view}
        setView={eng.setView}
        photos={eng.photos}
        rebuild={eng.rebuild}
        handleSaveProject={eng.handleSaveProject}
        exportPNG={eng.exportPNG}
        mobileOpen={eng.mobileOpen}
        setMobileOpen={eng.setMobileOpen}
        status={eng.status}
      />

      <div className="main">
        <aside className={`sidebar ${eng.mobileOpen ? 'open' : ''}`}>
          {eng.view === 'projects' ? (
            <ProjectsPanel
              projectName={eng.projectName}
              setProjectName={eng.setProjectName}
              projects={eng.projects}
              projectId={eng.projectId}
              status={eng.status}
              handleNewProject={eng.handleNewProject}
              handleSaveProject={eng.handleSaveProject}
              handleLoadProject={eng.handleLoadProject}
              handleDeleteProject={eng.handleDeleteProject}
              photos={eng.photos}
            />
          ) : (
            <PhotoSidebar
              fileRef={eng.fileRef}
              photos={eng.photos}
              loadFiles={eng.loadFiles}
              removePhoto={eng.removePhoto}
              clearAll={eng.clearAll}
              selected={eng.selected}
              selectedPhoto={eng.selectedPhoto}
              panMode={eng.panMode}
              setPanMode={eng.setPanMode}
              updateSelected={eng.updateSelected}
              zoomSelected={eng.zoomSelected}
              restoreCrop={eng.restoreCrop}
              replaceSelected={eng.replaceSelected}
              aspect={eng.aspect}
              setAspect={eng.setAspect}
              customW={eng.customW}
              setCustomW={eng.setCustomW}
              customH={eng.customH}
              setCustomH={eng.setCustomH}
              layoutType={eng.layoutType}
              setLayoutType={eng.setLayoutType}
              smartSize={eng.smartSize}
              setSmartSize={eng.setSmartSize}
              layoutScalePct={eng.layoutScalePct}
              setLayoutScalePct={eng.setLayoutScalePct}
              bgColor={eng.bgColor}
              setBgColor={eng.setBgColor}
              theme={eng.theme}
              setTheme={eng.setTheme}
              cellRadius={eng.cellRadius}
              setCellRadius={eng.setCellRadius}
              caption={eng.caption}
              setCaption={eng.setCaption}
              showCaption={eng.showCaption}
              setShowCaption={eng.setShowCaption}
            />
          )}
        </aside>

        {eng.mobileOpen && (
          <button type="button" className="sidebar-backdrop" aria-label="Close tools" onClick={() => eng.setMobileOpen(false)} />
        )}

        <CollageStage
          wrapRef={eng.wrapRef}
          stageW={eng.stageW}
          stageH={eng.stageH}
          bgColor={eng.bgColor}
          photos={eng.photos}
          cells={eng.cells}
          selectedId={eng.selectedId}
          setSelectedId={eng.setSelectedId}
          cellRadius={eng.cellRadius}
          onCellPointerDown={eng.onCellPointerDown}
          onCellWheel={eng.onCellWheel}
          showCaption={eng.showCaption}
          caption={eng.caption}
          panMode={eng.panMode}
          viewZoom={eng.viewZoom}
          setCanvasZoom={eng.setCanvasZoom}
          zoomCanvasBy={eng.zoomCanvasBy}
        />
      </div>
    </div>
  )
}
