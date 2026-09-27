import { Matrix, pseudoInverse } from 'ml-matrix';
import type {
  AttributionMatrix,
  ConfidenceIntervalMatrix,
  EncodedDataset,
  FunnelStage,
  HeuristicModelName,
  IAttributionEngine,
  ModelType,
  SerializedDictionary,
  VelocityMatrix,
} from '../types/index.js';
import { CONVERSION_STAGES, STAGE_PREDECESSOR } from '../types/index.js';

const FIELDS_PER_EVENT = 4;
const FIELDS_PER_POINTER = 2;

// Internal decoded event representation (lives only inside the worker)
interface DecodedEvent {
  journeyIdx: number;
  timestamp: number;
  channel: string;
  stage: string;
}

interface DecodedJourney {
  journeyIdx: number;
  events: DecodedEvent[];
  terminalState: string;
}

export class AttributionEngine implements IAttributionEngine {
  private journeys: DecodedJourney[] = [];
  private channels: string[] = [];

  ingestData(data: EncodedDataset, dict: SerializedDictionary): void {
    this.channels = dict.channels;
    this.journeys = [];

    for (let ji = 0; ji < data.numJourneys; ji++) {
      const ptrBase = ji * FIELDS_PER_POINTER;
      const startIndex = data.journeyPointers[ptrBase];
      const length = data.journeyPointers[ptrBase + 1];

      const events: DecodedEvent[] = [];
      let terminalState = 'Null';

      for (let ei = 0; ei < length; ei++) {
        const base = startIndex + ei * FIELDS_PER_EVENT;
        const journeyIdx = data.eventsBuffer[base + 0];
        const timestamp = data.eventsBuffer[base + 1];
        const channelInt = data.eventsBuffer[base + 2];
        const stageInt = data.eventsBuffer[base + 3];

        const channel = dict.channels[channelInt] ?? `ch_${channelInt}`;
        const stage = dict.stages[stageInt] ?? `stage_${stageInt}`;

        events.push({ journeyIdx, timestamp, channel, stage });

        if (stage === 'Won') terminalState = 'Won';
        else if (stage === 'Lost' && terminalState !== 'Won') terminalState = 'Lost';
      }

      this.journeys.push({ journeyIdx: ji, events, terminalState });
    }
  }

  async calculateHeuristics(): Promise<Record<HeuristicModelName, AttributionMatrix>> {
    const models: HeuristicModelName[] = ['firstTouch', 'lastTouch', 'linear', 'timeDecay'];
    const results = {} as Record<HeuristicModelName, AttributionMatrix>;

    for (const model of models) {
      const matrix: AttributionMatrix = {};
      for (const ch of this.channels) matrix[ch] = {};

      for (const convStage of CONVERSION_STAGES) {
        const fromStage = STAGE_PREDECESSOR[convStage] as FunnelStage;
        const credits = this.computeHeuristicsForStage(fromStage, convStage, model);
        if (credits) {
          for (const ch of this.channels) {
            matrix[ch][convStage] = credits[ch] ?? 0;
          }
        } else {
          for (const ch of this.channels) matrix[ch][convStage] = 0;
        }
      }

      results[model] = matrix;
    }

    return results;
  }

  async calculateMarkov(order: number): Promise<AttributionMatrix> {
    const matrix: AttributionMatrix = {};
    for (const ch of this.channels) matrix[ch] = {};

    for (const convStage of CONVERSION_STAGES) {
      const fromStage = STAGE_PREDECESSOR[convStage] as FunnelStage;
      const credits = this.computeMarkovForStage(fromStage, convStage, order);
      if (credits) {
        for (const ch of this.channels) {
          matrix[ch][convStage] = credits[ch] ?? 0;
        }
      } else {
        for (const ch of this.channels) matrix[ch][convStage] = 0;
      }
    }

    return matrix;
  }

  async calculateShapley(
    iterations: number,
    onProgress: (pct: number) => void
  ): Promise<AttributionMatrix> {
    const matrix: AttributionMatrix = {};
    for (const ch of this.channels) matrix[ch] = {};

    for (const convStage of CONVERSION_STAGES) {
      const fromStage = STAGE_PREDECESSOR[convStage] as FunnelStage;
      const credits = await this.computeShapleyForStage(
        fromStage,
        convStage,
        iterations,
        onProgress
      );
      for (const ch of this.channels) {
        matrix[ch][convStage] = credits?.[ch] ?? 0;
      }
    }

    return matrix;
  }

