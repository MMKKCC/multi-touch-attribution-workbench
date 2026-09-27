// ─── Funnel stages ────────────────────────────────────────────────────────────
export type FunnelStage = 'Touch' | 'MQL' | 'SQL' | 'Opp' | 'Won' | 'Lost';

export const FUNNEL_STAGES: FunnelStage[] = ['Touch', 'MQL', 'SQL', 'Opp', 'Won', 'Lost'];

// Stages we compute attribution credit for (each represents a stage-to-stage conversion)
export const CONVERSION_STAGES: FunnelStage[] = ['MQL', 'SQL', 'Opp', 'Won'];

// The preceding stage for each conversion stage
export const STAGE_PREDECESSOR: Record<string, FunnelStage> = {
  MQL: 'Touch',
  SQL: 'MQL',
  Opp: 'SQL',
  Won: 'Opp',
};

// ─── Raw event schema ─────────────────────────────────────────────────────────
export interface RawEvent {
  journeyId: string;
  /** Unix epoch seconds (NOT milliseconds – must fit in Uint32) */
  timestamp: number;
  channel: string;
  stage: FunnelStage;
}

export interface RawJourney {
  journeyId: string;
  events: RawEvent[];
  terminalState: 'Won' | 'Lost' | 'Null';
}

// ─── Dictionary encoder ───────────────────────────────────────────────────────
export interface Dictionary {
  channelToInt: Map<string, number>;
  intToChannel: Map<number, string>;
  stageToInt: Map<string, number>;
  intToStage: Map<number, string>;
  journeyToInt: Map<string, number>;
  intToJourney: Map<number, string>;
}

/** Plain-object form of Dictionary, safe to transfer across worker boundary */
export interface SerializedDictionary {
  channels: string[]; // index = int encoding
  stages: string[];   // index = int encoding
  journeys: string[]; // index = int encoding
}

// ─── Wasm-ready encoded dataset ───────────────────────────────────────────────
/**
 * eventsBuffer layout: groups of 4 Uint32 per event:
 *   [journeyId_int, timestamp_seconds, channel_int, stage_int, ...]
 *
 * journeyPointers layout: groups of 2 Uint32 per journey:
 *   [startIndex, length, ...]
 *   where startIndex is the raw element index into eventsBuffer (NOT divided by 4)
 */
export interface EncodedDataset {
  eventsBuffer: Uint32Array;
  journeyPointers: Uint32Array;
  numJourneys: number;
  numEvents: number;
}

// ─── Attribution output ───────────────────────────────────────────────────────
/** Fractional credit (0.0–1.0) per channel per conversion stage */
export type AttributionMatrix = {
  [channelName: string]: {
    [stageName: string]: number;
  };
};

export type ConfidenceIntervalMatrix = {
  [channelName: string]: {
    [stageName: string]: {
      mean: number;
      lower: number; // mean − 2σ
      upper: number; // mean + 2σ
    };
  };
};

/** Average seconds in a stage influenced by each channel */
export type VelocityMatrix = {
  [channelName: string]: {
    [stageName: string]: number;
  };
};

// ─── Model types ──────────────────────────────────────────────────────────────
export type HeuristicModelName = 'firstTouch' | 'lastTouch' | 'linear' | 'timeDecay';
export type ModelType = HeuristicModelName | 'markov' | 'shapley';

export const MODEL_LABELS: Record<ModelType, string> = {
  firstTouch: 'First Touch',
  lastTouch: 'Last Touch',
  linear: 'Linear',
  timeDecay: 'Time Decay',
  markov: 'Markov',
  shapley: 'Shapley',
};

// ─── IAttributionEngine interface ─────────────────────────────────────────────
export interface IAttributionEngine {
  /** Ingest encoded journey data. Must be called before any calculation. */
  ingestData(data: EncodedDataset, dict: SerializedDictionary): void;

  /** Multi-stage Markov chain removal effect. order ∈ {1, 2, 3} */
  calculateMarkov(order: number): Promise<AttributionMatrix>;

  /** Monte Carlo Shapley value approximation */
  calculateShapley(
    iterations: number,
    onProgress: (pct: number) => void
  ): Promise<AttributionMatrix>;

  /** First-Touch, Last-Touch, Linear, Time-Decay */
  calculateHeuristics(): Promise<Record<HeuristicModelName, AttributionMatrix>>;

  /** Bootstrap resampling confidence intervals */
  runBootstrap(
    model: ModelType,
    iterations: number
  ): Promise<ConfidenceIntervalMatrix>;

  /** Average time-in-stage per channel */
  calculateVelocityMetrics(): Promise<VelocityMatrix>;
}

// ─── Synthetic generator config ───────────────────────────────────────────────
export interface MarkovConfig {
  channels: string[];
  /** Entry probability for each channel on first touch (sums to 1) */
  entryProbs: number[];
  /**
   * Transition matrix: transitions[fromChannel][col]
   * Columns: [0..n-1] = to channel j, [n] = StageAdvance, [n+1] = Drop
   * Each row must sum to 1.
   */
  transitions: number[][];
  journeyCount: number;
  seed: number;
  maxTouchesPerStage: number;
}

// ─── Budget optimizer ─────────────────────────────────────────────────────────
export interface BudgetConfig {
  /** Economic value per stage conversion, e.g. { MQL: 100, SQL: 500, Won: 10000 } */
  stageValues: Record<string, number>;
  /** Current spend per channel */
  channelSpend: Record<string, number>;
  totalBudget: number;
  enableSaturation: boolean;
}

export interface BudgetResult {
  currentAllocation: Record<string, number>;
  optimizedAllocation: Record<string, number>;
  currentValue: number;
  optimizedValue: number;
}

// ─── Preset lessons ───────────────────────────────────────────────────────────
export interface PresetLesson {
  id: string;
  name: string;
  description: string;
  config: Omit<MarkovConfig, 'journeyCount' | 'seed'>;
}

// ─── RNG state snapshot for DiceRoll ─────────────────────────────────────────
export interface RngStateSnapshot {
  journeyIndex: number;
  /** mulberry32 seed state at the START of this journey */
  seedAtJourneyStart: number;
}

// ─── Ground truth comparison ─────────────────────────────────────────────────
export interface GroundTruthComparison {
  model: ModelType;
  mae: number;
}
