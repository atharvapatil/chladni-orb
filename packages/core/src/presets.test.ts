import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, PARAM_SCHEMA, mergeParams } from "./params";
import { PRESETS } from "./presets";

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

describe("PRESETS", () => {
  it.each(Object.keys(PRESETS))("%s merged over defaults satisfies PARAM_SCHEMA", (key) => {
    const merged = mergeParams(DEFAULT_PARAMS, PRESETS[key]!.params);
    for (const [path, entry] of Object.entries(PARAM_SCHEMA)) {
      const v = getPath(merged, path);
      if (entry.kind === "number" && typeof v === "number") {
        if (entry.min !== undefined) expect(v, `${key}:${path}`).toBeGreaterThanOrEqual(entry.min);
        if (entry.max !== undefined) expect(v, `${key}:${path}`).toBeLessThanOrEqual(entry.max);
      } else if (entry.kind === "enum") {
        expect(entry.options, `${key}:${path}`).toContain(v);
      }
    }
  });
});
