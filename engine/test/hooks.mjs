// Lets `node --test` run the repo's TypeScript as it is written: relative imports without an extension, and the "@/" alias.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = new URL("../../", import.meta.url);
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) spec = new URL(spec.slice(2), ROOT).href;
  if ((spec.startsWith(".") || spec.startsWith("file:")) && !/\.[a-z]+$/i.test(spec)) { const base = spec.startsWith("file:") ? spec : new URL(spec, ctx.parentURL).href; for (const ext of [".ts", ".tsx", "/index.ts"]) if (existsSync(fileURLToPath(base + ext))) return next(pathToFileURL(fileURLToPath(base + ext)).href, ctx); }
  return next(spec, ctx);
}
