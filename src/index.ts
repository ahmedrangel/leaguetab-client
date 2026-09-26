import { defineCommand, runMain } from "citty";
import { consola } from "consola";
import { APP, checkForUpdates, runtime } from "./utils/app.ts";
import { runHttp } from "./services/http.ts";
import { startCloudflared } from "./lib/cloudflared.ts";
import { twitchAuth } from "./services/twitch.ts";
import { lolScoreboardSync } from "./services/scoreboard.ts";
import { runWebSocket } from "./services/ws.ts";
import LeagueService from "./services/league.ts";
import { Workspace } from "./utils/workspace.ts";
import { pressAnyKey } from "./utils/press-any-key.ts";
import { createTray } from "./lib/tray.ts";
import { hideCmd } from "./utils/cmd.ts";

const main = defineCommand({
  meta: {
    name: APP.name,
    version: APP.version
  },
  args: {
    dev: {
      type: "boolean",
      description: "Run in development mode",
      required: false
    }
  },
  async run ({ args }) {
    runtime.dev = args.dev === true;
    consola.info(`Running ${APP.name} v${APP.version}`);
    try {
      await Workspace.setup(APP.name);
      await createTray();
      if (!runtime.dev) {
        const { isUpdateAvailable, updateApp } = await checkForUpdates();
        if (isUpdateAvailable && (await consola.prompt("¿Desea actualizar a la última versión?", {
          type: "select",
          initial: "Y",
          options: [
            { label: "Sí", value: "Y", hint: "Se descargará la última versión" },
            { label: "No", value: "N", hint: "Se continuará con la versión actual" }
          ]
        })) === "Y") {
          await updateApp();
        }
      }
      const server = await runHttp();
      const url = await startCloudflared();
      await Promise.all([
        lolScoreboardSync(),
        twitchAuth({ url })
      ]);
      await LeagueService.getInstance();
      runWebSocket({ server });
      consola.success("Setup complete. Please keep this app running to maintain the services live.");
      hideCmd();
    }
    catch (err) {
      consola.error(err);
      consola.box("An error occurred. Press any key to exit.");
      await pressAnyKey();
      process.exit(1);
    }
  }
});

runMain(main);
