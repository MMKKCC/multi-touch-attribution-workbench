import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import type { SankeyNode, SankeyLink, SankeyGraph } from 'd3-sankey';
import type { RawJourney } from '../../types/index.js';

interface NodeDatum {
  name: string;
  stage: string;
  channel: string;
}

type SNode = SankeyNode<NodeDatum, Record<string, never>>;
type SLink = SankeyLink<NodeDatum, Record<string, never>>;

interface SankeyViewProps {
  journeys: RawJourney[];
}

// Color scheme per channel
const CHANNEL_COLORS: Record<string, string> = {
  'Paid Search': '#4f9cf9',
  Organic: '#50c878',
  Webinar: '#f7a35c',
  LinkedIn: '#0077b5',
  Referral: '#9b59b6',
  Email: '#f4d03f',
};

const STAGE_ORDER = ['Touch', 'MQL', 'SQL', 'Opp', 'Won', 'Lost'];

function getColor(channel: string): string {
  return CHANNEL_COLORS[channel] ?? '#aaa';
}

export function SankeyView({ journeys }: SankeyViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const { nodes, links } = useMemo(() => {
    // Build flow counts: from (channel, stage) → (channel, stage)
    const flowCounts = new Map<string, number>();
    const nodeSet = new Set<string>();

    const nodeKey = (channel: string, stage: string) => `${channel}::${stage}`;

    for (const journey of journeys) {
      const events = [...journey.events].sort((a, b) => a.timestamp - b.timestamp);
      for (let i = 0; i < events.length - 1; i++) {
        const from = nodeKey(events[i].channel, events[i].stage);
        const to = nodeKey(events[i + 1].channel, events[i + 1].stage);
        nodeSet.add(from);
        nodeSet.add(to);
        const key = `${from}→${to}`;
        flowCounts.set(key, (flowCounts.get(key) ?? 0) + 1);
      }
      if (events.length > 0) {
        const last = events[events.length - 1];
        nodeSet.add(nodeKey(last.channel, last.stage));
      }
    }

    const nodeList = Array.from(nodeSet).sort((a, b) => {
      const [, stageA] = a.split('::');
      const [, stageB] = b.split('::');
      return STAGE_ORDER.indexOf(stageA) - STAGE_ORDER.indexOf(stageB);
    });

    const nodeIndex = new Map(nodeList.map((k, i) => [k, i]));

    const nodes: NodeDatum[] = nodeList.map(k => {
      const [channel, stage] = k.split('::');
      return { name: k, channel, stage };
    });

    const links: { source: number; target: number; value: number }[] = [];
    for (const [key, count] of flowCounts.entries()) {
      const [from, to] = key.split('→');
      const sourceIdx = nodeIndex.get(from);
      const targetIdx = nodeIndex.get(to);
      if (sourceIdx !== undefined && targetIdx !== undefined && sourceIdx !== targetIdx) {
        links.push({ source: sourceIdx, target: targetIdx, value: count });
      }
    }

    return { nodes, links };
  }, [journeys]);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 900;
    const height = svgRef.current.clientHeight || 500;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    const sankeyLayout = sankey<NodeDatum, Record<string, never>>()
      .nodeWidth(18)
      .nodePadding(12)
      .extent([
        [margin.left, margin.top],
        [width - margin.right, height - margin.bottom],
      ]);

    const graph: SankeyGraph<NodeDatum, Record<string, never>> = sankeyLayout({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d })),
    });

    // Draw links
    svg
      .append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', d => getColor((d.source as SNode).channel))
      .attr('stroke-width', d => Math.max(1, d.width ?? 1))
      .attr('stroke-opacity', 0.35)
      .on('mouseenter', function () {
        d3.select(this).attr('stroke-opacity', 0.7);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('stroke-opacity', 0.35);
      })
      .append('title')
      .text(d => `${(d.source as SNode).name} → ${(d.target as SNode).name}\n${d.value} journeys`);

    // Draw nodes
    const nodeGroup = svg
      .append('g')
      .selectAll('g')
      .data(graph.nodes)
      .join('g');

    nodeGroup
      .append('rect')
      .attr('x', d => d.x0 ?? 0)
      .attr('y', d => d.y0 ?? 0)
      .attr('width', d => (d.x1 ?? 0) - (d.x0 ?? 0))
      .attr('height', d => Math.max(1, (d.y1 ?? 0) - (d.y0 ?? 0)))
      .attr('fill', d => getColor(d.channel))
      .attr('rx', 3);

    nodeGroup
      .append('text')
      .attr('x', d => (d.x0 ?? 0) < width / 2 ? (d.x1 ?? 0) + 6 : (d.x0 ?? 0) - 6)
      .attr('y', d => ((d.y1 ?? 0) + (d.y0 ?? 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => (d.x0 ?? 0) < width / 2 ? 'start' : 'end')
      .attr('fill', '#ddd')
      .attr('font-size', '11px')
      .text(d => `${d.channel} (${d.stage})`);
  }, [nodes, links]);

  return (
    <div className="sankey-view">
      <svg ref={svgRef} className="sankey-svg" />
    </div>
  );
}
