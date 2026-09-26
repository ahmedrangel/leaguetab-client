import { pkg, platform } from "node:process";
import { join } from "node:path";
import { copyFile } from "node:fs/promises";
import consola from "consola";
import { Workspace } from "../utils/workspace.ts";
import metadata from "../utils/metadata.ts";
import { toggleCmd } from "../utils/cmd.ts";
import SysTrayModule from "systray2";
import { Icon, Menu, NotifyIcon } from "not-the-systray";

const iconPath = platform === "win32" ? "assets/lolscoreboard.ico" : "assets/lolscoreboard.png";

const createWindowsTray = async () => {
  const dir = pkg ? __dirname : "src";
  const sourcePath = join(dir, iconPath);
  const destinationIcon = join(Workspace.path, iconPath);
  await copyFile(sourcePath, destinationIcon);

  const menu = new Menu([
    { id: 1, text: "Show/Hide window" },
    { id: 2, text: "Exit" }
  ]);

  const appIcon = new NotifyIcon({
    icon: Icon.load(destinationIcon, Icon.small),
    tooltip: metadata.title,
    onSelect ({ rightButton, mouseX, mouseY }) {
      if (rightButton) {
        const selectedId = menu.showSync(mouseX, mouseY);
        switch (selectedId) {
          case 1:
            toggleCmd();
            break;
          case 2:
            consola.info("Exiting...");
            appIcon.remove();
            process.exit(0);
        }
      }
      else {
        toggleCmd();
      }
    }
  });

  consola.info("System tray initialized successfully (native Windows).");
};

const createFallbackTray = async () => {
  const SysTrayConstructor = (SysTrayModule as unknown as { default?: typeof SysTrayModule }).default ?? SysTrayModule;
  const dir = pkg ? __dirname : "src";
  const iconDir = join(dir, iconPath);
  const destinationIcon = join(Workspace.path, iconPath);
  await copyFile(iconDir, destinationIcon);

  const systray = new SysTrayConstructor({
    menu: {
      icon: destinationIcon,
      isTemplateIcon: platform === "darwin",
      title: metadata.title,
      tooltip: metadata.title,
      items: [
        { title: "Show/Hide window", tooltip: "Show/Hide window", enabled: true },
        { title: "Exit", tooltip: "Exit", enabled: true }
      ]
    },
    debug: false,
    copyDir: true
  });

  systray.onClick((action) => {
    switch (action.item.title) {
      case "Show/Hide window":
        toggleCmd();
        break;
      case "Exit":
        consola.info("Exiting...");
        systray.kill(false);
        process.exit(0);
    }
  });

  await systray.ready().catch((error) => {
    consola.error("Failed to initialize system tray:", error);
  });
  consola.info("System tray initialized successfully (systray2 fallback).");
};

export const createTray = async () => {
  if (platform === "win32") await createWindowsTray();
  else await createFallbackTray();
};
