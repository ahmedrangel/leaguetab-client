import { createServerAdapter } from "@whatwg-node/server";
import { type Server, createServer } from "node:http";
import { AutoRouter, cors, json } from "itty-router";
import consola from "consola";
import { ErrorCode } from "../utils/errors.ts";
import LeagueService from "./league.ts";

// oxlint-disable-next-line import/no-mutable-exports
export let session = "";

const { preflight, corsify } = cors({ origin: "*" });

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

router.post("/auth/session", async (req) => {
  const { session: newSession } = await req.json();
  if (!newSession) return json({ error: "Session is required" }, { status: ErrorCode.BAD_REQUEST });
  const base64Decoded = Buffer.from(newSession, "base64").toString("utf-8");
  session = base64Decoded;
  return json({ success: true });
});

router.all("*", async () => json({ error: "Not Found" }, { status: ErrorCode.NOT_FOUND }));

export const runHttp = async (options: { port: number }) => {
  return new Promise<Server>((resolve) => {
    const ittyServer = createServerAdapter(router.fetch);
    const httpServer = createServer(ittyServer);
    httpServer.listen(options.port, "127.0.0.1", () => {
      consola.ready(`HTTP server ready on port ${options.port}`);
      resolve(httpServer);
    });
  });
};
