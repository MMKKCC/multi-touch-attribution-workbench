import type { PresetLesson } from '../types/index.js';

export const PRESET_LESSONS: PresetLesson[] = [
  {
    id: 'vanity-mql',
    name: 'The Vanity MQL',
    description:
      'Paid Search dominates first-touch and drives high MQL volume, but most of those MQLs never advance. Webinar and Referral quietly drive actual revenue.',
    config: {
      channels: ['Paid Search', 'Organic', 'Webinar', 'LinkedIn', 'Referral', 'Email'],
      entryProbs: [0.55, 0.15, 0.05, 0.10, 0.05, 0.10],
      transitions: [
        // PS: high entry, low advance rate
        [0.15, 0.10, 0.03, 0.08, 0.01, 0.03, 0.20, 0.40],
        [0.05, 0.08, 0.05, 0.07, 0.03, 0.07, 0.45, 0.20],
        // Webinar: lower entry, high advance rate
        [0.02, 0.03, 0.04, 0.04, 0.05, 0.07, 0.68, 0.07],
        [0.07, 0.06, 0.04, 0.05, 0.03, 0.08, 0.42, 0.25],
        // Referral: rare but high conversion
        [0.01, 0.03, 0.06, 0.04, 0.02, 0.06, 0.72, 0.06],
        [0.04, 0.04, 0.05, 0.05, 0.03, 0.05, 0.50, 0.24],
      ],
    },
  },
  {
    id: 'undervalued-assist',
    name: 'The Undervalued Assist',
    description:
      'LinkedIn rarely gets first-touch or last-touch credit, yet it is the middle channel that nudges prospects from Organic toward Webinar closes. Remove it and conversion collapses.',
    config: {
      channels: ['Paid Search', 'Organic', 'Webinar', 'LinkedIn', 'Referral', 'Email'],
      entryProbs: [0.30, 0.35, 0.05, 0.10, 0.05, 0.15],
      transitions: [
        [0.08, 0.12, 0.03, 0.15, 0.02, 0.10, 0.35, 0.15], // PS → often goes to LinkedIn
        [0.05, 0.06, 0.04, 0.22, 0.03, 0.08, 0.35, 0.17], // Organic → heavily to LinkedIn
        [0.03, 0.04, 0.04, 0.05, 0.04, 0.10, 0.60, 0.10], // Webinar → closes well
        [0.04, 0.05, 0.18, 0.04, 0.03, 0.07, 0.52, 0.07], // LinkedIn → routes to Webinar
        [0.02, 0.04, 0.08, 0.05, 0.02, 0.07, 0.60, 0.12],
        [0.05, 0.05, 0.06, 0.10, 0.03, 0.05, 0.46, 0.20],
      ],
    },
  },
  {
    id: 'last-touch-overcrediting',
    name: 'Last-Touch Over-crediting',
    description:
      'Email always receives the last touch before conversion. Last-Touch gives it 100% credit. But Paid Search and LinkedIn built awareness through 80% of the journey.',
    config: {
      channels: ['Paid Search', 'Organic', 'Webinar', 'LinkedIn', 'Referral', 'Email'],
      entryProbs: [0.32, 0.20, 0.08, 0.22, 0.05, 0.13],
      transitions: [
        [0.06, 0.08, 0.04, 0.12, 0.02, 0.28, 0.25, 0.15], // PS → funnels to Email
        [0.05, 0.06, 0.04, 0.08, 0.03, 0.22, 0.35, 0.17],
        [0.03, 0.04, 0.03, 0.05, 0.04, 0.18, 0.55, 0.08],
        [0.08, 0.07, 0.04, 0.05, 0.02, 0.25, 0.35, 0.14], // LI → funnels to Email
        [0.02, 0.03, 0.06, 0.04, 0.02, 0.20, 0.55, 0.08],
        [0.02, 0.02, 0.03, 0.03, 0.02, 0.08, 0.68, 0.12], // Email is the closer
      ],
    },
  },
  {
    id: 'closer-cant-open',
    name: "The Closer That Can't Open",
    description:
      'Webinar has the highest conversion rate of all channels — but only after prior awareness touchpoints. On its own, it generates almost no journeys. First-Touch misses it entirely.',
    config: {
      channels: ['Paid Search', 'Organic', 'Webinar', 'LinkedIn', 'Referral', 'Email'],
      entryProbs: [0.38, 0.28, 0.02, 0.18, 0.04, 0.10],
      transitions: [
        [0.06, 0.07, 0.15, 0.10, 0.02, 0.08, 0.30, 0.22], // PS: feeds Webinar
        [0.05, 0.05, 0.18, 0.08, 0.03, 0.07, 0.32, 0.22], // Organic: feeds Webinar
        [0.02, 0.02, 0.03, 0.03, 0.02, 0.05, 0.78, 0.05], // Webinar: very high advance
        [0.08, 0.07, 0.12, 0.04, 0.02, 0.08, 0.38, 0.21],
        [0.02, 0.03, 0.10, 0.04, 0.02, 0.06, 0.62, 0.11],
        [0.04, 0.04, 0.08, 0.05, 0.02, 0.04, 0.48, 0.25],
      ],
    },
  },
];
