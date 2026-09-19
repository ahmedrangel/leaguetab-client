import { createServerAdapter } from "@whatwg-node/server";
import { createServer } from "node:http";
import { AutoRouter, cors, json } from "itty-router";
import consola from "consola";
import { ErrorCode } from "../utils/errors.ts";
import { runWebSocket } from "./ws.ts";
import LeagueService from "./league.ts";

const { preflight, corsify } = cors({ origin: "*" });

const router = AutoRouter({
  before: [preflight],
  finally: [corsify]
});

router.get("/", async () => {
  const league = new LeagueService();
  const data = await league.gameData();
  return json(data);
});

router.all("*", async () => json({ error: "Not Found" }, { status: ErrorCode.NOT_FOUND }));

export const runHttp = async (options: { port: number }) => {
  return new Promise<void>((resolve) => {
    const ittyServer = createServerAdapter(router.fetch);
    const httpServer = createServer(ittyServer);
    runWebSocket({ server: httpServer });
    httpServer.listen(options.port, "127.0.0.1", () => {
      consola.ready(`HTTP + WS server ready on port ${options.port}`);
      resolve();
    });
  });
};
