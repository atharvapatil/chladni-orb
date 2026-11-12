export {
  DEFAULT_PARAMS,
  PARAM_SCHEMA,
  mergeParams,
  type ChladniParams,
  type DeepPartial,
  type Halo,
  type Look,
  type MultiTone,
  type ParamSchemaEntry,
  type PlateDrive,
  type PlateModelKind,
  type PlateShape,
} from "./params";
export * from "./audio";
export * from "./physics";
export { createChladniPlate, type ChladniPlate, type ChladniPlateOptions } from "./ChladniPlate";
export {
  createElementAnalyser,
  createMicAnalyser,
  SimulatedVoice,
  type AnalyserHandle,
} from "./audio/sources";
export { Renderer, type RenderFrame } from "./render/Renderer";
export { getSharedGL } from "./render/context";
