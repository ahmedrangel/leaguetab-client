import { join } from "node:path";
import { spawn } from "node:child_process";
import { install } from "cloudflared";
import { consola } from "consola";
import { Workspace } from "../utils/workspace.ts";
import { existsSync } from "node:fs";

export interface CloudflaredOptions {
  token?: string;
  port?: number;
}

export const startCloudflared = async (options: CloudflaredOptions) => {
  consola.start("Starting Cloudflare Tunnel...");
  const isWindows = process.platform === "win32";

  const cloudflaredBin = join(Workspace.path, isWindows ? "cloudflared.exe" : "cloudflared");
  if (!existsSync(cloudflaredBin)) {
    await install(cloudflaredBin);
  }

  spawn(cloudflaredBin, ["--version"], { stdio: "pipe", shell: false }).stdout.on("data", (data: Buffer) => consola.info(data.toString().replace(/\r?\n$/, "")));
  const child = spawn(cloudflaredBin, ["tunnel", "--url", `http://127.0.0.1:${options.port}`], { stdio: ["ignore", "pipe", "pipe"], shell: false });
  const url = await new Promise<string>((resolve, reject) => {
    let resolved = false;
    let url = "";
    child.stderr.on("data", (data: Buffer) => {
      const output = data.toString();
      const quickTunnel = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (quickTunnel?.length && !resolved) {
        url = quickTunnel[0];
        return;
      }
      const hostname = output.match(/\\"hostname\\":\\"([^"]+)\\"/);
      if (hostname) {
        url = `https://${hostname[1]}`;
        return;
      }
      const isRegistered = output.includes("Registered tunnel connection");
      if (isRegistered && !resolved && url) {
        resolved = true;
        resolve(url);
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
