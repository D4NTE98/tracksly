export async function detectBpm(url: string) {
  const context = new AudioContext()
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  const audioBuffer = await context.decodeAudioData(arrayBuffer)
  const data = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate
  const peaks: number[] = []
  const threshold = 0.8
  const minDistance = Math.floor(sampleRate * 0.28)

  for (let i = 0; i < data.length; i += 128) {
    if (Math.abs(data[i]) > threshold && (peaks.length === 0 || i - peaks[peaks.length - 1] > minDistance)) {
      peaks.push(i)
    }
  }

  const intervals = peaks.slice(1).map((peak, index) => peak - peaks[index])
  const bpms = intervals.map((interval) => 60 / (interval / sampleRate)).filter((bpm) => bpm >= 70 && bpm <= 180)
  await context.close()

  if (bpms.length === 0) return 128
  const avg = bpms.reduce((sum, bpm) => sum + bpm, 0) / bpms.length
  return Math.round(avg)
}
