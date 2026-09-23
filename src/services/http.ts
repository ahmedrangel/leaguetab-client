import { createServerAdapter } from "@whatwg-node/server";
import { type Server, createServer } from "node:http";
import { AutoRouter, cors, json } from "itty-router";
import consola from "consola";
import { $fetch } from "ofetch";
import { ErrorCode } from "../utils/errors.ts";
import LeagueService from "./league.ts";
import { getAPIBaseURL, runtime } from "../utils/app.ts";

// oxlint-disable-next-line import/no-mutable-exports
export let verified = false;

const { preflight, corsify } = cors({ origin: "*", allowMethods: ["GET", "POST"] });

const router = AutoRouter({
  before: [preflight],
  finally: [corsify]
});

router.get("/", async () => {
  const league = await LeagueService.getInstance();
  if (!league) return json({ error: "League Service not initialized" }, { status: ErrorCode.SERVICE_UNAVAILABLE });
  const data = await league.gameData();
  return json(data);
});

router.post("/verify", async (req) => {
  const { sid } = await req.json();
  const baseURL = getAPIBaseURL();
  const response = await $fetch<{ verified: boolean }>(`${baseURL}/verify`, {
    method: "POST",
    body: { sid, state: runtime.state }
  }).catch(() => null);
  verified = response?.verified ?? false;
  return json({ verified });
});

router.all("*", async () => json({ error: "Not Found" }, { status: ErrorCode.NOT_FOUND }));

export const runHttp = async () => {
  return new Promise<Server>((resolve) => {
    const ittyServer = createServerAdapter(router.fetch);
    const httpServer = createServer(ittyServer);
    httpServer.listen(runtime.port, "localhost", () => {
      consola.ready(`HTTP server ready on port ${runtime.port}`);
      resolve(httpServer);
    });
  });
};
