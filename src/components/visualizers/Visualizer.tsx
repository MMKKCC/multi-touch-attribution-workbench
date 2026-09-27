import { useDataStore } from '../../store/dataStore.js';
import { SankeyView } from './SankeyView.js';
import { PixiView } from './PixiView.js';

const LOD_THRESHOLD = 1000;

export function Visualizer() {
  const rawJourneys = useDataStore(s => s.rawJourneys);
  const n = rawJourneys.length;

  if (n === 0) {
    return (
      <div className="visualizer-empty">
        <p>Configure parameters and click <strong>Generate & Calculate</strong> to begin.</p>
      </div>
    );
  }

  return (
    <div className="visualizer-container">
      <div className="visualizer-header">
        <span className="journey-count">{n.toLocaleString()} journeys</span>
        <span className="lod-badge">
          {n <= LOD_THRESHOLD ? '⚡ WebGL Particles' : '🗺 Sankey Aggregate'}
        </span>
      </div>

      {n <= LOD_THRESHOLD ? (
        <PixiView journeys={rawJourneys} />
      ) : (
        <SankeyView journeys={rawJourneys} />
      )}
    </div>
  );
}
