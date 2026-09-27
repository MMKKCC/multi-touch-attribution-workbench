import { create } from 'zustand';
import type {
  Dictionary,
  EncodedDataset,
  RawJourney,
  RngStateSnapshot,
  SerializedDictionary,
} from '../types/index.js';
import { DictionaryEncoder } from '../engine/DictionaryEncoder.js';

interface DataState {
  rawJourneys: RawJourney[];
  encodedDataset: EncodedDataset | null;
  serializedDict: SerializedDictionary | null;
  dictionary: Dictionary | null;
  rngSnapshots: RngStateSnapshot[];
  isLoading: boolean;
  error: string | null;

  setJourneys: (
    journeys: RawJourney[],
    channels: string[],
    snapshots: RngStateSnapshot[]
  ) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useDataStore = create<DataState>((set) => ({
  rawJourneys: [],
  encodedDataset: null,
  serializedDict: null,
  dictionary: null,
  rngSnapshots: [],
  isLoading: false,
  error: null,

  setJourneys: (journeys, channels, snapshots) => {
    const encoder = new DictionaryEncoder(channels);
    const encodedDataset = encoder.encode(journeys);
    const serializedDict = encoder.serialize();
    const dictionary = encoder.dictionary;

    set({
      rawJourneys: journeys,
      encodedDataset,
      serializedDict,
      dictionary,
      rngSnapshots: snapshots,
      error: null,
    });
  },

  setLoading: loading => set({ isLoading: loading }),
  setError: error => set({ error }),

  clear: () =>
    set({
      rawJourneys: [],
      encodedDataset: null,
      serializedDict: null,
      dictionary: null,
      rngSnapshots: [],
      error: null,
    }),
}));