  async runBootstrap(
    model: ModelType,
    iterations: number
  ): Promise<ConfidenceIntervalMatrix> {
    const allResults: AttributionMatrix[] = [];

    for (let i = 0; i < iterations; i++) {
      const resampled = this.resampleJourneys();
      const saved = this.journeys;
      this.journeys = resampled;

      let result: AttributionMatrix;
      if (model === 'markov') {
        result = await this.calculateMarkov(1);
      } else if (model === 'shapley') {
        result = await this.computeShapleyQuick();
      } else {
        const heuristics = await this.calculateHeuristics();
        result = heuristics[model as HeuristicModelName];
      }

      allResults.push(result);
      this.journeys = saved;
    }

    return this.aggregateBootstrap(allResults);
  }

  async calculateVelocityMetrics(): Promise<VelocityMatrix> {
    const matrix: VelocityMatrix = {};
    for (const ch of this.channels) {
      matrix[ch] = {};
      for (const stage of CONVERSION_STAGES) {
        matrix[ch][stage] = 0;
      }
    }

    // For each stage, compute avg time-in-stage per channel
    for (const convStage of CONVERSION_STAGES) {
      const fromStage = STAGE_PREDECESSOR[convStage] as FunnelStage;
      const channelTimes = new Map<string, number[]>();

      for (const journey of this.journeys) {
        const stageTouches = journey.events.filter(e => e.stage === fromStage);
        if (stageTouches.length === 0) continue;

        const firstTime = stageTouches[0].timestamp;
        const lastTime = stageTouches[stageTouches.length - 1].timestamp;
        const duration = lastTime - firstTime;

        const channelsSeen = new Set(stageTouches.map(e => e.channel));
        for (const ch of channelsSeen) {
          if (!channelTimes.has(ch)) channelTimes.set(ch, []);
          channelTimes.get(ch)!.push(duration);
        }
      }

      for (const ch of this.channels) {
        const times = channelTimes.get(ch) ?? [];
        matrix[ch][convStage] =
          times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
      }
    }

    return matrix;
  }

  // ─── Private: heuristics ────────────────────────────────────────────────────

  private computeHeuristicsForStage(
    fromStage: string,
    toStage: string,
    model: HeuristicModelName
  ): Record<string, number> | null {
    const channelCredits = new Map<string, number>();
    let totalCredit = 0;

    for (const journey of this.journeys) {
      const stageTouches = journey.events
        .filter(e => e.stage === fromStage)
        .sort((a, b) => a.timestamp - b.timestamp);

      if (stageTouches.length === 0) continue;

      const converted = journey.events.some(e => e.stage === toStage);
      if (!converted) continue;

      const conversionTime =
        journey.events.find(e => e.stage === toStage)?.timestamp ??
        stageTouches[stageTouches.length - 1].timestamp;

      const n = stageTouches.length;

      // Compute raw weights per touch
      let weights: number[] = [];
      if (model === 'firstTouch') {
        weights = stageTouches.map((_, i) => (i === 0 ? 1 : 0));
      } else if (model === 'lastTouch') {
        weights = stageTouches.map((_, i) => (i === n - 1 ? 1 : 0));
      } else if (model === 'linear') {
        weights = stageTouches.map(() => 1 / n);
      } else if (model === 'timeDecay') {
        const halfLifeSec = 7 * 24 * 3600;
        weights = stageTouches.map(t => {
          const age = Math.max(0, conversionTime - t.timestamp);
          return Math.pow(2, -age / halfLifeSec);
        });
      }

      const weightSum = weights.reduce((a, b) => a + b, 0);
      if (weightSum === 0) continue;

      for (let i = 0; i < n; i++) {
        const ch = stageTouches[i].channel;
        const credit = weights[i] / weightSum;
        channelCredits.set(ch, (channelCredits.get(ch) ?? 0) + credit);
        totalCredit += credit;
      }
    }

    if (totalCredit === 0) return null;

    const result: Record<string, number> = {};
    for (const ch of this.channels) {
      result[ch] = (channelCredits.get(ch) ?? 0) / totalCredit;
    }
    return result;
  }

  // ─── Private: Markov chain ──────────────────────────────────────────────────

