import consola from "consola";
import open from "tiny-open";
import { withQuery } from "ufo";
import { getAPIBaseURL, runtime } from "../utils/app.ts";

export const twitchAuth = async ({ url }: { url: string }) => {
  consola.start("Opening your browser to authenticate with Twitch...");
  const baseURL = getAPIBaseURL();
  const authURL = withQuery(`${baseURL}/twitch`, {
    url,
    state: runtime.session.state
  });
  const opened = await open(authURL);
  if (!opened) {
    consola.warn("Could not open a browser automatically.");
    consola.info("Open this URL in your browser");
    consola.info(authURL);
  }
};