import { Activity, Download, FilePlus2, FolderKanban, FolderOpen, Github, Home, Maximize2, Minus, Pause, Play, Save, Scissors, Settings, SlidersHorizontal, Sparkles, Square, Trash2, Users, Waves, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { audioEngine } from "./audio/AudioEngine"
import { detectBpm } from "./audio/BpmDetector"
import { downloadBlob, renderWav } from "./audio/WavExport"
import { useProjectStore } from "./store/projectStore"
import { AudioClip } from "./types/project"
import { SavedProject } from "./store/projectStore"

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds)
  const min = Math.floor(safe / 60)
  const sec = Math.floor(safe % 60)
  return `${min}:${sec.toString().padStart(2, "0")}`
}

function Slider({ label, value, min, max, step, onChange, suffix = "" }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void }) {
  return <div className="control">
    <div className="control-head">
      <span>{label}</span>
      <b>{value}{suffix}</b>
    </div>
    <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
  </div>
}

function WindowTitlebar() {
  const [maximized, setMaximized] = useState(false)

  async function toggleMaximize() {
    const state = await window.tracksly.toggleMaximizeWindow()
    setMaximized(state)
  }

  return <div className="window-titlebar">
    <div className="window-drag">
      <div className="titlebar-logo"><Waves size={15} /></div>
      <span>Tracksly</span>
    </div>
    <div className="window-controls">
      <button aria-label="Minimize" onClick={() => window.tracksly.minimizeWindow()}><Minus size={16} /></button>
      <button aria-label="Maximize" onClick={toggleMaximize}>{maximized ? <Square size={13} /> : <Maximize2 size={14} />}</button>
      <button aria-label="Close" className="close" onClick={() => window.tracksly.closeWindow()}><X size={17} /></button>
    </div>
  </div>
}

type AppTab = "start" | "projects" | "settings" | "creators"

const navItems: Array<{ id: AppTab; label: string; icon: typeof Home }> = [
  { id: "start", label: "Start", icon: Home },
  { id: "projects", label: "Projekty", icon: FolderKanban },
  { id: "settings", label: "Ustawienia", icon: Settings },
  { id: "creators", label: "Twórcy", icon: Users }
]

function Rail({ activeTab, setActiveTab }: { activeTab: AppTab; setActiveTab: (tab: AppTab) => void }) {
  return <nav className="rail">
    {navItems.map((item) => {
      const Icon = item.icon
      return <button key={item.id} className={`rail-button ${activeTab === item.id ? "active" : ""}`} title={item.label} onClick={() => setActiveTab(item.id)}>
        <Icon size={23} />
      </button>
    })}
  </nav>
}

function Sidebar({ activeTab }: { activeTab: AppTab }) {
  const clips = useProjectStore((state) => state.clips)
  const selectedClipId = useProjectStore((state) => state.selectedClipId)
  const addClips = useProjectStore((state) => state.addClips)
  const selectClip = useProjectStore((state) => state.selectClip)

  async function importFiles() {
    const files = await window.tracksly.openAudio()
    if (files.length > 0) await addClips(files)
  }

  return <aside className="sidebar">
    <div className="brand">
      <div className="brand-icon"><Waves size={24} /></div>
      <div>
        <h1>Tracksly</h1>
        <p>{navItems.find((item) => item.id === activeTab)?.label}</p>
      </div>
    </div>

    <button className="primary-button" onClick={importFiles}>
      <FolderOpen size={18} /> Import MP3/WAV
    </button>

    <div className="section-title">Library</div>
    <div className="library-list">
      {clips.length === 0 && <div className="empty-card">Wrzuć kilka kawałków i zacznij układać set.</div>}
      {clips.map((clip) => <button key={clip.id} className={`library-item ${selectedClipId === clip.id ? "active" : ""}`} onClick={() => selectClip(clip.id)}>
        <span className="clip-dot" style={{ background: clip.color }} />
        <span>{clip.name}</span>
        <small>{formatTime(clip.duration)}</small>
      </button>)}
    </div>
  </aside>
}