  private computeMarkovForStage(
    fromStage: string,
    toStage: string,
    order: number
  ): Record<string, number> | null {
    // Collect touch sequences for this stage transition
    const sequences: { states: string[]; converted: boolean }[] = [];

    for (const journey of this.journeys) {
      const stageTouches = journey.events
        .filter(e => e.stage === fromStage)
        .sort((a, b) => a.timestamp - b.timestamp);

      if (stageTouches.length === 0) continue;

      const converted = journey.events.some(e => e.stage === toStage);
      let states: string[];

      if (order === 1) {
        states = stageTouches.map(e => e.channel);
      } else {
        // Higher-order: state = last `order` channels joined as tuple key
        const channels = stageTouches.map(e => e.channel);
        states = [];
        for (let i = order - 1; i < channels.length; i++) {
          states.push(channels.slice(i - order + 1, i + 1).join('\x00'));
        }
      }

      if (states.length > 0) {
        sequences.push({ states, converted });
      }
    }

    if (sequences.length === 0) return null;

    // Build sparse transition counts
    const transitionCounts = new Map<string, Map<string, number>>();
    const channelSet = new Set<string>();

    for (const seq of sequences) {
      for (let i = 0; i < seq.states.length - 1; i++) {
        const from = seq.states[i];
        const to = seq.states[i + 1];
        channelSet.add(from);
        channelSet.add(to);
        addToSparseMap(transitionCounts, from, to, 1);
      }
      if (seq.states.length > 0) {
        const last = seq.states[seq.states.length - 1];
        channelSet.add(last);
        const terminal = seq.converted ? '__CONV__' : '__LOST__';
        addToSparseMap(transitionCounts, last, terminal, 1);
      }
    }

    const states = Array.from(channelSet);
    if (states.length === 0) return null;

    const n = states.length;
    const stateIdx = new Map(states.map((s, i) => [s, i]));

    // Build Q (transient×transient) and R (transient×absorbing)
    const Q = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const R = Array.from({ length: n }, () => [0, 0]);

    for (let i = 0; i < n; i++) {
      const row = transitionCounts.get(states[i]);
      if (!row) continue;

      let total = 0;
      for (const v of row.values()) total += v;
      if (total === 0) continue;

      for (const [to, count] of row.entries()) {
        const prob = count / total;
        if (to === '__CONV__') {
          R[i][0] = prob;
        } else if (to === '__LOST__') {
          R[i][1] = prob;
        } else {
          const j = stateIdx.get(to);
          if (j !== undefined) Q[i][j] = prob;
        }
      }
    }

    // N = (I - Q)^-1
    const N = fundamentalMatrix(Q);
    if (N === null) return null;

    const Rm = new Matrix(R);
    const B = N.mmul(Rm); // B[i][0] = prob reaching CONV from state i

    // Entry distribution from data
    const entryCounts = new Map<string, number>();
    let totalEntries = 0;
    for (const seq of sequences) {
      if (seq.states.length > 0) {
        const first = seq.states[0];
        entryCounts.set(first, (entryCounts.get(first) ?? 0) + 1);
        totalEntries++;
      }
    }

    const entryProb = (s: string) => (entryCounts.get(s) ?? 0) / Math.max(1, totalEntries);

    const baselineC = states.reduce((sum, s, i) => sum + entryProb(s) * B.get(i, 0), 0);
    if (baselineC <= 0) return null;

    // Removal effect per state
    const credits: Record<string, number> = {};

    for (const removeState of states) {
      const removeIdx = stateIdx.get(removeState)!;
      const remaining = states.filter((_, i) => i !== removeIdx);
      const mr = remaining.length;

      if (mr === 0) {
        credits[removeState] = 1;
        continue;
      }

      const remIdx = new Map(remaining.map((s, i) => [s, i]));
      const Qr = Array.from({ length: mr }, () => new Array<number>(mr).fill(0));
      const Rr = Array.from({ length: mr }, () => [0, 0]);

      for (let ri = 0; ri < mr; ri++) {
        const s = remaining[ri];
        const row = transitionCounts.get(s);
        if (!row) continue;

        let total = 0;
        const filtered = new Map<string, number>();
        for (const [to, count] of row.entries()) {
          if (to === removeState) continue;
          filtered.set(to, count);
          total += count;
        }
        if (total === 0) continue;

        for (const [to, count] of filtered.entries()) {
          const prob = count / total;
          if (to === '__CONV__') {
            Rr[ri][0] = prob;
          } else if (to === '__LOST__') {
            Rr[ri][1] = prob;
          } else {
            const rj = remIdx.get(to);
            if (rj !== undefined) Qr[ri][rj] = prob;
          }
        }
      }

      const Nr = fundamentalMatrix(Qr);
      let removalC = 0;
      if (Nr !== null) {
        const Rrm = new Matrix(Rr);
        const Br = Nr.mmul(Rrm);
        let remTotal = 0;
        for (const s of remaining) remTotal += entryCounts.get(s) ?? 0;
        if (remTotal > 0) {
          for (let ri = 0; ri < mr; ri++) {
            const ep = (entryCounts.get(remaining[ri]) ?? 0) / remTotal;
            removalC += ep * Br.get(ri, 0);
          }
        }
      }

      credits[removeState] = (baselineC - removalC) / baselineC;
    }

    // For higher-order states, aggregate back to channels
    const channelCredits: Record<string, number> = {};
    for (const s of states) {
      const ch = order === 1 ? s : s.split('\x00').at(-1)!;
      channelCredits[ch] = (channelCredits[ch] ?? 0) + Math.max(0, credits[s] ?? 0);
    }

    return normalizeCredits(channelCredits, this.channels);
  }

