import { spawn } from "node:child_process";
import { consola } from "consola";

const SW_HIDE = 0;
const SW_MINIMIZE = 6;
const SW_RESTORE = 9;

let isHiddenCmd = false;

const buildScript = (processId: number, nCmdShow: number) => `
  $source = @'
using System;
using System.Runtime.InteropServices;
public static class LeaguetabConsoleWindow {
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
  [DllImport("kernel32.dll")] public static extern bool FreeConsole();
  [DllImport("kernel32.dll")] public static extern bool AttachConsole(uint dwProcessId);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
'@
  Add-Type -TypeDefinition $source
  [void][LeaguetabConsoleWindow]::FreeConsole()
  [void][LeaguetabConsoleWindow]::AttachConsole([uint32]${processId})
  $console = [LeaguetabConsoleWindow]::GetConsoleWindow()
  if ($console -ne [IntPtr]::Zero) {
    if (${nCmdShow} -eq ${SW_MINIMIZE}) {
      [void][LeaguetabConsoleWindow]::ShowWindowAsync($console, ${nCmdShow})
      [void][LeaguetabConsoleWindow]::ShowWindowAsync($console, ${SW_HIDE})
    }
    if (${nCmdShow} -eq ${SW_RESTORE}) {
      [void][LeaguetabConsoleWindow]::ShowWindowAsync($console, ${SW_MINIMIZE})
      Start-Sleep -Milliseconds 1
      [void][LeaguetabConsoleWindow]::ShowWindowAsync($console, ${nCmdShow})
    }
  }
`;

const runPWS = (nCmdShow: number) => {
  if (process.platform !== "win32") return;

  const encodedScript = Buffer.from(buildScript(process.pid, nCmdShow), "utf16le").toString("base64");

  try {
    spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedScript],
      { stdio: "ignore" }
    )
      .on("error", error => consola.warn("Could not toggle console visibility:", error))
      .unref();
  }
  catch (error) {
    consola.warn("Could not spawn powershell to toggle console:", error);
  }
};

export const hideCmd = () => {
  isHiddenCmd = true;
  runPWS(SW_MINIMIZE);
};
export const showCmd = () => {
  isHiddenCmd = false;
  runPWS(SW_RESTORE);
};
export const toggleCmd = () => {
  if (isHiddenCmd) showCmd();
  else hideCmd();
};