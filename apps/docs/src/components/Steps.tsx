import { useState, type ReactNode } from "react";
import { Button } from "./Button";

export interface Step {
  title: string;
  /** one line shown while the step is collapsed */
  summary: string;
  body: ReactNode;
  /** extra control in the header, e.g. a Copy button */
  action?: ReactNode;
}

/**
 * A vertical stepper that folds: numbered circles on a rail, one step open at
 * a time, done steps ticked. Bodies stay mounted and grow/shrink through a
 * grid-rows transition so the fold is a motion, not a cut.
 */
export function Steps({ steps, initial = 0 }: { steps: Step[]; initial?: number }) {
  const [open, setOpen] = useState(initial);
  return (
    <ol className="steps">
      {steps.map((s, i) => {
        const isOpen = i === open;
        const done = i < open;
        return (
          <li
            key={s.title}
            className={`step-item${isOpen ? " is-open" : ""}${done ? " is-done" : ""}`}
          >
            <span className="step-marker" aria-hidden="true">
              <span key={done ? "done" : "n"} className="step-marker-glyph">
                {done ? "✓" : i + 1}
              </span>
            </span>
            <div className="step-main">
              <div className="step-head">
                <button
                  type="button"
                  className="step-toggle"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span className="step-title">{s.title}</span>
                  <span className="step-summary">{s.summary}</span>
                </button>
                <span className={`step-action${isOpen ? " is-shown" : ""}`}>{s.action}</span>
              </div>
              <div className="step-fold" aria-hidden={!isOpen}>
                <div className="step-fold-inner">
                  <div className="step-body">
                    {s.body}
                    {i < steps.length - 1 && (
                      <div className="step-next">
                        <Button onClick={() => setOpen(i + 1)} tabIndex={isOpen ? 0 : -1}>
                          {`Next: ${steps[i + 1]!.title} →`}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
