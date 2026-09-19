import { type ServerOptions, WebSocketServer } from "ws";
import LeagueService from "../services/league.ts";

export class Server {
  public ws: WebSocketServer | null;
  private lastGameStarted: boolean | null = null;

  constructor (options: { ws?: ServerOptions } = {}) {
    this.ws = options.ws ? new WebSocketServer(options.ws) : null;

    // Send the game data each second if game is started
    setInterval(async () => {
      const league = await new LeagueService();
      const data = await league.gameData();
      for (const client of this.ws?.clients || []) {
        if (client.readyState === client.OPEN) {
          if (data.gameStarted) client.send(JSON.stringify({ type: "gameData", data }));
          else if (this.lastGameStarted !== data.gameStarted) client.send(JSON.stringify({ type: "gameData", data }));
        }
      }
      this.lastGameStarted = data.gameStarted;
    }, 1000);
  }
}
