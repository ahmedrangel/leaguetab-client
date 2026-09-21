import { IngameAPI } from "@hasagi/ingame-api";
import { HasagiClient } from "@hasagi/core";
import { LolApi } from "twisted";
import { $fetch } from "ofetch";
import type { LolL10nRegionLocale } from "@hasagi/core/types";
import consola from "consola";

export default class LeagueService {
  private readonly lol = new LolApi();
  private readonly client = new HasagiClient();
  private readonly ddragonCdn = "http://ddragon.leagueoflegends.com/cdn";
  private version!: string;
  private region!: LolL10nRegionLocale;
  private champs!: Awaited<ReturnType<typeof this.lol.DataDragon.getChampionList>>;
  private items!: Awaited<ReturnType<typeof this.lol.DataDragon.getItemList>>;
  private runes!: Awaited<ReturnType<typeof this.lol.DataDragon.getRunesReforged>>;
  private summonerSpells!: { data: Record<string, { id: string, name: string, image: { full: string } }> };
  private initialized: boolean;
  private gameStarted: boolean;
  private static instance: LeagueService | null = null;

  constructor () {
    this.initialized = false;
    this.gameStarted = false;
  }
  public static async getInstance () {
    if (!LeagueService.instance) {
      LeagueService.instance = new LeagueService();
      await LeagueService.instance.init();
    }
    return LeagueService.instance;
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
      this.client.addLCUEventListener({
        path: "/lol-gameflow/v1/gameflow-phase",
        types: ["Update"],
        callback: event => this.gameStarted = event.data === "InProgress" || event.data === "GameStart"
      });

      this.region = await this.client.request("get", "/riotclient/region-locale");
      const [versions, champs, items, runes] = await Promise.all([
        this.lol.DataDragon.getVersions(),
        this.lol.DataDragon.getChampionList(this.region.locale),
        this.lol.DataDragon.getItemList(this.region.locale),
        this.lol.DataDragon.getRunesReforged(this.region.locale)
      ]);

      this.version = versions[0]!;
      this.summonerSpells = await $fetch(`${this.ddragonCdn}/${this.version}/data/${this.region.locale}/summoner.json`);
      this.champs = champs;
      this.items = items;
      this.runes = runes;
      this.initialized = true;
      consola.success("League Service initialized successfully.");
      return true;
    }
    catch {
      this.initialized = false;
      throw new Error("Client not available. Please make sure the League of Legends Client is running.");
    }
  }

  async gameData () {
    if (!this.initialized) {
      return { gameStarted: false, teams: this.emptyTeams(), players: [] };
    }
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
