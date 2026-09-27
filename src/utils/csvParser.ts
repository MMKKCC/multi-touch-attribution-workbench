import type { RawEvent, RawJourney, FunnelStage } from '../types/index.js';

const VALID_STAGES = new Set(['Touch', 'MQL', 'SQL', 'Opp', 'Won', 'Lost']);

/**
 * Parses a CSV file with columns: Journey_ID, Timestamp, Channel, Stage
 * Timestamp can be a Unix epoch (seconds or ms) or ISO-8601 date string.
 * Parsed entirely client-side — no server upload.
 */
export async function parseCSV(file: File): Promise<RawJourney[]> {
  const text = await file.text();
  return parseCSVText(text);
}

export function parseCSVText(text: string): RawJourney[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const journeyIdCol = header.indexOf('journey_id');
  const timestampCol = header.indexOf('timestamp');
  const channelCol = header.indexOf('channel');
  const stageCol = header.indexOf('stage');

  if ([journeyIdCol, timestampCol, channelCol, stageCol].some(i => i === -1)) {
    throw new Error(
      'CSV must contain columns: Journey_ID, Timestamp, Channel, Stage (case-insensitive)'
    );
  }

  const journeyMap = new Map<string, RawEvent[]>();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 4) continue;

    const journeyId = cols[journeyIdCol].trim();
    const rawTs = cols[timestampCol].trim();
    const channel = cols[channelCol].trim();
    const stage = cols[stageCol].trim() as FunnelStage;

    if (!journeyId || !channel) continue;
    if (!VALID_STAGES.has(stage)) continue;

    const timestamp = parseTimestamp(rawTs);
    if (isNaN(timestamp)) continue;

    if (!journeyMap.has(journeyId)) journeyMap.set(journeyId, []);
    journeyMap.get(journeyId)!.push({ journeyId, timestamp, channel, stage });
  }

  const journeys: RawJourney[] = [];

  for (const [journeyId, events] of journeyMap.entries()) {
    events.sort((a, b) => a.timestamp - b.timestamp);

    const stages = events.map(e => e.stage);
    const hasWon = stages.includes('Won');
    const hasLost = stages.includes('Lost');
    const terminalState = hasWon ? 'Won' : hasLost ? 'Lost' : 'Null';

    journeys.push({ journeyId, events, terminalState });
  }

  return journeys;
}

function parseTimestamp(raw: string): number {
  const num = Number(raw);
  if (!isNaN(num)) {
    // Detect milliseconds vs seconds by magnitude
    return num > 1e10 ? Math.floor(num / 1000) : Math.floor(num);
  }
  const date = new Date(raw);
  if (!isNaN(date.getTime())) {
    return Math.floor(date.getTime() / 1000);
  }
  return NaN;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
