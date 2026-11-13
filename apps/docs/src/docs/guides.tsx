import { PRESETS } from "@chladni/react";
import type { ReactNode } from "react";
import { Steps } from "../components/Steps";

export interface Guide {
  id: string;
  title: string;
  summary: string;
  body: ReactNode;
}

const presetCode = (key: string) =>
  JSON.stringify(PRESETS[key]!.params, null, 2).replace(/"(\w+)":/g, "$1:");

export const GUIDES: Guide[] = [
  {
    id: "getting-started",
    title: "Getting started",
    summary: "What this is, how it works in plain words, and what you need to run it.",
    body: (
      <>
        <h3>What it is</h3>
        <p>
          A Chladni plate is a flat plate with sand on it. When the plate vibrates, the sand jumps
          away from the parts that move and gathers on the lines that stay still. Different notes
          make different patterns.
        </p>
        <p>
          This library puts that plate in the browser and lets a voice drive it. Give it a sound and
          it draws the voice as those sand patterns, live. It was built to be the face of an AI
          voice agent: something on screen that is clearly alive, listening, or speaking, without
          showing a waveform.
        </p>

        <h3>How it works, briefly</h3>
        <p>
          Sound comes in through a Web Audio <code>AnalyserNode</code>. Each frame the plate picks
          out the strongest notes in it. Each note shakes the plate's natural shapes that sit near
          that pitch. The result is drawn as a vibration pattern, and thousands of grains of sand
          move across it, jumping where it shakes and settling where it is still.
        </p>
        <p>
          Everything about the plate, from its shape to its paint, is one settings object called{" "}
          <code>params</code>. The groups in the sidebar document every key in it.
        </p>

        <h3>What you need</h3>
        <ul>
          <li>A browser with WebGL2. Every current desktop and mobile browser has it.</li>
          <li>
            For a microphone: a secure page (https or localhost) and a click or tap from the user
            before audio can start. That is a browser rule, not ours.
          </li>
          <li>
            React 18 or newer for <code>@chladni/react</code>. The engine itself has no dependencies
            and works without React.
          </li>
        </ul>
        <p>
          If WebGL2 is missing, the plate paints a flat colour and reports{" "}
          <code>supported: false</code> on its handle, so you can show something else.
        </p>

        <h3>The two packages</h3>
        <ul>
          <li>
            <code>@chladni/react</code>: the <code>&lt;ChladniPlate /&gt;</code> component. It
            re-exports everything from the engine, so React apps only need this one.
          </li>
          <li>
            <code>@chladni/core</code>: the engine. <code>createChladniPlate(canvas)</code> and the
            same handle, for any framework or none.
          </li>
        </ul>
        <p>
          Next: <a href="#/docs/guide/quick-start">Install and quick start</a>.
        </p>
      </>
    ),
  },
  {
    id: "quick-start",
    title: "Install and quick start",
    summary: "Three steps from an empty project to a plate reacting to a voice.",
    body: (
      <>
        <Steps
          steps={[
            {
              title: "Install",
              summary: "One package for React, or the engine on its own.",
              body: (
                <pre>
                  <code>{`npm i @chladni/react @chladni/core
# engine only, no React:
npm i @chladni/core`}</code>
                </pre>
              ),
            },
            {
              title: "Give it a voice",
              summary: "Any Web Audio AnalyserNode, or the built-in demo voice.",
              body: (
                <>
                  <p>
                    The helpers below create an analyser with good settings. If you already have
                    your own node, set <code>fftSize</code> to 8192 and{" "}
                    <code>smoothingTimeConstant</code> to about 0.5.
                  </p>
                  <pre>
                    <code>{`import {
  createMicAnalyser, createElementAnalyser, SimulatedVoice,
} from "@chladni/react";

const mic = await createMicAnalyser();      // the caller's microphone
const tts = createElementAnalyser(audioEl); // an <audio> element, e.g. the agent's voice
const demo = new SimulatedVoice();          // a pretend voice, no audio needed`}</code>
                  </pre>
                </>
              ),
            },
            {
              title: "Render it",
              summary: "Drop the component in and size it with CSS.",
              body: (
                <>
                  <pre>
                    <code>{`import { ChladniPlate } from "@chladni/react";

<ChladniPlate
  analyser={mic.analyser}
  params={{ listening: { idle: "relax" } }}
  style={{ width: 320, height: 320 }}
/>`}</code>
                  </pre>
                  <p>Without React, the same thing on a canvas you own:</p>
                  <pre>
                    <code>{`import { createChladniPlate } from "@chladni/core";

const plate = createChladniPlate(document.querySelector("canvas"), {
  params: { listening: { idle: "relax" } },
});
plate.setAnalyser(mic.analyser);`}</code>
                  </pre>
                </>
              ),
            },
          ]}
        />
        <h3>Then</h3>
        <ul>
          <li>
            Wire the call up with the <a href="#/docs/guide/states">state</a> prop.
          </li>
          <li>
            Pick a <a href="#/docs/guide/presets">preset</a> or tune the look on the right and copy
            the code it produces.
          </li>
          <li>
            The home page's <a href="#use">Quick start</a> has a live version of step 3 that follows
            the stage.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "states",
    title: "Voice-agent states",
    summary: "Map your call onto the plate with one prop.",
    body: (
      <>
        <p>
          A call has a few moments that look different: before it starts, while it connects, while
          the caller speaks, while your agent speaks. The plate has a state for each. You keep the
          agent's sound connected the whole time and flip one prop.
        </p>
        <pre>
          <code>{`import { ChladniPlate, type AgentState } from "@chladni/react";

const [state, setState] = useState<AgentState>("idle");

<ChladniPlate analyser={agentAudio} state={state} />`}</code>
        </pre>

        <h3>The four states</h3>
        <ul>
          <li>
            <code>idle</code>: before a call. The sand rests, spread evenly, with a gentle shiver.
          </li>
          <li>
            <code>connecting</code>: while dialling. Pulses roll out from the centre through the
            sand, so waiting looks like working.
          </li>
          <li>
            <code>listening</code>: while the caller speaks. The same pulses, drawn in from the
            edge, like the plate is taking it in. The caller's audio is not shown as a waveform.
          </li>
          <li>
            <code>talking</code>: while your agent speaks. The normal plate: it listens to the
            analyser and draws the voice.
          </li>
        </ul>
        <p>
          The quiet states ignore the sound, so you do not need to disconnect anything. The same
          grains carry over between states: going from talking to idle, the figure dissolves into
          the resting spread; going back, it forms again from wherever the grains are.
        </p>

        <h3>A typical flow</h3>
        <pre>
          <code>{`call.on("dialing",        () => setState("connecting"));
call.on("connected",      () => setState("listening"));
call.on("agent-speaking", () => setState("talking"));
call.on("agent-done",     () => setState("listening"));
call.on("ended",          () => setState("idle"));`}</code>
        </pre>

        <h3>Without React</h3>
        <pre>
          <code>{`const plate = createChladniPlate(canvas);
plate.setAnalyser(agentAudio);
plate.setState("connecting");`}</code>
        </pre>
        <p>
          Try the states on the plate to the right, or read the{" "}
          <a href="#/docs/prop.state">state prop</a> entry.
        </p>
      </>
    ),
  },
  {
    id: "presets",
    title: "Presets",
    summary: "Ready-made settings to start from.",
    body: (
      <>
        <p>
          A preset is just a <code>params</code> object. Pass it as the prop, or spread it and
          change a key or two. There is nothing special about them beyond being good starting
          points.
        </p>
        <pre>
          <code>{`import { ChladniPlate, PRESETS } from "@chladni/react";

<ChladniPlate analyser={analyser} params={PRESETS["voice"].params} />

// start from one and change something
<ChladniPlate
  analyser={analyser}
  params={{ ...PRESETS["voice"].params, look: { look: "ink" } }}
/>`}</code>
        </pre>
        {Object.entries(PRESETS).map(([key, p]) => (
          <section key={key} className="guide-preset">
            <h3>
              {p.label} <code>{key}</code>
            </h3>
            <p>{p.description}</p>
            <pre>
              <code>{presetCode(key)}</code>
            </pre>
          </section>
        ))}
        <p>
          To load one onto the plate on the right, use the <a href="#/docs/prop.params">params</a>{" "}
          control.
        </p>
      </>
    ),
  },
];

export function findGuide(id: string): Guide | null {
  return GUIDES.find((g) => g.id === id) ?? null;
}
