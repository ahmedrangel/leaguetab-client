import { IngameAPI } from "@hasagi/ingame-api";
import { HasagiClient } from "@hasagi/core";
import { LolApi } from "twisted";
import { $fetch } from "ofetch";
import type { LolL10nRegionLocale } from "@hasagi/core/types";
import consola from "consola";
import { hideCmd } from "../utils/cmd";

export default class LeagueService {
  private readonly lol = new LolApi();
  private readonly client = new HasagiClient();
  private readonly ddragonCdn = "https://ddragon.leagueoflegends.com/cdn";
  private version!: string;
  private region!: LolL10nRegionLocale;
  private champs!: Awaited<ReturnType<typeof this.lol.DataDragon.getChampionList>>;
  private items!: Awaited<ReturnType<typeof this.lol.DataDragon.getItemList>>;
  private runes!: Awaited<ReturnType<typeof this.lol.DataDragon.getRunesReforged>>;
  private summonerSpells!: { data: Record<string, { id: string, name: string, image: { full: string } }> };
  private initialized: boolean;
  private gameStarted: boolean;
  private lastVersionCheck = 0;
  private versionRefresh: Promise<void> | null = null;
  private readonly versionCheckInterval = 10 * 60 * 1000;
  private static instance: LeagueService | null = null;

  constructor () {
    this.initialized = false;
    this.gameStarted = false;
  }
  public static async getInstance () {
    if (!this.instance) {
      this.instance = new LeagueService();
      await this.instance.init();
    }
    return this.instance;
  }