function Topbar() {
  const clips = useProjectStore((state) => state.clips)
  const playhead = useProjectStore((state) => state.playhead)
  const isPlaying = useProjectStore((state) => state.isPlaying)
  const masterVolume = useProjectStore((state) => state.masterVolume)
  const setMasterVolume = useProjectStore((state) => state.setMasterVolume)
  const setPlaying = useProjectStore((state) => state.setPlaying)
  const setPlayhead = useProjectStore((state) => state.setPlayhead)
  const [exporting, setExporting] = useState(false)

  async function togglePlayback() {
    if (isPlaying) {
      audioEngine.stop()
      setPlaying(false)
      return
    }

    setPlaying(true)
    await audioEngine.play(clips, playhead, masterVolume, setPlayhead, () => setPlaying(false))
  }

  async function exportWav() {
    if (clips.length === 0) return
    setExporting(true)
    try {
      const blob = await renderWav(clips)
      await downloadBlob(blob, "tracksly-set.wav")
    } finally {
      setExporting(false)
    }
  }

  return <header className="topbar">
    <div className="transport">
      <button className="round-button" onClick={togglePlayback}>{isPlaying ? <Pause size={20} /> : <Play size={20} />}</button>
      <div>
        <strong>{formatTime(playhead)}</strong>
        <span>Current playhead</span>
      </div>
    </div>

    <div className="top-actions">
      <div className="master-volume">
        <span>Master</span>
        <input type="range" min={0} max={1} step={0.01} value={masterVolume} onChange={(event) => setMasterVolume(Number(event.target.value))} />
        <b>{Math.round(masterVolume * 100)}%</b>
      </div>
      <div className="status-pill"><Activity size={16} /> {clips.length} tracks loaded</div>
      <button className="ghost-button" onClick={exportWav} disabled={exporting || clips.length === 0}>
        <Download size={17} /> {exporting ? "Rendering..." : "Export WAV"}
      </button>
    </div>
  </header>
}

function BeatGrid({ duration, zoom }: { duration: number; zoom: number }) {
  const markers = useMemo(() => Array.from({ length: Math.ceil(duration / 4) + 1 }, (_, i) => i * 4), [duration])
  return <div className="beat-grid" style={{ width: duration * zoom }}>
    {markers.map((time) => <div key={time} className="beat-marker" style={{ left: time * zoom }}><span>{formatTime(time)}</span></div>)}
  </div>
}

