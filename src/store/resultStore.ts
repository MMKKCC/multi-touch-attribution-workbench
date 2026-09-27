import { create } from 'zustand';
import type {
  AttributionMatrix,
  BudgetConfig,
  BudgetResult,
  ConfidenceIntervalMatrix,
  HeuristicModelName,
  ModelType,
  VelocityMatrix,
} from '../types/index.js';
import { CONVERSION_STAGES } from '../types/index.js';

interface ResultState {
  attributionMatrices: Partial<Record<ModelType, AttributionMatrix>>;
  confidenceIntervals: ConfidenceIntervalMatrix | null;
  velocityMatrix: VelocityMatrix | null;
  budgetResult: BudgetResult | null;
  groundTruthMAE: number | null;
  isCalculating: boolean;
  shapleyProgress: number; // 0-1
  error: string | null;

  setHeuristics: (results: Record<HeuristicModelName, AttributionMatrix>) => void;
  setMarkov: (result: AttributionMatrix) => void;
  setShapley: (result: AttributionMatrix) => void;
  setConfidenceIntervals: (ci: ConfidenceIntervalMatrix) => void;
  setVelocityMatrix: (v: VelocityMatrix) => void;
  setBudgetResult: (r: BudgetResult) => void;
  setGroundTruthMAE: (mae: number | null) => void;
  setCalculating: (calculating: boolean) => void;
  setShapleyProgress: (pct: number) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useResultStore = create<ResultState>((set) => ({
  attributionMatrices: {},
  confidenceIntervals: null,
  velocityMatrix: null,
  budgetResult: null,
  groundTruthMAE: null,
  isCalculating: false,
  shapleyProgress: 0,
  error: null,

  setHeuristics: results =>
    set(state => ({
      attributionMatrices: { ...state.attributionMatrices, ...results },
    })),

  setMarkov: result =>
    set(state => ({
      attributionMatrices: { ...state.attributionMatrices, markov: result },
    })),

  setShapley: result =>
    set(state => ({
      attributionMatrices: { ...state.attributionMatrices, shapley: result },
    })),

  setConfidenceIntervals: ci => set({ confidenceIntervals: ci }),
  setVelocityMatrix: v => set({ velocityMatrix: v }),
  setBudgetResult: r => set({ budgetResult: r }),
  setGroundTruthMAE: mae => set({ groundTruthMAE: mae }),
  setCalculating: calculating => set({ isCalculating: calculating }),
  setShapleyProgress: pct => set({ shapleyProgress: pct }),
  setError: error => set({ error }),

  clear: () =>
    set({
      attributionMatrices: {},
      confidenceIntervals: null,
      velocityMatrix: null,
      budgetResult: null,
      groundTruthMAE: null,
      error: null,
    }),
}));

// ─── Budget optimizer ─────────────────────────────────────────────────────────
export function computeBudget(
  attributionMatrix: AttributionMatrix,
  budgetConfig: BudgetConfig,
  channels: string[]
): BudgetResult {
  const { stageValues, channelSpend, totalBudget, enableSaturation } = budgetConfig;

  // Compute weighted attribution score per channel (across all stages)
  const channelScores: Record<string, number> = {};
  for (const ch of channels) {
    let score = 0;
    for (const stage of CONVERSION_STAGES) {
      const credit = attributionMatrix[ch]?.[stage] ?? 0;
      const value = stageValues[stage] ?? 0;
      score += credit * value;
    }
    channelScores[ch] = score;
  }

  // Current value
  const currentValue = computePortfolioValue(
    channelSpend,
    channelScores,
    enableSaturation
  );

  // Grid search: allocate totalBudget proportionally to scores
  const totalScore = channels.reduce((sum, ch) => sum + channelScores[ch], 0);
  const optimizedAllocation: Record<string, number> = {};

  if (totalScore > 0) {
    for (const ch of channels) {
      optimizedAllocation[ch] = (channelScores[ch] / totalScore) * totalBudget;
    }
  } else {
    const perChannel = totalBudget / channels.length;
    for (const ch of channels) optimizedAllocation[ch] = perChannel;
  }

  const optimizedValue = computePortfolioValue(
    optimizedAllocation,
    channelScores,
    enableSaturation
  );

  return {
    currentAllocation: channelSpend,
    optimizedAllocation,
    currentValue,
    optimizedValue,
  };
}

function saturationValue(spend: number, alpha: number): number {
  return alpha * Math.log(spend + 1);
}

function computePortfolioValue(
  allocation: Record<string, number>,
  scores: Record<string, number>,
  useSaturation: boolean
): number {
  let total = 0;
  for (const [ch, spend] of Object.entries(allocation)) {
    const alpha = scores[ch] ?? 0;
    total += useSaturation ? saturationValue(spend, alpha) : alpha * spend;
  }
  return total;
}
