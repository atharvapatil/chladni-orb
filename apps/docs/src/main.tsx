import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { DocsPage } from "./docs/DocsPage";
import { useRoute } from "./site";

function Root() {
  const hash = useRoute();
  return hash.startsWith("#/docs") ? <DocsPage hash={hash} /> : <App />;
}

const el = document.getElementById("root");
if (!el) throw new Error("missing #root");

createRoot(el).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
