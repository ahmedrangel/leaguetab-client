import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import consola from "consola";
import open from "tiny-open";

export const twitchAuth = async ({ dev }: { dev?: boolean }) => {
  consola.start("Starting Twitch authentication...");
  const rl = createInterface({ input, output });
  const authURL = dev ? "http://localhost:5173/auth/twitch" : "https://lolscoreboard.ahmedrangel.com/auth/twitch";
  await rl.question("Press Enter to authenticate with Twitch in your browser...");
  rl.close();
  await open(authURL);
  consola.start("Waiting for Twitch authentication...");
};