import { describe, expect, it } from "vitest";
import * as core from "chladni-orb-core";
import * as api from "./index";

/**
 * chladni-orb re-exports the whole engine plus the component and hook, so
 * React apps need only this package. If this fails, the surface changed:
 * restore the export or update this list and add a changeset.
 */
describe("chladni-orb public API", () => {
  it("exports the component, the hook, and everything from chladni-orb-core", () => {
    const names = Object.keys(api).sort();
    expect(names).toContain("ChladniPlate");
    expect(names).toContain("useChladniPlate");
    for (const name of Object.keys(core)) expect(names, name).toContain(name);
  });
});
