import { useState, useRef, useEffect } from 'react';
import { useResultStore } from '../../store/resultStore.js';
import { useConfigStore } from '../../store/configStore.js';
import { CONVERSION_STAGES, MODEL_LABELS } from '../../types/index.js';
import type { ModelType } from '../../types/index.js';

const MODELS: ModelType[] = ['firstTouch', 'lastTouch', 'linear', 'timeDecay', 'markov', 'shapley'];

const MODEL_COLORS: Record<ModelType, string> = {
  firstTouch: '#e74c3c',
  lastTouch: '#e67e22',
  linear: '#f1c40f',
  timeDecay: '#2ecc71',
  markov: '#3498db',
  shapley: '#9b59b6',
};

export function ModelComparison() {
  const attributionMatrices = useResultStore(s => s.attributionMatrices);
  const confidenceIntervals = useResultStore(s => s.confidenceIntervals);
  const channels = useConfigStore(s => s.channels);

  const [selectedStage, setSelectedStage] = useState<string>(CONVERSION_STAGES[CONVERSION_STAGES.length - 1]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const availableModels = MODELS.filter(m => attributionMatrices[m] !== undefined);

  if (availableModels.length === 0) {
    return (
      <div className="model-comparison-empty">
        <p>Run attribution calculation to see model comparison.</p>
      </div>
    );
  }

  return (
    <div className="model-comparison">
      <div className="chart-controls">
        <div className="stage-selector">
          {CONVERSION_STAGES.map(stage => (
            <button
              key={stage}
              className={`stage-tab ${selectedStage === stage ? 'active' : ''}`}
              onClick={() => setSelectedStage(stage)}
            >
              {stage}
            </button>
          ))}
        </div>
      </div>

      <div className="bar-chart-container">
        {channels.map(channel => (
          <ChannelBar
            key={channel}
            channel={channel}
            stage={selectedStage}
            models={availableModels}
            attributionMatrices={attributionMatrices}
            confidenceIntervals={confidenceIntervals}
            isSelected={selectedChannel === channel}
            onClick={() => setSelectedChannel(selectedChannel === channel ? null : channel)}
          />
        ))}
      </div>

      <div className="chart-legend">
        {availableModels.map(model => (
          <span key={model} className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: MODEL_COLORS[model] }} />
            {MODEL_LABELS[model]}
          </span>
        ))}
      </div>
    </div>
  );
}

interface ChannelBarProps {
  channel: string;
  stage: string;
  models: ModelType[];
  attributionMatrices: Partial<Record<ModelType, import('../../types/index.js').AttributionMatrix>>;
  confidenceIntervals: import('../../types/index.js').ConfidenceIntervalMatrix | null;
  isSelected: boolean;
  onClick: () => void;
}

function ChannelBar({
  channel,
  stage,
  models,
  attributionMatrices,
  confidenceIntervals,
  isSelected,
  onClick,
}: ChannelBarProps) {
  const barRefs = useRef<Map<ModelType, HTMLDivElement>>(new Map());

  // Animate bar widths
  useEffect(() => {
    for (const model of models) {
      const el = barRefs.current.get(model);
      if (!el) continue;
      const credit = attributionMatrices[model]?.[channel]?.[stage] ?? 0;
      el.style.width = `${credit * 100}%`;
    }
  }, [attributionMatrices, channel, stage, models]);

  return (
    <div
      className={`channel-bar-group ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="channel-bar-label">{channel}</div>
      <div className="channel-bars">
        {models.map(model => {
          const credit = attributionMatrices[model]?.[channel]?.[stage] ?? 0;
          const ci = confidenceIntervals?.[channel]?.[stage];

          return (
            <div key={model} className="model-bar-row" title={`${MODEL_LABELS[model]}: ${(credit * 100).toFixed(1)}%`}>
              <span className="model-label-sm">{MODEL_LABELS[model].slice(0, 3)}</span>
              <div className="bar-track">
                <div
                  ref={el => {
                    if (el) barRefs.current.set(model, el);
                  }}
                  className="bar-fill"
                  style={{
                    backgroundColor: MODEL_COLORS[model],
                    width: `${credit * 100}%`,
                    transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
                {model === 'markov' && ci && (
                  <div
                    className="ci-range"
                    style={{
                      left: `${ci.lower * 100}%`,
                      width: `${(ci.upper - ci.lower) * 100}%`,
                    }}
                  />
                )}
              </div>
              <span className="bar-pct">{(credit * 100).toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
