import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { StaticAuthProvider, exchangeDeviceCode, startDeviceCodeFlow } from "@twurple/auth";
import { ApiClient } from "@twurple/api";
import consola from "consola";
import open from "tiny-open";

const TWITCH_CLIENT_ID = "d0f1083q2ckf83hgsh0bnb8ahi5krn";

export const twitchAuth = async () => {
  const scopes = ["user:read:email"];
  const { deviceCode, verificationUri } = await startDeviceCodeFlow(TWITCH_CLIENT_ID, scopes);
  const rl = createInterface({ input, output });
  await rl.question("Press Enter to authenticate with Twitch in your browser...");
  rl.close();
  await open(verificationUri);
  consola.start("Waiting for Twitch authentication...");
  const maxTime = 300000; // 5 minutes
  const startTime = Date.now();
  while (Date.now() - startTime < maxTime) {
    const access = await exchangeDeviceCode(TWITCH_CLIENT_ID, deviceCode, scopes).catch(() => null);
    if (access) {
      const { accessToken } = access;
      const authProvider = new StaticAuthProvider(TWITCH_CLIENT_ID, accessToken);
      const api = new ApiClient({ authProvider });
      const user = await api.callApi<{ data: { id: string, display_name: string }[] }>({ type: "helix", url: "/users" }).catch(() => null);
      const authenticatedUser = user?.data?.[0];
      if (!authenticatedUser) {
        throw new Error("Failed to fetch authenticated user from Twitch.");
      }
      consola.success(`Twitch authentication successful. Welcome, ${authenticatedUser.display_name}!`);
      return { id: authenticatedUser.id, displayName: authenticatedUser.display_name, accessToken };
    }
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds before checking again
  }
  throw new Error("Twitch authentication timed out.");
};