  private async init () {
    consola.start("Initializing League Service...");
    if (this.initialized) {
      consola.success("League Service already initialized.");
      return true;
    }
    try {
      await this.client.connect({
        maxConnectionAttempts: 3,
        authenticationStrategy: "process"
      });
      this.client.on("disconnected", () => {
        this.initialized = false;
        consola.warn("League of Legends Client disconnected.");
        LeagueService.instance = null;
        this.client.removeAllLCUEventListeners();
      });
      this.client.addLCUEventListener({
        path: "/lol-gameflow/v1/gameflow-phase",
        types: ["Update"],
        callback: event => this.gameStarted = event.data === "InProgress" || event.data === "GameStart"
      });

      await this.loadDataDragon();
      this.initialized = true;
      consola.success("League Service initialized successfully.");
      hideCmd();
      return true;
    }
    catch {
      this.initialized = false;
      consola.warn("Failed to initialize. Please make sure the League of Legends Client is running. Trying again...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.init();
    }
  }

  private async loadDataDragon (version?: string, region?: LolL10nRegionLocale) {
    const [versions, currentRegion] = await Promise.all([
      version ? Promise.resolve([version]) : this.lol.DataDragon.getVersions(),
      region ? Promise.resolve(region) : this.client.request("get", "/riotclient/region-locale")
    ]);
    const currentVersion = versions[0];
    if (!currentVersion) throw new Error("Could not determine the current Data Dragon version.");
    const [champs, items, runes, summonerSpells] = await Promise.all([
      this.lol.DataDragon.getChampionList(currentRegion.locale),
      this.lol.DataDragon.getItemList(currentRegion.locale),
      this.lol.DataDragon.getRunesReforged(currentRegion.locale),
      $fetch(`${this.ddragonCdn}/${currentVersion}/data/${currentRegion.locale}/summoner.json`)
    ]);

    this.version = currentVersion;
    this.region = currentRegion;
    this.champs = champs;
    this.items = items;
    this.runes = runes;
    this.summonerSpells = summonerSpells;
  }

  async gameData () {
    if (!this.initialized) {
      return {
        game: {
          version: this.version,
          started: false,
          dragonSoul: null
        },
        resources: {
          cdn: this.ddragonCdn
        },
        teams: this.emptyTeams(),
        players: []
      };
    }
    await this.refreshDataDragonIfNeeded();
    const players = await this.getPlayersData();
    const eventsData = await IngameAPI.getEvents().catch(() => null);
    const teams = await this.teamData(players, eventsData);

    return {
      game: {
        version: this.version,
        started: players.length ? true : this.gameStarted,
        dragonSoul: eventsData?.Events?.filter(event => event.EventName === "DragonKill")?.[2]?.DragonType || null
      },
      resources: {
        cdn: this.ddragonCdn
      },
      teams,
      players
    };
  }

  private async refreshDataDragonIfNeeded () {
    const now = Date.now();
    if (now - this.lastVersionCheck < this.versionCheckInterval) return;
    if (this.versionRefresh) return this.versionRefresh;

    this.lastVersionCheck = now;
    this.versionRefresh = (async () => {
      try {
        const [versions, region] = await Promise.all([
          this.lol.DataDragon.getVersions(),
          this.client.request("get", "/riotclient/region-locale")
        ]);
        const latestVersion = versions[0];
        if (!latestVersion || (latestVersion === this.version && region.locale === this.region.locale)) return;

        await this.loadDataDragon(latestVersion, region);
        consola.info(`League data updated to version ${latestVersion} for locale ${region.locale}.`);
      }
      catch (error) {
        consola.warn("Could not check for League data updates:", error);
      }
      finally {
        this.versionRefresh = null;
      }
    })();

    await this.versionRefresh;
  }

  private async getPlayersData () {
    const data = await IngameAPI.getPlayerList().catch(() => null);
    if (!data) return [];
    return data.map((player) => {
      const champion = Object.values(this.champs.data).find(champ => champ.name === player.championName);
      const spellOne = Object.values(this.summonerSpells.data).find((spell) => {
        const rawDisplayName = player.summonerSpells.summonerSpellOne.rawDisplayName;
        if (rawDisplayName.includes("Smite")) {
          return spell.id === "SummonerSmite";
        }
        if (rawDisplayName.includes("Teleport")) {
          return spell.id === "SummonerTeleport";
        }
        return spell.name === player.summonerSpells.summonerSpellOne.displayName;
      });

      const spellTwo = Object.values(this.summonerSpells.data).find((spell) => {
        const rawDisplayName = player.summonerSpells.summonerSpellTwo.rawDisplayName;
        if (rawDisplayName.includes("Smite")) {
          return spell.id === "SummonerSmite";
        }
        if (rawDisplayName.includes("Teleport")) {
          return spell.id === "SummonerTeleport";
        }
        return spell.name === player.summonerSpells.summonerSpellTwo.displayName;
      });

      const keystoneIcon = this.runes.flatMap(tree => tree.slots).find(slot => slot.runes.some(rune => rune.id === player.runes.keystone.id))?.runes.find(rune => rune.id === player.runes.keystone.id)?.icon;
      const primaryRuneTreeIcon = this.runes.find(tree => tree.id === player.runes.primaryRuneTree.id)?.icon;
      const secondaryRuneTreeIcon = this.runes.find(tree => tree.id === player.runes.secondaryRuneTree.id)?.icon;

      return {
        champion: {
          displayName: player.championName,
          iconURL: champion ? champion.image.full : ""
        },
        isDead: player.isDead,
        level: player.level,
        position: player.position,
        respawnTimer: player.respawnTimer,
        riotId: player.riotId,
        riotIdGameName: player.riotIdGameName,
        riotIdTagLine: player.riotIdTagLine,
        summonerName: player.summonerName,
        team: player.team === "ORDER" ? "blue" : "red",
        scores: player.scores,
        items: player.items.map((item) => {
          const itemData = this.items.data[item.itemID];
          return {
            displayName: item.displayName,
            slot: item.slot,
            count: item.count,
            iconURL: itemData ? itemData.image.full : ""
          };
        }),
        summonerSpells: {
          summonerSpellOne: {
            displayName: player.summonerSpells.summonerSpellOne.displayName,
            iconURL: spellOne ? spellOne.image.full : ""
          },
          summonerSpellTwo: {
            displayName: player.summonerSpells.summonerSpellTwo.displayName,
            iconURL: spellTwo ? spellTwo.image.full : ""
          }
        },
        runes: {
          keystone: {
            displayName: player.runes.keystone.displayName,
            iconURL: keystoneIcon ? keystoneIcon : ""
          },
          primaryRuneTree: {
            displayName: player.runes.primaryRuneTree.displayName,
            iconURL: primaryRuneTreeIcon ? primaryRuneTreeIcon : ""
          },
          secondaryRuneTree: {
            displayName: player.runes.secondaryRuneTree.displayName,
            iconURL: secondaryRuneTreeIcon ? secondaryRuneTreeIcon : ""
          }
        }
      };
    });
  }

  private getPlayerTeam (playerList: Awaited<ReturnType<typeof this.getPlayersData>>, eventPlayerName: string) {
    return playerList.find(player => player.riotIdGameName === eventPlayerName || player.summonerName === eventPlayerName)?.team || null;
  }

  private async teamData (playerList: Awaited<ReturnType<typeof this.getPlayersData>>, events: Awaited<ReturnType<typeof IngameAPI.getEvents>>) {
    const eventsData = events?.Events || [];
    const teams = this.emptyTeams();

    for (const player of playerList) {
      if (player.team === "blue") {
        teams.blue.score += player.scores?.kills || 0;
      }
      else if (player.team === "red") {
        teams.red.score += player.scores?.kills || 0;
      }
    }

    if (eventsData.length) {
      for (const event of eventsData) {
        switch (event.EventName) {
          case "DragonKill": {
            const killerName = event.KillerName;
            const dragonType = event.DragonType;
            const playerTeam = this.getPlayerTeam(playerList, killerName);
            if (playerTeam === "blue" || playerTeam === "red") {
              teams[playerTeam].dragons += 1;
              if (dragonType) {
                teams[playerTeam].dragonTypes.push(dragonType);
              }
            }
            break;
          }
          case "HeraldKill": {
            const killerName = event.KillerName;
            const playerTeam = this.getPlayerTeam(playerList, killerName);
            if (playerTeam === "blue" || playerTeam === "red") {
              teams[playerTeam].heralds += 1;
            }
            break;
          }
          case "BaronKill": {
            const killerName = event.KillerName;
            const playerTeam = this.getPlayerTeam(playerList, killerName);
            if (playerTeam === "blue" || playerTeam === "red") {
              teams[playerTeam].barons += 1;
            }
            break;
          }
          case "TurretKilled": {
            const turretKilled = event.TurretKilled;
            const turretKilledTeam = turretKilled.includes("Chaos") ? "red" : "blue";
            const turretKillerTeam = turretKilledTeam === "blue" ? "red" : "blue";
            if (turretKilledTeam === "blue" || turretKilledTeam === "red") {
              teams[turretKillerTeam].turrets += 1;
            }
            break;
          }
          case "HordeKill": {
            const killerName = event.KillerName;
            const playerTeam = this.getPlayerTeam(playerList, killerName);
            if (playerTeam === "blue" || playerTeam === "red") {
              teams[playerTeam].grubs += 1;
            }
            break;
          }
        }
      }
    }
    return teams;
  }

  private emptyTeams () {
    return {
      blue: {
        score: 0,
        dragons: 0,
        dragonTypes: [] as string[],
        grubs: 0,
        heralds: 0,
        barons: 0,
        turrets: 0
      },
      red: {
        score: 0,
        dragons: 0,
        dragonTypes: [] as string[],
        grubs: 0,
        heralds: 0,
        barons: 0,
        turrets: 0
      }
    };
  }
}
