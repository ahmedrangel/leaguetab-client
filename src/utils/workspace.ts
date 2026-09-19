import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FOLDERS = ["cache"] as const;
type WorkspaceFolders = typeof FOLDERS[number];

export class Workspace {
  static instance?: Workspace;
  static path: string;
  static dirs: Record<WorkspaceFolders, string>;

  private static readonly FOLDERS = FOLDERS;

  static async setup (runtimeName: string): Promise<Workspace> {
    Workspace.path = join(process.env.LOCALAPPDATA || tmpdir(), runtimeName);
    Workspace.dirs = {} as Record<WorkspaceFolders, string>;

    // Iterate over the FOLDERS array and store the paths in the dirs object
    for (const folder of Workspace.FOLDERS) {
      Workspace.dirs[folder] = join(Workspace.path, folder);
    }

    // Directories to be created for the workspace
    await Promise.all([
      mkdir(Workspace.dirs.cache, { recursive: true })
    ]);

    Workspace.instance = new Workspace();
    return Workspace.instance;
  }

  write (filename: string, data: string) {
    const filePath = join(Workspace.path, filename);
    return writeFile(filePath, data);
  }

  // Cache management methods
  get cache () {
    return {
      write: async (filename: string, data: string) => {
        const filePath = join(Workspace.dirs.cache, filename);
        return writeFile(filePath, data);
      },
      read: async (filename: string) => {
        const filePath = join(Workspace.dirs.cache, filename);
        return readFile(filePath, "utf-8").catch(() => null);
      },
      delete: async (filename: string) => {
        const filePath = join(Workspace.dirs.cache, filename);
        return rm(filePath, { force: true });
      }
    };
  }
}
