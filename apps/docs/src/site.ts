import { SimulatedVoice, type ChladniParams, type DeepPartial } from "chladni-orb";
import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

// the plate reads as a page element: light theme uses dark grains on a light felt
export const THEME_LOOK: Record<Theme, DeepPartial<ChladniParams>> = {
  dark: {
    look: { color: "#f3ead8", plateAlpha: 1, plateColor: "#1a1a1c", amount: 1, halo: "none" },
  },
  light: {
    look: { color: "#2b2520", plateAlpha: 1, plateColor: "#e9e6df", amount: 1, halo: "none" },
  },
};

// the site's one opinion beyond the palette: in silence the sand relaxes
// back over the plate instead of holding the last figure. It stays in the
// quick-start snippet on purpose — it's what gives the Idle state.
export const SITE_PARAMS: DeepPartial<ChladniParams> = { listening: { idle: "relax" } };

export function initialTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("chladni-theme", next);
      return next;
    });
  }, []);
  return [theme, toggle];
}

/** one simulated voice shared by every demo plate on the site */
export const simVoice = new SimulatedVoice();

/** `#/docs/...` routes to the docs page; anything else is the home page. */
export function useRoute(): string {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return hash;
}
