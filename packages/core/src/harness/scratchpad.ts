import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * File-buffer scratchpad. Large tool results are written here and only a pointer +
 * short summary is kept in the model's context — the core context-rot mitigation.
 */
export class Scratchpad {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  private safe(name: string): string {
    return name.replace(/[^a-z0-9._-]/gi, "_").slice(0, 80);
  }

  write(name: string, content: string): { file: string; bytes: number } {
    const file = this.safe(name);
    writeFileSync(resolve(this.dir, file), content);
    return { file, bytes: content.length };
  }

  read(name: string): string {
    const file = this.safe(name);
    const path = resolve(this.dir, file);
    if (!existsSync(path)) throw new Error(`no scratchpad file '${file}'`);
    return readFileSync(path, "utf8");
  }
}
