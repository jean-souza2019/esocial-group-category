const { app, BrowserWindow } = require("electron");
const path = require("path");

let frontWindow;
let backProcess;

function createFrontWindow() {
  frontWindow = new BrowserWindow({
    width: 900,
    height: 500,
    webPreferences: {
      nodeIntegration: true,
    },
  });
  frontWindow.loadFile(path.join(__dirname, "front", "index.html"));
}

function createBackProcess() {
  backProcess = require("child_process").fork(
    path.join(__dirname, "api", "server.js")
  );
}

app.whenReady().then(() => {
  createFrontWindow();
  createBackProcess();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (frontWindow === null) createFrontWindow();
});
