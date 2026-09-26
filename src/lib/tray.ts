import { platform } from "node:process";
import { join } from "node:path";
import { copyFile } from "node:fs/promises";
import consola from "consola";
import { Workspace } from "../utils/workspace.ts";
import metadata from "../utils/metadata.ts";
import { toggleCmd } from "../utils/cmd.ts";
import SysTrayModule from "systray2";
import { Icon, Menu, NotifyIcon } from "not-the-systray";
import koffi from "koffi";

const iconPath = platform === "win32" ? "assets/lolscoreboard.ico" : "assets/lolscoreboard.png";
const pkg = process?.pkg;

const createIcon = async () => {
  const dir = pkg ? __dirname : "src";
  const sourcePath = join(dir, iconPath);
  const destinationIcon = join(Workspace.path, iconPath);
  await copyFile(sourcePath, destinationIcon).catch(() => null);
  return destinationIcon;
};

const createWindowsTray = async () => {
  const icon = await createIcon();
  const menu = new Menu([
    { id: 1, text: "Show/Hide window" },
    { id: 2, text: "Exit" }
  ]);

  const appIcon = new NotifyIcon({
    icon: Icon.load(icon, Icon.small),
    tooltip: metadata.title,
    onSelect ({ rightButton, mouseX, mouseY }) {
      if (rightButton) {
        const selectedId = menu.showSync(mouseX, mouseY - 50);
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

  consola.info("System tray initialized (native Windows).");
};

const createFallbackTray = async () => {
  const SysTrayConstructor = (SysTrayModule as unknown as { default?: typeof SysTrayModule }).default ?? SysTrayModule;
  const icon = await createIcon();

  const systray = new SysTrayConstructor({
    menu: {
      icon,
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
  consola.info("System tray initialized (systray2 fallback).");
};

const enableSystemMenuTheme = () => {
  if (platform !== "win32") return;
  try {
    const kernel32 = koffi.load("kernel32.dll");
    const LoadLibraryA = kernel32.func("void *__stdcall LoadLibraryA(const char *name)");
    const GetProcAddress = kernel32.func("void *__stdcall GetProcAddress(void *hModule, void *name)");
    const hUxtheme = LoadLibraryA("uxtheme.dll");
    if (!hUxtheme) {
      return;
    }
    const pSetPreferredAppMode = GetProcAddress(hUxtheme, 135);
    const pFlushMenuThemes = GetProcAddress(hUxtheme, 136);
    if (!pSetPreferredAppMode || !pFlushMenuThemes) {
      return;
    }
    const SetPreferredAppModeProto = koffi.proto("int __stdcall SetPreferredAppModeProto(int mode)");
    const FlushMenuThemesProto = koffi.proto("void __stdcall FlushMenuThemesProto()");
    const AllowDark = 1; // enum PreferredAppMode: Default=0, AllowDark=1, ForceDark=2, ForceLight=3
    koffi.call(pSetPreferredAppMode, SetPreferredAppModeProto, AllowDark);
    koffi.call(pFlushMenuThemes, FlushMenuThemesProto);
  }
  catch {}
};

export const createTray = async () => {
  if (platform === "win32") {
    enableSystemMenuTheme();
    await createWindowsTray();
  }
  else {
    await createFallbackTray();
  }
};