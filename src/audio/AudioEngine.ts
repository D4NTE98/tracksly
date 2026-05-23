import { AudioClip } from "../types/project"

type ActiveNode = {
  source: AudioBufferSourceNode
  gain: GainNode
  filters: BiquadFilterNode[]
  master?: GainNode
}

async function decodeClip(context: AudioContext, clip: AudioClip) {
  const response = await fetch(clip.sourceUrl)
  const data = await response.arrayBuffer()
  return context.decodeAudioData(data)
}

export class AudioEngine {
  private context: AudioContext | null = null
  private nodes: ActiveNode[] = []
  private startedAt = 0
  private playhead = 0
  private timer: number | null = null
  private endTimer: number | null = null

  get currentTime() {
    if (!this.context) return this.playhead
    return this.playhead + this.context.currentTime - this.startedAt
  }

  async play(clips: AudioClip[], from: number, masterVolume: number, onTick: (time: number) => void, onEnd?: () => void) {
    this.stop(false)
    this.context = new AudioContext()
    await this.context.resume()
    this.playhead = from
    this.startedAt = this.context.currentTime

    const projectEnd = Math.max(0, ...clips.map((clip) => clip.timelineStart + clip.trimEnd - clip.trimStart))

    for (const clip of clips) {
      const clipDuration = clip.trimEnd - clip.trimStart
      const clipStart = clip.timelineStart
      const clipEnd = clipStart + clipDuration
      if (clipEnd <= from) continue

      const buffer = await decodeClip(this.context, clip)
      const source = this.context.createBufferSource()
      const gain = this.context.createGain()
      const bass = this.context.createBiquadFilter()
      const mid = this.context.createBiquadFilter()
      const treble = this.context.createBiquadFilter()
      const boost = this.context.createBiquadFilter()

      source.buffer = buffer

      bass.type = "lowshelf"
      bass.frequency.value = 160
      bass.gain.value = clip.bass

      mid.type = "peaking"
      mid.frequency.value = 1000
      mid.Q.value = 0.8
      mid.gain.value = clip.mid

      treble.type = "highshelf"
      treble.frequency.value = 4800
      treble.gain.value = clip.treble

      boost.type = "lowshelf"
      boost.frequency.value = 95
      boost.gain.value = clip.bassBoost

      source.connect(bass)
      bass.connect(mid)
      mid.connect(treble)
      treble.connect(boost)
      boost.connect(gain)
      const master = this.context.createGain()
      master.gain.value = masterVolume

      gain.connect(master)
      master.connect(this.context.destination)

      const delay = Math.max(0, clipStart - from)
      const offset = clip.trimStart + Math.max(0, from - clipStart)
      const remaining = Math.max(0.05, clip.trimEnd - offset)
      const when = this.context.currentTime + delay
      const fadeIn = Math.min(clip.fadeIn, remaining)
      const fadeOut = Math.min(clip.fadeOut, remaining)
      const fadeOutStart = when + Math.max(0, remaining - fadeOut)

      gain.gain.setValueAtTime(0, when)
      gain.gain.linearRampToValueAtTime(clip.volume, when + fadeIn)
      gain.gain.setValueAtTime(clip.volume, fadeOutStart)
      gain.gain.linearRampToValueAtTime(0, when + remaining)

      source.start(when, offset, remaining)
      this.nodes.push({ source, gain, filters: [bass, mid, treble, boost], master })
    }

    this.timer = window.setInterval(() => onTick(this.currentTime), 30)

    if (projectEnd > from) {
      this.endTimer = window.setTimeout(() => {
        onTick(projectEnd)
        this.stop(false)
        onEnd?.()
      }, (projectEnd - from) * 1000 + 80)
    }
  }

  stop(keepPlayhead = true) {
    const nextPlayhead = this.currentTime

    if (this.timer) window.clearInterval(this.timer)
    if (this.endTimer) window.clearTimeout(this.endTimer)
    this.timer = null
    this.endTimer = null

    for (const node of this.nodes) {
      try {
        node.source.stop()
      } catch {}
      node.source.disconnect()
      node.gain.disconnect()
      node.master?.disconnect()
      node.filters.forEach((filter) => filter.disconnect())
    }

    this.nodes = []

    if (this.context) {
      this.context.close()
      this.context = null
    }

    if (keepPlayhead) this.playhead = nextPlayhead
  }
}

export const audioEngine = new AudioEngine()
