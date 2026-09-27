import type {
  Dictionary,
  EncodedDataset,
  RawJourney,
  SerializedDictionary,
} from '../types/index.js';
import { FUNNEL_STAGES } from '../types/index.js';

const FIELDS_PER_EVENT = 4; // [journeyId_int, timestamp, channel_int, stage_int]
const FIELDS_PER_POINTER = 2; // [startIndex, length]

export class DictionaryEncoder {
  private dict: Dictionary = {
    channelToInt: new Map(),
    intToChannel: new Map(),
    stageToInt: new Map(),
    intToStage: new Map(),
    journeyToInt: new Map(),
    intToJourney: new Map(),
  };

  constructor(channels: string[]) {
    // Stages are fixed and always pre-registered in canonical order
    FUNNEL_STAGES.forEach((stage, i) => {
      this.dict.stageToInt.set(stage, i);
      this.dict.intToStage.set(i, stage);
    });

    channels.forEach((ch, i) => {
      this.dict.channelToInt.set(ch, i);
      this.dict.intToChannel.set(i, ch);
    });
  }

  get dictionary(): Dictionary {
    return this.dict;
  }

  serialize(): SerializedDictionary {
    const channels: string[] = [];
    for (let i = 0; i < this.dict.intToChannel.size; i++) {
      channels.push(this.dict.intToChannel.get(i)!);
    }
    const stages: string[] = [];
    for (let i = 0; i < this.dict.intToStage.size; i++) {
      stages.push(this.dict.intToStage.get(i)!);
    }
    const journeys: string[] = [];
    for (let i = 0; i < this.dict.intToJourney.size; i++) {
      journeys.push(this.dict.intToJourney.get(i)!);
    }
    return { channels, stages, journeys };
  }

  encode(journeys: RawJourney[]): EncodedDataset {
    // Register all journey IDs
    journeys.forEach((j, idx) => {
      if (!this.dict.journeyToInt.has(j.journeyId)) {
        this.dict.journeyToInt.set(j.journeyId, idx);
        this.dict.intToJourney.set(idx, j.journeyId);
      }
    });

    const numJourneys = journeys.length;
    const numEvents = journeys.reduce((sum, j) => sum + j.events.length, 0);

    const eventsBuffer = new Uint32Array(numEvents * FIELDS_PER_EVENT);
    const journeyPointers = new Uint32Array(numJourneys * FIELDS_PER_POINTER);

    let eventCursor = 0;

    for (let ji = 0; ji < numJourneys; ji++) {
      const journey = journeys[ji];
      const startIndex = eventCursor * FIELDS_PER_EVENT;
      const length = journey.events.length;

      journeyPointers[ji * FIELDS_PER_POINTER] = startIndex;
      journeyPointers[ji * FIELDS_PER_POINTER + 1] = length;

      for (const event of journey.events) {
        const channelInt = this.dict.channelToInt.get(event.channel) ?? 0;
        const stageInt = this.dict.stageToInt.get(event.stage) ?? 0;
        const journeyInt = this.dict.journeyToInt.get(event.journeyId) ?? 0;

        eventsBuffer[eventCursor * FIELDS_PER_EVENT + 0] = journeyInt;
        eventsBuffer[eventCursor * FIELDS_PER_EVENT + 1] = event.timestamp;
        eventsBuffer[eventCursor * FIELDS_PER_EVENT + 2] = channelInt;
        eventsBuffer[eventCursor * FIELDS_PER_EVENT + 3] = stageInt;

        eventCursor++;
      }
    }

    return { eventsBuffer, journeyPointers, numJourneys, numEvents };
  }
}

/** Decode a journey's events from the encoded buffer for a given journey index */
export function decodeJourney(
  dataset: EncodedDataset,
  dict: SerializedDictionary,
  journeyIndex: number
): Array<{ channel: string; stage: string; timestamp: number }> {
  const ptrBase = journeyIndex * 2;
  const startIndex = dataset.journeyPointers[ptrBase];
  const length = dataset.journeyPointers[ptrBase + 1];

  const events: Array<{ channel: string; stage: string; timestamp: number }> = [];

  for (let i = 0; i < length; i++) {
    const base = startIndex + i * FIELDS_PER_EVENT;
    const timestamp = dataset.eventsBuffer[base + 1];
    const channelInt = dataset.eventsBuffer[base + 2];
    const stageInt = dataset.eventsBuffer[base + 3];

    events.push({
      channel: dict.channels[channelInt] ?? `ch_${channelInt}`,
      stage: dict.stages[stageInt] ?? `stage_${stageInt}`,
      timestamp,
    });
  }

  return events;
}
