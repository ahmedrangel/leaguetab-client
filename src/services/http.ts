import { createServerAdapter } from "@whatwg-node/server";
import { type Server, createServer } from "node:http";
import { AutoRouter, cors, json } from "itty-router";
import consola from "consola";
import { $fetch } from "ofetch";
import { ErrorCode } from "../utils/errors.ts";
import LeagueService from "./league.ts";
import { getAPIBaseURL, runtime } from "../utils/app.ts";

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
  if (runtime.session.verified) {
    if (runtime.session.sid !== sid) {
      return json({ error: "Session ID mismatch" }, { status: ErrorCode.UNAUTHORIZED });
    }
    return json({ verified: runtime.session.verified, user: runtime.session.user });
  }
  const baseURL = getAPIBaseURL();
  const response = await $fetch<{ verified: boolean, user: { id: string, login: string, displayName: string } }>(`${baseURL}/verify`, {
    method: "POST",
    body: { sid, state: runtime.session.state }
  }).catch(() => null);
  runtime.session.verified = response?.verified ?? false;
  runtime.session.user = response?.user ?? null;
  runtime.session.sid = sid;
  return json({ verified: runtime.session.verified, user: runtime.session.user });
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