  // ─── Private: Shapley ────────────────────────────────────────────────────────

  private async computeShapleyForStage(
    fromStage: string,
    toStage: string,
    iterations: number,
    onProgress: (pct: number) => void
  ): Promise<Record<string, number> | null> {
    const channels = this.channels;
    if (channels.length === 0) return null;

    const conversionRate = (channelSet: Set<string>): number => {
      let converted = 0;
      let total = 0;
      for (const journey of this.journeys) {
        const hasTouch = journey.events.some(
          e => e.stage === fromStage && channelSet.has(e.channel)
        );
        if (!hasTouch) continue;
        total++;
        if (journey.events.some(e => e.stage === toStage)) converted++;
      }
      return total > 0 ? converted / total : 0;
    };

    const marginals = new Map<string, number>(channels.map(c => [c, 0]));

    for (let iter = 0; iter < iterations; iter++) {
      const perm = fisherYates(channels);
      let prev = 0;
      const coalition = new Set<string>();

      for (const ch of perm) {
        coalition.add(ch);
        const next = conversionRate(coalition);
        marginals.set(ch, (marginals.get(ch) ?? 0) + (next - prev));
        prev = next;
      }

      if (iter % 100 === 0) onProgress(iter / iterations);
    }

    const result: Record<string, number> = {};
    for (const ch of channels) {
      result[ch] = Math.max(0, (marginals.get(ch) ?? 0) / iterations);
    }

    return normalizeCredits(result, channels);
  }

  /** Fast Shapley with fewer iterations for bootstrap */
  private async computeShapleyQuick(): Promise<AttributionMatrix> {
    return this.calculateShapley(200, () => {});
  }

  // ─── Private: bootstrap ─────────────────────────────────────────────────────

  private resampleJourneys(): DecodedJourney[] {
    const n = this.journeys.length;
    const resampled: DecodedJourney[] = [];
    for (let i = 0; i < n; i++) {
      resampled.push(this.journeys[Math.floor(Math.random() * n)]);
    }
    return resampled;
  }

  private aggregateBootstrap(results: AttributionMatrix[]): ConfidenceIntervalMatrix {
    const ci: ConfidenceIntervalMatrix = {};

    for (const ch of this.channels) {
      ci[ch] = {};
      for (const stage of CONVERSION_STAGES) {
        const values = results.map(r => r[ch]?.[stage] ?? 0);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
        const sd = Math.sqrt(variance);
        ci[ch][stage] = {
          mean,
          lower: Math.max(0, mean - 2 * sd),
          upper: Math.min(1, mean + 2 * sd),
        };
      }
    }

    return ci;
  }
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function fundamentalMatrix(Q: number[][]): Matrix | null {
  const n = Q.length;
  if (n === 0) return null;

  try {
    const Qm = new Matrix(Q);
    const I = Matrix.eye(n);
    const IminusQ = Matrix.sub(I, Qm);
    // Try exact inverse first; fall back to pseudo-inverse for near-singular matrices
    try {
      return IminusQ.inverse();
    } catch {
      return pseudoInverse(IminusQ);
    }
  } catch {
    return null;
  }
}

function addToSparseMap(
  map: Map<string, Map<string, number>>,
  from: string,
  to: string,
  value: number
): void {
  if (!map.has(from)) map.set(from, new Map());
  const row = map.get(from)!;
  row.set(to, (row.get(to) ?? 0) + value);
}

function normalizeCredits(
  credits: Record<string, number>,
  allChannels: string[]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const ch of allChannels) result[ch] = Math.max(0, credits[ch] ?? 0);

  const total = Object.values(result).reduce((a, b) => a + b, 0);
  if (total > 0) {
    for (const ch of allChannels) result[ch] /= total;
  } else {
    const n = allChannels.length;
    for (const ch of allChannels) result[ch] = 1 / n;
  }

  return result;
}

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
