import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import consola from "consola";
import open from "tiny-open";
import { withQuery } from "ufo";

export const twitchAuth = async ({ url, dev }: { url: string, dev?: boolean }) => {
  consola.start("Starting Twitch authentication...");
  const rl = createInterface({ input, output });
  const authURL = withQuery(dev ? "http://localhost:5173/api/twitch" : "https://lolscoreboard.ahmedrangel.com/api/twitch", {
    url
  });
  await rl.question("Press Enter to authenticate with Twitch in your browser...");
  rl.close();
  await open(authURL);
  consola.start("Waiting for Twitch authentication...");
};