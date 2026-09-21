import consola from "consola";
import { $fetch } from "ofetch";

export const lolScoreboardSync = async ({ id, accessToken, url, dev }: { id: string, accessToken: string, url: string, dev?: boolean }) => {
  consola.start("Syncing with the server database...");
  const syncURL = dev ? "http://localhost:5173/api/sync" : "https://lolscoreboard.ahmedrangel.com/api/sync";
  const synced = await $fetch(syncURL, {
    method: "POST",
    body: { id, accessToken, url }
  }).catch(() => null);
  if (!synced) {
    throw new Error("Failed to sync with the server.");
  }
};
