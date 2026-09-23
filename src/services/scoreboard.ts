import consola from "consola";
import { runtime } from "../utils/app.ts";

export const lolScoreboardSync = async () => {
  const maxTime = 10 * 60 * 1000; // 10 minutes
  const startTime = Date.now();
  while (Date.now() - startTime < maxTime) {
    if (runtime.session.verified && runtime.session.user) {
      consola.success(`Hello, ${runtime.session.user.displayName}! You are now verified with the authentication server.`);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds before checking again
  }
  throw new Error("Authentication timed out.");
};
