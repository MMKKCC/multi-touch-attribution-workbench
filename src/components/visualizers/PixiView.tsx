import { useEffect, useRef, useMemo } from 'react';
import type { RawJourney } from '../../types/index.js';

interface PixiViewProps {
  journeys: RawJourney[];
}

const STAGE_ORDER = ['Touch', 'MQL', 'SQL', 'Opp', 'Won', 'Lost'];

const CHANNEL_COLORS: Record<string, string> = {
  'Paid Search': '#4f9cf9',
  Organic: '#50c878',
  Webinar: '#f7a35c',
  LinkedIn: '#0077b5',
  Referral: '#9b59b6',
  Email: '#f4d03f',
};

const DEFAULT_COLOR = '#aaaaaa';
const ANIMATION_DURATION = 8000;
const PARTICLE_RADIUS = 3;
const WIDTH = 900;
const HEIGHT = 500;
const MARGIN = { top: 40, right: 40, bottom: 40, left: 40 };

interface NodePosition {
  x: number;
  y: number;
}

export function PixiView({ journeys }: PixiViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const { channels, nodePositions, stagesActive } = useMemo(() => {
    const channelSet = new Set<string>();
    for (const j of journeys) {
      for (const e of j.events) channelSet.add(e.channel);
    }
    const channels = Array.from(channelSet);

    const stagesActive = STAGE_ORDER.filter(s =>
      journeys.some(j => j.events.some(e => e.stage === s))
    );

    const xStep = (WIDTH - MARGIN.left - MARGIN.right) / Math.max(1, stagesActive.length - 1);
    const yStep = (HEIGHT - MARGIN.top - MARGIN.bottom) / Math.max(1, channels.length - 1);

    const positions = new Map<string, NodePosition>();
    for (let si = 0; si < stagesActive.length; si++) {
      const x = MARGIN.left + si * xStep;
      for (let ci = 0; ci < channels.length; ci++) {
        const y = MARGIN.top + ci * yStep;
        positions.set(`${channels[ci]}::${stagesActive[si]}`, { x, y });
      }
    }

    return { channels, nodePositions: positions, stagesActive };
  }, [journeys]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startTime = performance.now();

    function draw() {
      if (!ctx || !canvas) return;
      const elapsed = performance.now() - startTime;
      const globalProgress = (elapsed % ANIMATION_DURATION) / ANIMATION_DURATION;

      // Background
      ctx.fillStyle = '#12141a';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Draw nodes
      for (const [key, pos] of nodePositions.entries()) {
        const [channel] = key.split('::');
        const color = CHANNEL_COLORS[channel] ?? DEFAULT_COLOR;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = color + '66'; // ~40% opacity
        ctx.fill();
      }

      // Draw labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#cccccc';
      ctx.font = '9px sans-serif';
      for (const [key, pos] of nodePositions.entries()) {
        const [channel, stage] = key.split('::');
        ctx.fillText(channel, pos.x, pos.y + 12);
        ctx.fillText(stage, pos.x, pos.y + 22);
      }

      // Draw particles
      for (const journey of journeys) {
        const events = journey.events;
        if (events.length === 0) continue;

        const totalEvents = events.length;
        const rawIdx = globalProgress * totalEvents;
        const eventIdx = Math.min(Math.floor(rawIdx), totalEvents - 1);
        const localProgress = rawIdx - eventIdx;

        const eventA = events[eventIdx];
        const eventB = events[Math.min(eventIdx + 1, totalEvents - 1)];

        const posA = nodePositions.get(`${eventA.channel}::${eventA.stage}`);
        const posB = nodePositions.get(`${eventB.channel}::${eventB.stage}`);

        const color = CHANNEL_COLORS[eventA.channel] ?? DEFAULT_COLOR;

        let px: number, py: number;
        if (posA && posB) {
          const t = localProgress;
          const cpX = (posA.x + posB.x) / 2;
          const cpY = Math.min(posA.y, posB.y) - 30;
          px = bezier(posA.x, cpX, posB.x, t);
          py = bezier(posA.y, cpY, posB.y, t);
        } else if (posA) {
          px = posA.x;
          py = posA.y;
        } else {
          continue;
        }

        ctx.beginPath();
        ctx.arc(px, py, PARTICLE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [journeys, nodePositions]);

  return (
    <div className="pixi-view">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="pixi-canvas"
      />
    </div>
  );
}

function bezier(p0: number, p1: number, p2: number, t: number): number {
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
}
