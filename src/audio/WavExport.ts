import { AudioClip } from "../types/project"

async function loadBuffer(context: OfflineAudioContext, clip: AudioClip) {
  const response = await fetch(clip.sourceUrl)
  const data = await response.arrayBuffer()
  return context.decodeAudioData(data)
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
}

function encodeWav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length * channels * 2 + 44
  const arrayBuffer = new ArrayBuffer(length)
  const view = new DataView(arrayBuffer)
  const samples = []

  for (let channel = 0; channel < channels; channel++) samples.push(buffer.getChannelData(channel))

  writeString(view, 0, "RIFF")
  view.setUint32(4, length - 8, true)
  writeString(view, 8, "WAVE")
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, "data")
  view.setUint32(40, length - 44, true)

  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, samples[channel][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" })
}

export async function renderWav(clips: AudioClip[]) {
  const sampleRate = 44100
  const duration = Math.max(1, ...clips.map((clip) => clip.timelineStart + clip.trimEnd - clip.trimStart + 2))
  const context = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate)

  for (const clip of clips) {
    const buffer = await loadBuffer(context, clip)
    const source = context.createBufferSource()
    const gain = context.createGain()
    const bass = context.createBiquadFilter()
    const mid = context.createBiquadFilter()
    const treble = context.createBiquadFilter()
    const boost = context.createBiquadFilter()

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
    gain.connect(context.destination)

    const start = clip.timelineStart
    const duration = clip.trimEnd - clip.trimStart
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(clip.volume, start + clip.fadeIn)
    gain.gain.setValueAtTime(clip.volume, Math.max(start, start + duration - clip.fadeOut))
    gain.gain.linearRampToValueAtTime(0, start + duration)
    source.start(start, clip.trimStart, duration)
  }

  const rendered = await context.startRendering()
  return encodeWav(rendered)
}

export async function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
