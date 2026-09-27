import type { MarkovConfig, RawEvent, RawJourney, FunnelStage, RngStateSnapshot } from '../types/index.js';
import { CONVERSION_STAGES } from '../types/index.js';
import { mulberry32, weightedChoice } from '../utils/seededRng.js';

// Columns: [0..n-1] = to channel j, [n] = StageAdvance, [n+1] = Drop
const STAGE_SEQUENCE: FunnelStage[] = ['Touch', 'MQL', 'SQL', 'Opp'];

export interface GeneratorResult {
  journeys: RawJourney[];
  rngSnapshots: RngStateSnapshot[];
}

export function generateJourneys(config: MarkovConfig): GeneratorResult {
  const { channels, entryProbs, transitions, journeyCount, seed, maxTouchesPerStage } = config;
  const n = channels.length;
  const rng = mulberry32(seed);

  const journeys: RawJourney[] = [];
  const rngSnapshots: RngStateSnapshot[] = [];

  // Base timestamp: start of current year in seconds
  const baseTime = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);

  for (let ji = 0; ji < journeyCount; ji++) {
    // Snapshot seed at start of this journey for DiceRoll reproducibility
    rngSnapshots.push({ journeyIndex: ji, seedAtJourneyStart: rng.state.seed });

    const journeyId = `J${String(ji).padStart(6, '0')}`;
    const events: RawEvent[] = [];

    // Each journey starts at time 0 (relative), spread over ~1 year
    let currentTime = baseTime + Math.floor(rng.next() * 365 * 24 * 3600);
    let terminalState: 'Won' | 'Lost' | 'Null' = 'Null';

    let currentStageIdx = 0; // Index into STAGE_SEQUENCE (Touch=0)

    while (currentStageIdx < STAGE_SEQUENCE.length) {
      const currentStage = STAGE_SEQUENCE[currentStageIdx];

      // Pick entry channel for this stage
      let channelIdx = weightedChoice(entryProbs, rng.next.bind(rng));
      let touchCount = 0;

      let advanced = false;
      let dropped = false;

      while (touchCount < maxTouchesPerStage) {
        // Record this touch event
        events.push({
          journeyId,
          timestamp: currentTime,
          channel: channels[channelIdx],
          stage: currentStage,
        });

        touchCount++;
        // Advance time by 1 hour to a few days
        currentTime += Math.floor(3600 + rng.next() * 7 * 24 * 3600);

        // Apply transition
        const row = transitions[channelIdx];
        const choice = weightedChoice(row, rng.next.bind(rng));

        if (choice === n) {
          // Stage Advance
          advanced = true;
          break;
        } else if (choice === n + 1) {
          // Drop
          dropped = true;
          break;
        } else {
          // Move to next channel in same stage
          channelIdx = choice;
        }
      }

      if (dropped || (!advanced && touchCount >= maxTouchesPerStage)) {
        terminalState = 'Lost';
        events.push({
          journeyId,
          timestamp: currentTime,
          channel: channels[channelIdx],
          stage: 'Lost',
        });
        break;
      }

      if (advanced) {
        if (currentStageIdx === STAGE_SEQUENCE.length - 1) {
          // Advanced past Opp → Won
          terminalState = 'Won';
          events.push({
            journeyId,
            timestamp: currentTime,
            channel: channels[channelIdx],
            stage: 'Won',
          });
          break;
        }

        // Record arrival at next stage
        const nextStage = CONVERSION_STAGES[currentStageIdx] as FunnelStage;
        events.push({
          journeyId,
          timestamp: currentTime,
          channel: channels[channelIdx],
          stage: nextStage,
        });

        currentStageIdx++;
      }
    }

    journeys.push({ journeyId, events, terminalState });
  }

  return { journeys, rngSnapshots };
}

/**
 * Replay a single journey from a seed snapshot.
 * Returns the sequence of (channel, rngValue, probBrackets) for DiceRoll animation.
 */
export interface DiceRollStep {
  stage: FunnelStage;
  channel: string;
  rngValue: number;
  probBrackets: Array<{ label: string; min: number; max: number; chosen: boolean }>;
}

export function replayJourney(
  config: MarkovConfig,
  snapshot: RngStateSnapshot
): DiceRollStep[] {
  const { channels, entryProbs, transitions, maxTouchesPerStage } = config;
  const n = channels.length;
  const rng = mulberry32(snapshot.seedAtJourneyStart);

  const steps: DiceRollStep[] = [];
  let currentStageIdx = 0;

  // Replay the same entry channel pick
  const entryRng = rng.next();
  let channelIdx = weightedChoice(entryProbs, () => entryRng);

  // Build entry step
  steps.push({
    stage: 'Touch',
    channel: channels[channelIdx],
    rngValue: entryRng,
    probBrackets: buildBrackets(channels, entryProbs, channelIdx),
  });

  while (currentStageIdx < STAGE_SEQUENCE.length) {
    const currentStage = STAGE_SEQUENCE[currentStageIdx];
    let touchCount = 0;
    let advanced = false;
    let dropped = false;

    while (touchCount < maxTouchesPerStage) {
      touchCount++;
      rng.next(); // timestamp advance

      const row = transitions[channelIdx];
      const r = rng.next();
      const choice = weightedChoice(row, () => r);

      const colLabels = [
        ...channels,
        'Stage Advance',
        'Drop',
      ];

      steps.push({
        stage: currentStage,
        channel: channels[channelIdx],
        rngValue: r,
        probBrackets: buildBrackets(colLabels, row, choice),
      });

      if (choice === n) {
        advanced = true;
        break;
      } else if (choice === n + 1) {
        dropped = true;
        break;
      } else {
        channelIdx = choice;
      }
    }

    if (dropped || (!advanced && touchCount >= maxTouchesPerStage)) break;
    if (advanced) {
      currentStageIdx++;
      if (currentStageIdx >= STAGE_SEQUENCE.length) break;
    }
  }

  return steps;
}

function buildBrackets(
  labels: string[],
  probs: number[],
  chosenIdx: number
): DiceRollStep['probBrackets'] {
  const brackets: DiceRollStep['probBrackets'] = [];
  let cumulative = 0;
  for (let i = 0; i < probs.length; i++) {
    const min = cumulative;
    const max = cumulative + probs[i];
    brackets.push({ label: labels[i], min, max, chosen: i === chosenIdx });
    cumulative = max;
  }
  return brackets;
}
