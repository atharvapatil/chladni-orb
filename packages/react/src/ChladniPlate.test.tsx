// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChladniPlate } from "./ChladniPlate";

const fake = {
  setParams: vi.fn(),
  setAnalyser: vi.fn(),
  setState: vi.fn(),
  getState: () => "talking",
  freeze: vi.fn(),
  reset: vi.fn(),
  resetSand: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
  partials: [],
  supported: true,
};

vi.mock("chladni-orb-core", async (importOriginal) => {
  const mod = await importOriginal<typeof import("chladni-orb-core")>();
  return { ...mod, createChladniPlate: vi.fn(() => fake) };
});

import { createChladniPlate, DEFAULT_PARAMS } from "chladni-orb-core";
import type { ChladniParams } from "chladni-orb-core";

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

  it("setParams is called with a full params object when the prop changes", async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(<ChladniPlate params={{ plate: { size: 30 } }} />);
    });
    const arg = fake.setParams.mock.calls.at(-1)![0] as ChladniParams;
    expect(arg.plate.size).toBe(30);
    expect(arg.listening).toEqual(DEFAULT_PARAMS.listening);
    await act(async () => {
      root.render(<ChladniPlate params={{ plate: { size: 50 } }} />);
    });
    expect((fake.setParams.mock.calls.at(-1)![0] as ChladniParams).plate.size).toBe(50);
  });

  it("removing a params key resets it to the default (authoritative prop)", async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(<ChladniPlate params={{ plate: { exciterX: 0.5 } }} />);
    });
    expect((fake.setParams.mock.calls.at(-1)![0] as ChladniParams).plate.exciterX).toBe(0.5);
    await act(async () => {
      root.render(<ChladniPlate params={{}} />);
    });
    expect((fake.setParams.mock.calls.at(-1)![0] as ChladniParams).plate.exciterX).toBe(
      DEFAULT_PARAMS.plate.exciterX,
    );
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

  it("state follows the state prop", async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(<ChladniPlate state="idle" />);
    });
    expect(fake.setState).toHaveBeenLastCalledWith("idle");
    await act(async () => {
      root.render(<ChladniPlate state="listening" />);
    });
    expect(fake.setState).toHaveBeenLastCalledWith("listening");
  });

  it("hands the handle to onReady and to a ref, and clears the ref on unmount", async () => {
    root = createRoot(container);
    const ref = { current: null as unknown };
    const onReady = vi.fn();
    await act(async () => {
      root.render(<ChladniPlate ref={ref as never} onReady={onReady} />);
    });
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady.mock.calls[0]![0]).toBe(fake);
    expect(ref.current).toBe(fake);
    act(() => root.unmount());
    expect(ref.current).toBeNull();
    root = createRoot(container);
  });

  it("forwards canvas attributes and leaves the engine alone when props are omitted", async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(<ChladniPlate className="orb" aria-label="Agent" />);
    });
    const canvas = container.querySelector("canvas")!;
    expect(canvas.className).toBe("orb");
    expect(canvas.getAttribute("aria-label")).toBe("Agent");
    expect(fake.setState).not.toHaveBeenCalled();
    expect(fake.freeze).not.toHaveBeenCalled();
    expect(fake.setAnalyser).not.toHaveBeenCalled();
  });

  it("passes mount-time options and the initial state to createChladniPlate", async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(
        <ChladniPlate state="idle" pixelRatio={1} fieldResolution={64} particleTexSize={32} />,
      );
    });
    const opts = (createChladniPlate as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1];
    expect(opts).toMatchObject({
      state: "idle",
      pixelRatio: 1,
      fieldResolution: 64,
      particleTexSize: 32,
    });
  });

  it("a params change while frozen keeps the plate frozen", async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(<ChladniPlate frozen={true} params={{ plate: { size: 30 } }} />);
    });
    await act(async () => {
      root.render(<ChladniPlate frozen={true} params={{ plate: { size: 40 } }} />);
    });
    const arg = fake.setParams.mock.calls.at(-1)![0] as ChladniParams;
    expect(arg.plate.size).toBe(40);
    expect(arg.listening.freeze).toBe(true);
  });
});
