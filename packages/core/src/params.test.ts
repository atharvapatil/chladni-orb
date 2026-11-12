import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, PARAM_SCHEMA, mergeParams } from "./params";

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

describe("DEFAULT_PARAMS vs PARAM_SCHEMA", () => {
  it("every default value exists in the schema and respects its range/options", () => {
    for (const [path, entry] of Object.entries(PARAM_SCHEMA)) {
      const value = getPath(DEFAULT_PARAMS, path);
      expect(value, `${path} missing in DEFAULT_PARAMS`).not.toBeUndefined();
      if (entry.kind === "number") {
        expect(typeof value).toBe("number");
        const v = value as number;
        if (entry.min !== undefined) expect(v, path).toBeGreaterThanOrEqual(entry.min);
        if (entry.max !== undefined) expect(v, path).toBeLessThanOrEqual(entry.max);
      } else if (entry.kind === "enum") {
        expect(entry.options).toContain(value);
      } else if (entry.kind === "boolean") {
        expect(typeof value).toBe("boolean");
      } else {
        expect(typeof value).toBe("string");
      }
    }
  });
});

describe("mergeParams", () => {
  it("applies a patch per group without mutating base", () => {
    const base = structuredClone(DEFAULT_PARAMS);
    const merged = mergeParams(base, {
      plate: { size: 50 },
      listening: { partials: 4 },
    });
    expect(merged.plate.size).toBe(50);
    expect(merged.listening.partials).toBe(4);
    expect(merged.plate.shape).toBe(base.plate.shape);
    expect(base.plate.size).toBe(DEFAULT_PARAMS.plate.size);
    expect(base.listening.partials).toBe(DEFAULT_PARAMS.listening.partials);
    expect(merged).not.toBe(base);
  });
});