function TimelineClip({ clip, index }: { clip: AudioClip; index: number }) {
  const zoom = useProjectStore((state) => state.zoom)
  const selectedClipId = useProjectStore((state) => state.selectedClipId)
  const selectClip = useProjectStore((state) => state.selectClip)
  const updateClip = useProjectStore((state) => state.updateClip)
  const visibleDuration = clip.trimEnd - clip.trimStart
  const left = clip.timelineStart * zoom
  const width = Math.max(52, visibleDuration * zoom)
  const waveBars = Math.max(40, Math.ceil(width / 7))
  const repeatedPeaks = Array.from({ length: waveBars }, (_, i) => clip.peaks[i % clip.peaks.length] || 0.25)

  function move(event: React.PointerEvent<HTMLDivElement>) {
    const startX = event.clientX
    const original = clip.timelineStart
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    selectClip(clip.id)

    function onMove(moveEvent: PointerEvent) {
      const delta = (moveEvent.clientX - startX) / zoom
      updateClip(clip.id, { timelineStart: Math.max(0, original + delta) })
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  function trimLeft(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation()
    const startX = event.clientX
    const originalTrimStart = clip.trimStart
    const originalTimelineStart = clip.timelineStart
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    selectClip(clip.id)

    function onMove(moveEvent: PointerEvent) {
      const delta = (moveEvent.clientX - startX) / zoom
      const nextTrimStart = Math.min(Math.max(0, originalTrimStart + delta), clip.trimEnd - 0.5)
      const trimDelta = nextTrimStart - originalTrimStart
      updateClip(clip.id, {
        trimStart: nextTrimStart,
        timelineStart: Math.max(0, originalTimelineStart + trimDelta)
      })
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  function trimRight(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation()
    const startX = event.clientX
    const originalTrimEnd = clip.trimEnd
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    selectClip(clip.id)

    function onMove(moveEvent: PointerEvent) {
      const delta = (moveEvent.clientX - startX) / zoom
      updateClip(clip.id, { trimEnd: Math.min(clip.duration, Math.max(clip.trimStart + 0.5, originalTrimEnd + delta)) })
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  return <div className={`timeline-clip ${selectedClipId === clip.id ? "selected" : ""}`} style={{ left, width, top: 18 + index * 76, borderColor: clip.color }} onPointerDown={move} onClick={() => selectClip(clip.id)}>
    <div className="trim-handle trim-left" onPointerDown={trimLeft} title="Przytnij początek" />
    <div className="trim-handle trim-right" onPointerDown={trimRight} title="Przytnij koniec" />
    <div className="clip-header">
      <strong>{clip.name}</strong>
      <span>{clip.bpm ? `${clip.bpm} BPM` : "BPM ?"}</span>
    </div>
    <div className="fake-wave">
      {repeatedPeaks.map((peak, i) => <i key={i} style={{ height: `${Math.max(7, peak * 34)}px`, background: clip.color }} />)}
    </div>
    <div className="fade-shade left" style={{ width: Math.min(width / 2, clip.fadeIn * zoom) }} />
    <div className="fade-shade right" style={{ width: Math.min(width / 2, clip.fadeOut * zoom) }} />
  </div>
}

function Timeline() {
  const clips = useProjectStore((state) => state.clips)
  const zoom = useProjectStore((state) => state.zoom)
  const playhead = useProjectStore((state) => state.playhead)
  const setPlayhead = useProjectStore((state) => state.setPlayhead)
  const duration = Math.max(90, ...clips.map((clip) => clip.timelineStart + clip.trimEnd - clip.trimStart + 12))

  function seek(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    setPlayhead((event.clientX - rect.left + event.currentTarget.scrollLeft) / zoom)
  }

  return <main className="timeline-panel">
    <div className="timeline-header">
      <div>
        <h2>Timeline</h2>
        <p>Przesuwaj tracki, ustaw fade i buduj przejścia.</p>
      </div>
      <div className="timeline-badges">
        <span>Server: Local</span>
        <span>Snap: Beat</span>
        <span>Grid: 4s</span>
      </div>
    </div>

    <div className="timeline-scroll" onClick={seek}>
      <div className="timeline-canvas" style={{ width: duration * zoom, height: Math.max(420, clips.length * 78 + 72) }}>
        <BeatGrid duration={duration} zoom={zoom} />
        <div className="playhead" style={{ left: playhead * zoom }} />
        {clips.map((clip, index) => <TimelineClip key={clip.id} clip={clip} index={index} />)}
      </div>
    </div>
  </main>
}

function Inspector() {
  const clips = useProjectStore((state) => state.clips)
  const selectedClipId = useProjectStore((state) => state.selectedClipId)
  const updateClip = useProjectStore((state) => state.updateClip)
  const removeClip = useProjectStore((state) => state.removeClip)
  const selected = clips.find((clip) => clip.id === selectedClipId)
  const [detecting, setDetecting] = useState(false)

  if (!selected) {
    return <aside className="inspector">
      <div className="empty-inspector">
        <SlidersHorizontal size={38} />
        <h3>Wybierz track</h3>
        <p>Tu pojawią się volume, fade, bass boost, EQ i BPM.</p>
      </div>
    </aside>
  }

  const selectedClip: AudioClip = selected

  async function runBpm() {
    const current = selectedClip
    setDetecting(true)
    try {
      const bpm = await detectBpm(current.sourceUrl)
      updateClip(current.id, { bpm })
    } finally {
      setDetecting(false)
    }
  }

  return <aside className="inspector">
    <div className="inspector-card selected-track">
      <span className="clip-dot large" style={{ background: selected.color }} />
      <div>
        <h3>{selected.name}</h3>
        <p>{formatTime(selected.duration)} • {selected.bpm ? `${selected.bpm} BPM` : "BPM not detected"}</p>
      </div>
    </div>

    <div className="inspector-card">
      <h4><Scissors size={17} /> Edit</h4>
      <Slider label="Timeline start" value={Number(selected.timelineStart.toFixed(1))} min={0} max={300} step={0.1} suffix="s" onChange={(value) => updateClip(selected.id, { timelineStart: value })} />
      <Slider label="Trim start" value={Number(selected.trimStart.toFixed(1))} min={0} max={Math.max(0, selected.trimEnd - 1)} step={0.1} suffix="s" onChange={(value) => updateClip(selected.id, { trimStart: value })} />
      <Slider label="Trim end" value={Number(selected.trimEnd.toFixed(1))} min={selected.trimStart + 1} max={selected.duration} step={0.1} suffix="s" onChange={(value) => updateClip(selected.id, { trimEnd: value })} />
      <div className="fade-buttons">
        <button onClick={() => updateClip(selected.id, { fadeIn: Math.min(5, selected.trimEnd - selected.trimStart) })}>Fade-in</button>
        <button onClick={() => updateClip(selected.id, { fadeOut: Math.min(5, selected.trimEnd - selected.trimStart) })}>Fade-out</button>
        <button onClick={() => updateClip(selected.id, { fadeIn: 0, fadeOut: 0 })}>Clear fade</button>
      </div>
      <Slider label="Fade in" value={Number(selected.fadeIn.toFixed(1))} min={0} max={Math.min(30, selected.trimEnd - selected.trimStart)} step={0.1} suffix="s" onChange={(value) => updateClip(selected.id, { fadeIn: value })} />
      <Slider label="Fade out" value={Number(selected.fadeOut.toFixed(1))} min={0} max={Math.min(30, selected.trimEnd - selected.trimStart)} step={0.1} suffix="s" onChange={(value) => updateClip(selected.id, { fadeOut: value })} />
    </div>

    <div className="inspector-card">
      <h4><SlidersHorizontal size={17} /> Mixer</h4>
      <Slider label="Volume" value={Number(selected.volume.toFixed(2))} min={0} max={2} step={0.01} onChange={(value) => updateClip(selected.id, { volume: value })} />
      <Slider label="Bass" value={selected.bass} min={-18} max={18} step={1} suffix=" dB" onChange={(value) => updateClip(selected.id, { bass: value })} />
      <Slider label="Mid" value={selected.mid} min={-18} max={18} step={1} suffix=" dB" onChange={(value) => updateClip(selected.id, { mid: value })} />
      <Slider label="Treble" value={selected.treble} min={-18} max={18} step={1} suffix=" dB" onChange={(value) => updateClip(selected.id, { treble: value })} />
      <Slider label="Bass boost" value={selected.bassBoost} min={0} max={18} step={1} suffix=" dB" onChange={(value) => updateClip(selected.id, { bassBoost: value })} />
    </div>

    <div className="inspector-card actions-card">
      <button className="ghost-button full" onClick={runBpm} disabled={detecting}><Sparkles size={17} /> {detecting ? "Detecting..." : "Detect BPM"}</button>
      <button className="danger-button full" onClick={() => removeClip(selected.id)}><Trash2 size={17} /> Remove track</button>
    </div>
  </aside>
}

function ProjectsPage() {
  const name = useProjectStore((state) => state.name)
  const projectPath = useProjectStore((state) => state.projectPath)
  const clips = useProjectStore((state) => state.clips)
  const setName = useProjectStore((state) => state.setName)
  const setProjectPath = useProjectStore((state) => state.setProjectPath)
  const exportProject = useProjectStore((state) => state.exportProject)
  const loadProject = useProjectStore((state) => state.loadProject)
  const newProject = useProjectStore((state) => state.newProject)
  const [message, setMessage] = useState("Projekt zapisuje ścieżki plików audio, timeline, trim, fade, EQ, BPM i ustawienia.")

  async function saveProject() {
    const data = exportProject()
    const filePath = await window.tracksly.saveProject(`${name || "tracksly-project"}.tracksly`, data)
    if (filePath) {
      setProjectPath(filePath)
      setMessage(`Zapisano projekt: ${filePath}`)
    }
  }

  async function openProject() {
    const result = await window.tracksly.openProject()
    if (!result) return
    await loadProject(result.data as SavedProject, result.filePath)
    setMessage(`Wczytano projekt: ${result.filePath}`)
  }

  return <main className="page-panel">
    <div className="page-header">
      <div>
        <h2>Projekty</h2>
        <p>Zapisuj i wczytuj sety jako własne pliki .tracksly.</p>
      </div>
      <div className="page-actions">
        <button className="ghost-button" onClick={newProject}><FilePlus2 size={17} /> Nowy</button>
        <button className="ghost-button" onClick={openProject}><FolderOpen size={17} /> Wczytaj .tracksly</button>
        <button className="primary-button compact" onClick={saveProject}><Save size={17} /> Zapisz .tracksly</button>
      </div>
    </div>

    <div className="project-grid">
      <section className="project-card wide">
        <h3>Aktualny projekt</h3>
        <label className="text-field">
          <span>Nazwa projektu</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="project-path">
          <span>Plik projektu</span>
          <b>{projectPath || "Nie zapisano jeszcze pliku .tracksly"}</b>
        </div>
        <p>{message}</p>
      </section>

      <section className="project-card">
        <h3>Zawartość</h3>
        <div className="stat-row"><span>Tracki</span><b>{clips.length}</b></div>
        <div className="stat-row"><span>Łączna długość audio</span><b>{formatTime(clips.reduce((sum, clip) => sum + Math.max(0, clip.trimEnd - clip.trimStart), 0))}</b></div>
        <div className="stat-row"><span>Format</span><b>.tracksly</b></div>
      </section>

      <section className="project-card wide">
        <h3>Lista tracków w projekcie</h3>
        <div className="project-track-list">
          {clips.length === 0 && <div className="empty-card">Brak tracków w aktualnym projekcie.</div>}
          {clips.map((clip) => <div key={clip.id} className="project-track-row">
            <span className="clip-dot" style={{ background: clip.color }} />
            <strong>{clip.name}</strong>
            <small>{clip.filePath}</small>
          </div>)}
        </div>
      </section>
    </div>
  </main>
}

function SettingsPage() {
  const settings = useProjectStore((state) => state.settings)
  const masterVolume = useProjectStore((state) => state.masterVolume)
  const setSettings = useProjectStore((state) => state.setSettings)
  const setMasterVolume = useProjectStore((state) => state.setMasterVolume)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.().then((items) => setDevices(items.filter((item) => item.kind === "audiooutput"))).catch(() => setDevices([]))
  }, [])

  return <main className="page-panel">
    <div className="page-header">
      <div>
        <h2>Ustawienia</h2>
        <p>Źródła audio, zachowanie timeline i głośność aplikacji.</p>
      </div>
    </div>

    <div className="settings-grid">
      <section className="project-card wide">
        <h3>Audio</h3>
        <label className="text-field">
          <span>Wyjście audio</span>
          <select value={settings.audioOutputId} onChange={(event) => setSettings({ audioOutputId: event.target.value })}>
            <option value="default">Domyślne urządzenie systemowe</option>
            {devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Urządzenie ${device.deviceId.slice(0, 6)}`}</option>)}
          </select>
        </label>
        <Slider label="Globalny volume" value={Number(masterVolume.toFixed(2))} min={0} max={1} step={0.01} suffix="" onChange={setMasterVolume} />
      </section>

      <section className="project-card">
        <h3>Timeline</h3>
        <label className="switch-row">
          <span>Snap do beatów</span>
          <input type="checkbox" checked={settings.snapToBeat} onChange={(event) => setSettings({ snapToBeat: event.target.checked })} />
        </label>
        <label className="switch-row">
          <span>Auto-save info</span>
          <input type="checkbox" checked={settings.autoSave} onChange={(event) => setSettings({ autoSave: event.target.checked })} />
        </label>
      </section>

      <section className="project-card">
        <h3>Wygląd</h3>
        <div className="stat-row"><span>Motyw</span><b>Discord dark</b></div>
        <div className="stat-row"><span>UI</span><b>Custom titlebar</b></div>
      </section>
    </div>
  </main>
}

function CreatorsPage() {
  return <main className="page-panel creators-page">
    <div className="creator-card">
      <div className="creator-avatar">D4</div>
      <h2>D4NTE</h2>
      <a href="https://github.com/D4NTE98" target="_blank" rel="noreferrer"><Github size={18} /> github.com/D4NTE98</a>
    </div>
  </main>
}

function StartPage() {
  return <>
    <Topbar />
    <div className="center-grid">
      <Timeline />
      <Inspector />
    </div>
    <BottomBar />
  </>
}

function BottomBar() {
  const zoom = useProjectStore((state) => state.zoom)
  const setZoom = useProjectStore((state) => state.setZoom)

  return <div className="bottom-bar">
    <span>Zoom</span>
    <input type="range" min={8} max={80} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
    <b>{zoom}px/s</b>
  </div>
}

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("start")

  return <div className="app-shell">
    <WindowTitlebar />
    <Rail activeTab={activeTab} setActiveTab={setActiveTab} />
    <Sidebar activeTab={activeTab} />
    <div className={`workspace ${activeTab !== "start" ? "page-workspace" : ""}`}>
      {activeTab === "start" && <StartPage />}
      {activeTab === "projects" && <ProjectsPage />}
      {activeTab === "settings" && <SettingsPage />}
      {activeTab === "creators" && <CreatorsPage />}
    </div>
  </div>
}

export default App
