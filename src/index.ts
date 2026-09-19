import { defineCommand, runMain } from "citty";
import { consola } from "consola";
import { Workspace } from "./utils/workspace.ts";
import { APP, checkForUpdates } from "./utils/app.ts";
import { runHttp } from "./services/http.ts";
import { startCloudflared } from "./lib/cloudflared.ts";
import { twitchAuth } from "./services/twitch.ts";
import LeagueService from "./services/league.ts";
import { leagueTabSync } from "./services/leaguetab.ts";

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
    consola.info(`Ejecutando ${APP.name} v${APP.version}`);
    try {
      consola.start("Setting up the workspace...");
      await Workspace.setup(APP.name);

      if (!args.dev) {
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
      await new LeagueService().init();
      const { id: userId, accessToken } = await twitchAuth();
      const port = 31537;
      await runHttp({ port });
      const url = await startCloudflared({ port });
      await leagueTabSync({ id: userId, accessToken, url, dev: args.dev });
      consola.success("Setup complete");
    }
    catch (err) {
      consola.error(err);
      process.exit(1);
    }
  }
});

runMain(main);
