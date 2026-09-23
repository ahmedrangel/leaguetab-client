import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { $fetch } from "ofetch";
import { consola } from "consola";
import { colors } from "consola/utils";
import { install as installCloudflared } from "cloudflared";
import { randomUUID } from "node:crypto";
import { Workspace } from "./workspace.ts";
import pkg from "../../package.json" with { type: "json" };

export const APP = {
  name: pkg.name,
  version: pkg.version,
  repository: {
    owner: "ahmedrangel",
    name: pkg.name
  }
};

export const runtime = {
  dev: false,
  port: 31537,
  session: {
    state: randomUUID(),
    sid: null,
    verified: false,
    user: null as { id: string, login: string, displayName: string } | null
  }
};

export const getAPIBaseURL = () => runtime.dev ? "http://localhost:5173/api" : "https://lolscoreboard.ahmedrangel.com/api";

export const checkForUpdates = async () => {
  const slug = `${APP.repository.owner}/${APP.repository.name}`;
  const response = await $fetch(`https://api.github.com/repos/${slug}/releases/latest`).catch(() => null);
  if (!response) {
    return {
      updateApp: async () => {},
      isUpdateAvailable: false
    };
  }

  const latest = response.tag_name;
  const current = `v${APP.version}`;
  const isUpdateAvailable = latest !== current;

  const downloadUrl = `https://github.com/${slug}/releases/download/${latest}/${APP.name}.exe`;

  if (isUpdateAvailable) {
    const updateBox = ""
      + `Nueva versión disponible! ${colors.red(current)} → ${colors.green(latest)}.\n`
      + `Descargar: ${colors.cyan(downloadUrl)}`;
    consola.box(updateBox);
  }

  const updateApp = async () => {
    const execPath = process.execPath;

    if (!execPath.includes(APP.name)) {
      consola.error("Ha ocurrido un error al intentar actualizar la aplicación. Continuando con la versión actual.");
      return;
    }

    // Update cloudflared and ffmpeg
    const isWindows = process.platform === "win32";
    const cloudflaredBin = join(Workspace.path, isWindows ? "cloudflared.exe" : "cloudflared");
    await installCloudflared(cloudflaredBin);

    const exeDir = dirname(execPath);

    // Define the paths for the old and new executables
    const oldExe = execPath;
    const versionExe = join(exeDir, `${APP.name}-${latest}.exe`);
    const newExe = join(exeDir, `${APP.name}.exe`);

    // Download the new executable
    consola.info(`Descargando nueva versión: ${colors.green(latest)}...`);
    const exeBinary = await $fetch(downloadUrl, { responseType: "stream" });
    await writeFile(versionExe, exeBinary);

    // Create a batch file to handle the update process
    const bat = `@echo off
set "OLD_EXE=${oldExe}"
set "VERSION_EXE=${versionExe}"
set "NEW_EXE=${newExe}"

taskkill /f /im "%OLD_EXE%" >nul 2>&1

:delete
del /f /q "%OLD_EXE%"

if exist "%OLD_EXE%" (
  timeout /t 1 /nobreak >nul
  goto delete
)

move /Y "%VERSION_EXE%" "%NEW_EXE%"

start "" "%NEW_EXE%"

exit`;

    // Write the batch file to the workspace and execute it
    await Workspace.instance?.write("update.bat", bat);
    spawn("cmd.exe", ["/c", join(Workspace.path, "update.bat")], {
      detached: true,
      windowsHide: true,
      stdio: "ignore"
    }).unref();

    process.exit(0);
  };

  return {
    updateApp,
    isUpdateAvailable
  };
};
