import resedit from "resedit-cli";
import pkg from "../package.json" with { type: "json" };

const owner = "JimTracker";
const path = "./pkg/lolscoreboard-client.exe";
// const iconPath = "./assets/favicon.ico";
const version = pkg.version;

const lang = 1033; // en-US

await resedit({
  in: path,
  out: path,
  definition: {
    lang,
    // icons: [{ id: 1, sourceFile: iconPath }],
    version: {
      productName: `${owner} LoL Scoreboard Client`,
      fileDescription: pkg.description,
      fileVersion: `${version}.0`,
      productVersion: version,
      companyName: owner,
      legalCopyright: `© ${new Date().getFullYear()} ${owner}`
    }
  }
});