import { create } from 'zustand';
import type { BudgetConfig, MarkovConfig, ModelType } from '../types/index.js';
import { PRESET_LESSONS } from './presets.js';

// ─── Default 6-channel B2B SaaS configuration ────────────────────────────────
export const DEFAULT_CHANNELS = [
  'Paid Search',
  'Organic',
  'Webinar',
  'LinkedIn',
  'Referral',
  'Email',
];

/**
 * Default transition matrix.
 * Columns: [Paid, Organic, Webinar, LinkedIn, Referral, Email, Advance, Drop]
 * Each row sums to 1.
 */
export const DEFAULT_TRANSITIONS: number[][] = [
  //  PS      Org    Web    LI     Ref    Em     Adv    Drop
  [0.08, 0.08, 0.05, 0.12, 0.02, 0.05, 0.40, 0.20], // Paid Search
  [0.06, 0.07, 0.04, 0.08, 0.03, 0.07, 0.45, 0.20], // Organic
  [0.03, 0.04, 0.03, 0.05, 0.05, 0.10, 0.55, 0.15], // Webinar
  [0.10, 0.07, 0.05, 0.06, 0.03, 0.09, 0.42, 0.18], // LinkedIn
  [0.02, 0.04, 0.08, 0.05, 0.03, 0.08, 0.58, 0.12], // Referral
  [0.05, 0.04, 0.06, 0.06, 0.03, 0.06, 0.50, 0.20], // Email
];

export const DEFAULT_ENTRY_PROBS = [0.28, 0.22, 0.10, 0.20, 0.06, 0.14];

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  stageValues: { MQL: 100, SQL: 500, Opp: 2000, Won: 10000 },
  channelSpend: {
    'Paid Search': 20000,
    Organic: 5000,
    Webinar: 8000,
    LinkedIn: 15000,
    Referral: 2000,
    Email: 3000,
  },
  totalBudget: 53000,
  enableSaturation: true,
};

// ─── Store ────────────────────────────────────────────────────────────────────
interface ConfigState {
  channels: string[];
  entryProbs: number[];
  transitions: number[][];
  journeyCount: number;
  seed: number;
  markovOrder: 1 | 2 | 3;
  shapleyIterations: number;
  bootstrapIterations: number;
  budgetConfig: BudgetConfig;
  activeModels: ModelType[];

  setChannels: (channels: string[]) => void;
  setEntryProbs: (probs: number[]) => void;
  setTransitions: (matrix: number[][]) => void;
  setTransitionCell: (row: number, col: number, value: number) => void;
  setJourneyCount: (n: number) => void;
  setSeed: (seed: number) => void;
  setMarkovOrder: (order: 1 | 2 | 3) => void;
  setShapleyIterations: (n: number) => void;
  setBootstrapIterations: (n: number) => void;
  setBudgetConfig: (config: BudgetConfig) => void;
  loadPreset: (presetId: string) => void;
  toMarkovConfig: () => MarkovConfig;
  serializable: () => SerializableConfig;
  loadFromSerializable: (s: SerializableConfig) => void;
}

export interface SerializableConfig {
  channels: string[];
  entryProbs: number[];
  transitions: number[][];
  journeyCount: number;
  seed: number;
  markovOrder: 1 | 2 | 3;
  shapleyIterations: number;
  bootstrapIterations: number;
  budgetConfig: BudgetConfig;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  channels: DEFAULT_CHANNELS,
  entryProbs: DEFAULT_ENTRY_PROBS,
  transitions: DEFAULT_TRANSITIONS,
  journeyCount: 500,
  seed: 42,
  markovOrder: 1,
  shapleyIterations: 2000,
  bootstrapIterations: 200,
  budgetConfig: DEFAULT_BUDGET_CONFIG,
  activeModels: ['firstTouch', 'lastTouch', 'linear', 'timeDecay', 'markov'],

  setChannels: channels => set({ channels }),
  setEntryProbs: entryProbs => set({ entryProbs }),
  setTransitions: transitions => set({ transitions }),

  setTransitionCell: (row, col, value) => {
    const transitions = get().transitions.map(r => [...r]);
    transitions[row][col] = value;
    set({ transitions });
  },

  setJourneyCount: journeyCount => set({ journeyCount }),
  setSeed: seed => set({ seed }),
  setMarkovOrder: markovOrder => set({ markovOrder }),
  setShapleyIterations: shapleyIterations => set({ shapleyIterations }),
  setBootstrapIterations: bootstrapIterations => set({ bootstrapIterations }),
  setBudgetConfig: budgetConfig => set({ budgetConfig }),

  loadPreset: presetId => {
    const preset = PRESET_LESSONS.find(p => p.id === presetId);
    if (!preset) return;
    const { config } = preset;
    set({
      channels: config.channels,
      entryProbs: config.entryProbs,
      transitions: config.transitions,
    });
  },

  toMarkovConfig: (): MarkovConfig => {
    const { channels, entryProbs, transitions, journeyCount, seed } = get();
    return { channels, entryProbs, transitions, journeyCount, seed, maxTouchesPerStage: 20 };
  },

  serializable: (): SerializableConfig => {
    const s = get();
    return {
      channels: s.channels,
      entryProbs: s.entryProbs,
      transitions: s.transitions,
      journeyCount: s.journeyCount,
      seed: s.seed,
      markovOrder: s.markovOrder,
      shapleyIterations: s.shapleyIterations,
      bootstrapIterations: s.bootstrapIterations,
      budgetConfig: s.budgetConfig,
    };
  },

  loadFromSerializable: (s: SerializableConfig) => {
    set({
      channels: s.channels,
      entryProbs: s.entryProbs,
      transitions: s.transitions,
      journeyCount: s.journeyCount,
      seed: s.seed,
      markovOrder: s.markovOrder,
      shapleyIterations: s.shapleyIterations,
      bootstrapIterations: s.bootstrapIterations,
      budgetConfig: s.budgetConfig,
    });
  },
}));
