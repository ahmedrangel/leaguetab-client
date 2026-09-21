import consola from "consola";
import open from "tiny-open";
import { withQuery } from "ufo";

export const twitchAuth = async ({ url, dev }: { url: string, dev?: boolean }) => {
  consola.start("Opening your browser to authenticate with Twitch...");
  const authURL = withQuery(dev ? "http://localhost:5173/api/twitch" : "https://lolscoreboard.ahmedrangel.com/api/twitch", {
    url
  });
  const opened = await open(authURL);
  if (!opened) {
    consola.warn("Could not open a browser automatically.");
    consola.info("Open this URL in your browser");
    consola.info(authURL);
  }
};