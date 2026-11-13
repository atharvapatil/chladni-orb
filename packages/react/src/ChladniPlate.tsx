import {
  createChladniPlate,
  DEFAULT_PARAMS,
  mergeParams,
  type AgentState,
  type ChladniParams,
  type ChladniPlate as CorePlate,
  type DeepPartial,
  type SpectrumSource,
} from "chladni-orb-core";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type CanvasHTMLAttributes,
  type RefObject,
} from "react";

export interface ChladniPlateProps extends Omit<
  CanvasHTMLAttributes<HTMLCanvasElement>,
  "children"
> {
  /** merged over DEFAULT_PARAMS; deep-compared via JSON to avoid churn */
  params?: DeepPartial<ChladniParams>;
  analyser?: SpectrumSource | AnalyserNode | null;
  /** idle | connecting | listening | talking (default). Quiet states ignore the analyser. */
  state?: AgentState;
  frozen?: boolean;
  pixelRatio?: number;
  fieldResolution?: number;
  particleTexSize?: number;
  onReady?: ((plate: CorePlate) => void) | undefined;
}

export const ChladniPlate = forwardRef<CorePlate | null, ChladniPlateProps>(
  function ChladniPlate(props, ref) {
    const {
      params,
      analyser,
      state,
      frozen,
      pixelRatio,
      fieldResolution,
      particleTexSize,
      onReady,
      ...canvasProps
    } = props;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const plateRef = useRef<CorePlate | null>(null);
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const paramsJson = JSON.stringify(params ?? null);

    // create once per canvas mount (StrictMode-safe: ref cleared on cleanup)
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const plate = createChladniPlate(canvas, {
        ...(analyser !== undefined ? { analyser } : {}),
        ...(state !== undefined ? { state } : {}),
        ...(pixelRatio !== undefined ? { pixelRatio } : {}),
        ...(fieldResolution !== undefined ? { fieldResolution } : {}),
        ...(particleTexSize !== undefined ? { particleTexSize } : {}),
      });
      plateRef.current = plate;
      if (typeof ref === "function") ref(plate);
      else if (ref) ref.current = plate;
      onReadyRef.current?.(plate);
      return () => {
        plateRef.current = null;
        if (typeof ref === "function") ref(null);
        else if (ref) ref.current = null;
        plate.destroy();
      };
    }, []);

    // `params` is authoritative: a diff over DEFAULT_PARAMS, so removing a
    // key resets it rather than leaving a stale value. The `frozen` prop wins
    // over params.listening.freeze, otherwise any params change would thaw a
    // plate frozen through the prop.
    const frozenRef = useRef(frozen);
    frozenRef.current = frozen;
    useEffect(() => {
      if (paramsJson !== "null") {
        const next = mergeParams(DEFAULT_PARAMS, JSON.parse(paramsJson));
        if (frozenRef.current !== undefined) next.listening.freeze = frozenRef.current;
        plateRef.current?.setParams(next);
      }
    }, [paramsJson]);

    useEffect(() => {
      if (analyser !== undefined) plateRef.current?.setAnalyser(analyser);
    }, [analyser]);

    useEffect(() => {
      if (state !== undefined) plateRef.current?.setState(state);
    }, [state]);

    useEffect(() => {
      if (frozen !== undefined) plateRef.current?.freeze(frozen);
    }, [frozen]);

    return <canvas ref={canvasRef} {...canvasProps} />;
  },
);

export function useChladniPlate(): {
  ref: RefObject<HTMLCanvasElement | null>;
  plate: CorePlate | null;
} {
  const ref = useRef<HTMLCanvasElement>(null);
  const [plate, setPlate] = useState<CorePlate | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const p = createChladniPlate(canvas);
    setPlate(p);
    return () => {
      setPlate(null);
      p.destroy();
    };
  }, []);
  return { ref, plate };
}
