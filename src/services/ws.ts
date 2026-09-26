import type { Server } from "node:http";
import { parseURL } from "ufo";
import { Server as InfoServer } from "../utils/info-socket.ts";
import consola from "consola";

export const runWebSocket = ({ server }: { server: Server }) => {
  consola.ready("WebSocket server ready");
  const infoSocket = new InfoServer({ ws: { noServer: true } });
  server.on("upgrade", (request, socket, head) => {
    const { pathname } = parseURL(request.url);
    switch (pathname) {
      case "/":
      case "":
        infoSocket.ws?.handleUpgrade(request, socket, head, (client) => {
          infoSocket.ws?.emit("connection", client, request);
        });
        return;
      default:
        socket.destroy();
        return;
    }
  });

  const shutdown = () => {
    for (const client of infoSocket.ws?.clients ?? []) {
      client.close();
    }
    infoSocket.ws?.close();
    server.close();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};
