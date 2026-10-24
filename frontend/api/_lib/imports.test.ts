// Vercel's Node runtime compiles each api/ file on its own, without bundling,
// and this package is ESM ("type": "module"). Node ESM only resolves relative
// imports that name the file extension, so `./_lib/github` fails at cold start
// with ERR_MODULE_NOT_FOUND and every request answers 500 — which is exactly
// what production did on 2026-10-24. Vite and vitest both accept `.js` for a
// `.ts` neighbour, so the deployable form is the one we write.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const API_DIR = join(__dirname, "..");

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsFiles(full);
    return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [full] : [];
  });
}

describe("api/ relative imports", () => {
  it("every relative import names its .js extension (Node ESM cold start)", () => {
    const offenders: string[] = [];
    for (const file of tsFiles(API_DIR)) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
        if (!m[1].endsWith(".js")) offenders.push(`${file.slice(API_DIR.length + 1)}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
