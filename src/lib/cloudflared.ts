import { join } from "node:path";
import { spawn } from "node:child_process";
import { install } from "cloudflared";
import { consola } from "consola";
import { Workspace } from "../utils/workspace.ts";
import { existsSync } from "node:fs";
import { runtime } from "../utils/app.ts";

export const startCloudflared = async () => {
  consola.start("Starting Cloudflare Tunnel...");
  const isWindows = process.platform === "win32";

  const cloudflaredBin = join(Workspace.path, isWindows ? "cloudflared.exe" : "cloudflared");
  if (!existsSync(cloudflaredBin)) {
    await install(cloudflaredBin);
  }

  spawn(cloudflaredBin, ["--version"], { stdio: "pipe", shell: false }).stdout.on("data", (data: Buffer) => consola.info(data.toString().replace(/\r?\n$/, "")));
  const child = spawn(cloudflaredBin, ["tunnel", "--url", `http://localhost:${runtime.port}`], { stdio: ["ignore", "pipe", "pipe"], shell: false });
  const url = await new Promise<string>((resolve, reject) => {
    let resolved = false;
    let url = "";
    child.stderr.on("data", (data: Buffer) => {
      const output = data.toString();
      const quickTunnel = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      const hostname = output.match(/\\"hostname\\":\\"([^"]+)\\"/);
      const isRegistered = output.includes("Registered tunnel connection");
      const failed = output.includes("failed with status");
      if (quickTunnel?.length && !resolved) {
        url = quickTunnel[0];
        return;
      }
      if (hostname) {
        url = `https://${hostname[1]}`;
        return;
      }
      if (isRegistered && !resolved && url) {
        resolved = true;
        resolve(url);
        return;
      }
      if (failed && !resolved) {
        reject(new Error(output));
        return;
      }
    });
    child.on("close", (code) => {
      if (!resolved) {
        reject(new Error(`Cloudflared exited with code ${code}`));
      }
    });
  });
  consola.success(`Tunnel started successfully at: ${url}`);
  return url;
};
