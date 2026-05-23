declare global {
  interface Window {
    tracksly: {
      openAudio: () => Promise<Array<{ filePath: string; sourceUrl: string }>>
      readAudioFile: (filePath: string) => Promise<ArrayBuffer>
      saveAudio: (defaultPath: string) => Promise<string | null>
      saveProject: (defaultPath: string, data: unknown) => Promise<string | null>
      openProject: () => Promise<{ filePath: string; data: unknown } | null>
      minimizeWindow: () => Promise<void>
      toggleMaximizeWindow: () => Promise<boolean>
      closeWindow: () => Promise<void>
    }
  }
}

export {}
