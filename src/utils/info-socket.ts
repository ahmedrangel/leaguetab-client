import { type ServerOptions, WebSocketServer } from "ws";
import LeagueService from "../services/league.ts";

export class Server {
  public ws: WebSocketServer | null;
  private lastGameStarted: boolean | null = null;
  private lastGameData: Awaited<ReturnType<LeagueService["gameData"]>> | null = null;

  constructor (options: { ws?: ServerOptions } = {}) {
    this.ws = options.ws ? new WebSocketServer(options.ws) : null;
    // Send the game data each second if game is started
    setInterval(async () => {
      const league = await LeagueService.getInstance();
      const data = await league.gameData();
      if (JSON.stringify(this.lastGameData) === JSON.stringify(data)) {
        return;
      }
      this.lastGameData = data;
      for (const client of this.ws?.clients || []) {
        if (client.readyState === client.OPEN) {
          if (data.game.started) client.send(JSON.stringify({ type: "gameData", data }));
          else if (this.lastGameStarted !== data.game.started) client.send(JSON.stringify({ type: "gameData", data }));
        }
      }
      this.lastGameStarted = data.game?.started || null;
    }, 1000);
  }
}
