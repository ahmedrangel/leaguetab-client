import consola from "consola";
import { $fetch } from "ofetch";
import { session } from "./http.ts";

export const lolScoreboardSync = async ({ url, dev }: { url: string, dev?: boolean }) => {
  const syncURL = dev ? "http://localhost:5173/api/sync" : "https://lolscoreboard.ahmedrangel.com/api/sync";
  const maxTime = 10 * 60 * 1000; // 10 minutes
  const startTime = Date.now();
  while (Date.now() - startTime < maxTime) {
    if (session) {
      const synced = await $fetch(syncURL, {
        method: "POST",
        headers: { Cookie: `nuxt-session=${session}` },
        body: { url }
      }).catch(() => null);
      if (synced) {
        consola.success("Synced with the server database.");
        return;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds before checking again
  }
  consola.error("Authentication timed out.");
  process.exit(0);
};
