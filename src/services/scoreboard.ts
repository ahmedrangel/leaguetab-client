import consola from "consola";
import { verified } from "./http.ts";

export const lolScoreboardSync = async () => {
  const maxTime = 10 * 60 * 1000; // 10 minutes
  const startTime = Date.now();
  while (Date.now() - startTime < maxTime) {
    if (verified) {
      consola.success("Verified with the authentication server.");
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds before checking again
  }
  throw new Error("Authentication timed out.");
};
