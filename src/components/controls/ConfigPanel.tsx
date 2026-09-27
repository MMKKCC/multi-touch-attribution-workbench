import { useRef } from 'react';
import { useConfigStore } from '../../store/configStore.js';

interface ConfigPanelProps {
  onGenerate: () => void;
  isGenerating: boolean;
  onCSVUpload: (file: File) => void;
}

export function ConfigPanel({ onGenerate, isGenerating, onCSVUpload }: ConfigPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const journeyCount = useConfigStore(s => s.journeyCount);
  const seed = useConfigStore(s => s.seed);
  const markovOrder = useConfigStore(s => s.markovOrder);
  const shapleyIterations = useConfigStore(s => s.shapleyIterations);
  const setJourneyCount = useConfigStore(s => s.setJourneyCount);
  const setSeed = useConfigStore(s => s.setSeed);
  const setMarkovOrder = useConfigStore(s => s.setMarkovOrder);
  const setShapleyIterations = useConfigStore(s => s.setShapleyIterations);
  const channels = useConfigStore(s => s.channels);
  const stateSpaceCount = Math.pow(channels.length, markovOrder) * 4 + 2; // stages × order + absorbing

  return (
    <div className="config-panel">
      <div className="config-row">
        <label htmlFor="journey-count">
          Journeys: <strong>{journeyCount.toLocaleString()}</strong>
        </label>
        <input
          id="journey-count"
          type="range"
          min={100}
          max={10000}
          step={100}
          value={journeyCount}
          onChange={e => setJourneyCount(Number(e.target.value))}
        />
      </div>

      <div className="config-row">
        <label htmlFor="seed-input">RNG Seed</label>
        <input
          id="seed-input"
          type="number"
          value={seed}
          onChange={e => setSeed(Number(e.target.value))}
          className="seed-input"
        />
      </div>

      <div className="config-row">
        <label>Markov Order</label>
        <div className="order-buttons">
          {([1, 2, 3] as const).map(order => (
            <button
              key={order}
              className={`order-btn ${markovOrder === order ? 'active' : ''}`}
              onClick={() => setMarkovOrder(order)}
            >
              {order}{order === 1 ? 'st' : order === 2 ? 'nd' : 'rd'}
            </button>
          ))}
        </div>
        <div className="state-space-counter">
          State space: <strong>{stateSpaceCount.toLocaleString()}</strong> states
          {markovOrder >= 2 && (
            <span className="state-space-warn"> · sparse representation</span>
          )}
        </div>
      </div>

      <div className="config-row">
        <label htmlFor="shapley-iter">
          Shapley iterations: <strong>{shapleyIterations}</strong>
        </label>
        <input
          id="shapley-iter"
          type="range"
          min={500}
          max={5000}
          step={100}
          value={shapleyIterations}
          onChange={e => setShapleyIterations(Number(e.target.value))}
        />
      </div>

      <button
        className="generate-btn"
        onClick={onGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? '⟳ Generating…' : '▶ Generate & Calculate'}
      </button>

      <div className="csv-upload-row">
        <span className="csv-label">or upload CSV (Journey_ID, Timestamp, Channel, Stage)</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) onCSVUpload(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
        <button
          className="csv-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isGenerating}
        >
          Upload CSV
        </button>
      </div>
    </div>
  );
}
