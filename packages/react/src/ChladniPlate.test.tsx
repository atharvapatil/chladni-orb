// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChladniPlate } from "./ChladniPlate";

const fake = {
  setParams: vi.fn(),
  setAnalyser: vi.fn(),
  freeze: vi.fn(),
  reset: vi.fn(),
  resetSand: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
  partials: [],
  supported: true,
};

vi.mock("@chladni/core", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@chladni/core")>();
  return { ...mod, createChladniPlate: vi.fn(() => fake) };
});

import { createChladniPlate } from "@chladni/core";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

describe("ChladniPlate", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("creates the plate once on mount and destroys on unmount", async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(<ChladniPlate />);
    });
    expect(createChladniPlate).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    expect(fake.destroy).toHaveBeenCalledTimes(1);
    // remount path for afterEach
    root = createRoot(container);
  });

  it("setParams is called when the params prop changes", async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(<ChladniPlate params={{ plate: { size: 30 } }} />);
    });
    expect(fake.setParams).toHaveBeenCalledWith({ plate: { size: 30 } });
    await act(async () => {
      root.render(<ChladniPlate params={{ plate: { size: 50 } }} />);
    });
    expect(fake.setParams).toHaveBeenLastCalledWith({ plate: { size: 50 } });
  });

  it("freeze follows the frozen prop", async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(<ChladniPlate frozen={false} />);
    });
    await act(async () => {
      root.render(<ChladniPlate frozen={true} />);
    });
    expect(fake.freeze).toHaveBeenLastCalledWith(true);
  });
});
