export type AudioClip = {
  id: string
  filePath: string
  sourceUrl: string
  name: string
  duration: number
  timelineStart: number
  trimStart: number
  trimEnd: number
  volume: number
  fadeIn: number
  fadeOut: number
  bass: number
  mid: number
  treble: number
  bassBoost: number
  bpm?: number
  beatOffset: number
  color: string
  peaks: number[]
}

export type ProjectSettings = {
  audioOutputId: string
  autoSave: boolean
  snapToBeat: boolean
  theme: "discord"
}

export type ProjectState = {
  name: string
  projectPath: string | null
  clips: AudioClip[]
  selectedClipId: string | null
  isPlaying: boolean
  playhead: number
  zoom: number
  masterVolume: number
  settings: ProjectSettings
}
