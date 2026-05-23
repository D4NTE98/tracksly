import { app, BrowserWindow, dialog, ipcMain } from "electron"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1460,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#313338",
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  if (isDev) {
    win.loadURL("http://localhost:5173")
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"))
  }
}

ipcMain.handle("dialog:openAudio", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Audio", extensions: ["mp3", "wav", "ogg", "flac", "m4a"] }
    ]
  })

  if (result.canceled) return []
  return result.filePaths.map((filePath) => ({
    filePath,
    sourceUrl: pathToFileURL(filePath).toString()
  }))
})

ipcMain.handle("audio:readFile", async (_, filePath: string) => {
  const data = await fs.readFile(filePath)
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
})

ipcMain.handle("dialog:saveAudio", async (_, defaultPath: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: [
      { name: "WAV", extensions: ["wav"] },
      { name: "MP3", extensions: ["mp3"] }
    ]
  })

  if (result.canceled || !result.filePath) return null
  return result.filePath
})


ipcMain.handle("dialog:saveProject", async (_, defaultPath: string, data: unknown) => {
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: [
      { name: "Tracksly Project", extensions: ["tracksly"] }
    ]
  })

  if (result.canceled || !result.filePath) return null
  await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), "utf-8")
  return result.filePath
})

ipcMain.handle("dialog:openProject", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Tracksly Project", extensions: ["tracksly"] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const content = await fs.readFile(filePath, "utf-8")
  return { filePath, data: JSON.parse(content) }
})

ipcMain.handle("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize()
})

ipcMain.handle("window:toggleMaximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return false
  if (win.isMaximized()) {
    win.unmaximize()
    return false
  }
  win.maximize()
  return true
})

ipcMain.handle("window:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close()
})

app.whenReady().then(createWindow)

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
