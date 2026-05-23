import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("tracksly", {
  openAudio: () => ipcRenderer.invoke("dialog:openAudio"),
  readAudioFile: (filePath: string) => ipcRenderer.invoke("audio:readFile", filePath),
  saveAudio: (defaultPath: string) => ipcRenderer.invoke("dialog:saveAudio", defaultPath),
  saveProject: (defaultPath: string, data: unknown) => ipcRenderer.invoke("dialog:saveProject", defaultPath, data),
  openProject: () => ipcRenderer.invoke("dialog:openProject"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggleMaximize"),
  closeWindow: () => ipcRenderer.invoke("window:close")
})
