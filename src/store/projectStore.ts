import { create } from "zustand"
import { AudioClip, ProjectSettings, ProjectState } from "../types/project"

const colors = ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#00a8fc", "#ff7a59"]

type ImportedAudio = {
  filePath: string
  sourceUrl: string
}

type ProjectActions = {
  addClips: (files: ImportedAudio[]) => Promise<void>
  selectClip: (id: string | null) => void
  updateClip: (id: string, patch: Partial<AudioClip>) => void
  removeClip: (id: string) => void
  setPlaying: (value: boolean) => void
  setPlayhead: (value: number) => void
  setZoom: (value: number) => void
  setMasterVolume: (value: number) => void
  setName: (value: string) => void
  setProjectPath: (value: string | null) => void
  setSettings: (patch: Partial<ProjectSettings>) => void
  loadProject: (project: SavedProject, projectPath: string) => Promise<void>
  exportProject: () => SavedProject
  newProject: () => void
}

export type SavedProject = {
  version: 1
  name: string
  savedAt: string
  zoom: number
  masterVolume: number
  settings: ProjectSettings
  clips: Array<Omit<AudioClip, "sourceUrl">>
}

function getFileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() || filePath
}

function mimeFromPath(filePath: string) {
  const lower = filePath.toLowerCase()
  if (lower.endsWith(".mp3")) return "audio/mpeg"
  if (lower.endsWith(".wav")) return "audio/wav"
  if (lower.endsWith(".ogg")) return "audio/ogg"
  if (lower.endsWith(".flac")) return "audio/flac"
  if (lower.endsWith(".m4a")) return "audio/mp4"
  return "application/octet-stream"
}

async function createPlayableUrl(filePath: string) {
  const data = await window.tracksly.readAudioFile(filePath)
  const blob = new Blob([data], { type: mimeFromPath(filePath) })
  return URL.createObjectURL(blob)
}

function readDuration(url: string) {
  return new Promise<number>((resolve) => {
    const audio = new Audio()
    audio.preload = "metadata"
    audio.src = url
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 180)
    audio.onerror = () => resolve(180)
  })
}

async function createPeaks(url: string, bars = 96) {
  try {
    const context = new AudioContext()
    const response = await fetch(url)
    const data = await response.arrayBuffer()
    const buffer = await context.decodeAudioData(data.slice(0))
    const samples = buffer.getChannelData(0)
    const block = Math.max(1, Math.floor(samples.length / bars))
    const peaks = Array.from({ length: bars }, (_, index) => {
      let sum = 0
      const start = index * block
      const end = Math.min(samples.length, start + block)
      for (let i = start; i < end; i++) sum += Math.abs(samples[i])
      return Math.max(0.08, Math.min(1, (sum / Math.max(1, end - start)) * 4.2))
    })
    await context.close()
    return peaks
  } catch {
    return Array.from({ length: bars }, (_, index) => 0.25 + Math.abs(Math.sin(index * 0.41)) * 0.65)
  }
}

function revokeClips(clips: AudioClip[]) {
  for (const clip of clips) {
    if (clip.sourceUrl.startsWith("blob:")) URL.revokeObjectURL(clip.sourceUrl)
  }
}

export const useProjectStore = create<ProjectState & ProjectActions>((set, get) => ({
  name: "Untitled DJ Set",
  projectPath: null,
  clips: [],
  selectedClipId: null,
  isPlaying: false,
  playhead: 0,
  zoom: 22,
  masterVolume: 1,
  settings: {
    audioOutputId: "default",
    autoSave: true,
    snapToBeat: true,
    theme: "discord"
  },
  addClips: async (files) => {
    const existing = get().clips.length
    const created: AudioClip[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const sourceUrl = await createPlayableUrl(file.filePath)
      const duration = await readDuration(sourceUrl)
      const peaks = await createPeaks(sourceUrl)

      created.push({
        id: crypto.randomUUID(),
        name: getFileName(file.filePath),
        filePath: file.filePath,
        sourceUrl,
        duration,
        timelineStart: (existing + i) * 8,
        trimStart: 0,
        trimEnd: duration,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        bass: 0,
        mid: 0,
        treble: 0,
        bassBoost: 0,
        beatOffset: 0,
        color: colors[(existing + i) % colors.length],
        peaks
      })
    }

    set((state) => ({ clips: [...state.clips, ...created], selectedClipId: created[0]?.id ?? state.selectedClipId }))
  },
  selectClip: (id) => set({ selectedClipId: id }),
  updateClip: (id, patch) => set((state) => ({ clips: state.clips.map((clip) => clip.id === id ? { ...clip, ...patch } : clip) })),
  removeClip: (id) => set((state) => {
    const clip = state.clips.find((item) => item.id === id)
    if (clip?.sourceUrl.startsWith("blob:")) URL.revokeObjectURL(clip.sourceUrl)
    return { clips: state.clips.filter((item) => item.id !== id), selectedClipId: state.selectedClipId === id ? null : state.selectedClipId }
  }),
  setPlaying: (value) => set({ isPlaying: value }),
  setPlayhead: (value) => set({ playhead: value }),
  setZoom: (value) => set({ zoom: value }),
  setMasterVolume: (value) => set({ masterVolume: value }),
  setName: (value) => set({ name: value }),
  setProjectPath: (value) => set({ projectPath: value }),
  setSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
  loadProject: async (project, projectPath) => {
    revokeClips(get().clips)
    const clips: AudioClip[] = []

    for (const clip of project.clips) {
      const sourceUrl = await createPlayableUrl(clip.filePath)
      clips.push({ ...clip, sourceUrl })
    }

    set({
      name: project.name,
      projectPath,
      clips,
      selectedClipId: clips[0]?.id ?? null,
      isPlaying: false,
      playhead: 0,
      zoom: project.zoom,
      masterVolume: project.masterVolume,
      settings: project.settings
    })
  },
  exportProject: () => {
    const state = get()
    return {
      version: 1,
      name: state.name,
      savedAt: new Date().toISOString(),
      zoom: state.zoom,
      masterVolume: state.masterVolume,
      settings: state.settings,
      clips: state.clips.map(({ sourceUrl, ...clip }) => clip)
    }
  },
  newProject: () => {
    revokeClips(get().clips)
    set({ name: "Untitled DJ Set", projectPath: null, clips: [], selectedClipId: null, playhead: 0, isPlaying: false, zoom: 22, masterVolume: 1 })
  }
}))
