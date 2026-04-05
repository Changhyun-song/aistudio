// Re-export all story modules for backwards compatibility.
// Previously this was a single 1,945-line file; now split into focused modules.

export {
  MODEL_GENERATOR,
  MODEL_EVALUATOR,
  MODEL_PLANNER,
  MODEL_OPTIMIZER,
  extractJsonBlock,
  formatOverlayBlock,
  getSupplementForStage,
  isContentAgnostic,
} from './utils';

export {
  autoFillFromIdea,
  generateStoryConcept,
  reviseStoryConcept,
  extractCharactersFromConcept,
  generateSeriesBible,
  generateSeasonPlan,
  generateEpisodeScript,
  generateFrameAndVideoPackets,
} from './generators';
export type {
  AutoFillResult,
  ConceptInput,
  ExtractedCharacter,
  BibleInput,
  BibleOutput,
  EpisodeArcOutput,
  SceneOutput,
  EpisodeScriptOutput,
  BoundaryFrameOutput,
  ClipPacketOutput,
  FrameVideoOutput,
} from './generators';

export {
  evaluateOutput,
  evaluateSeasonCoherence,
} from './evaluator';
export type {
  EvalTaskType,
  EvalCriterion,
  EvalWeakness,
  EvalResult,
  SeasonCoherenceResult,
} from './evaluator';

export {
  plannerInit,
  plannerInterpretEvaluation,
} from './planner';
export type {
  PlannerAction,
  RevisionTarget,
  PlannerInitResult,
  PlannerDecisionResult,
} from './planner';

export {
  optimizePrompt,
  consolidateGlobalRules,
  checkAndConsolidate,
} from './optimizer';
export type {
  OptimizeStage,
  PromptDiagnosis,
  SupplementRule,
  PromptOptimizeResult,
  ConsolidationResult,
} from './optimizer';

export {
  generateCharacterVisualPrompts,
  generateAllCharacterVisuals,
} from './character-visual';
export type {
  CharacterVisualGenResult,
} from './character-visual';
