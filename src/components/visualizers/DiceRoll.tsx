import { useState, useCallback } from 'react';
import { useDataStore } from '../../store/dataStore.js';
import { useConfigStore } from '../../store/configStore.js';
import { replayJourney } from '../../engine/SyntheticGenerator.js';
import type { DiceRollStep } from '../../engine/SyntheticGenerator.js';

export function DiceRoll() {
  const rngSnapshots = useDataStore(s => s.rngSnapshots);
  const rawJourneys = useDataStore(s => s.rawJourneys);
  const toMarkovConfig = useConfigStore(s => s.toMarkovConfig);

  const [journeyIdx, setJourneyIdx] = useState(0);
  const [steps, setSteps] = useState<DiceRollStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const loadJourney = useCallback(
    (idx: number) => {
      const snapshot = rngSnapshots[idx];
      if (!snapshot) return;
      const config = toMarkovConfig();
      const replaySteps = replayJourney(config, snapshot);
      setSteps(replaySteps);
      setStepIdx(0);
      setIsPlaying(false);
    },
    [rngSnapshots, toMarkovConfig]
  );

  const handleLoad = () => loadJourney(journeyIdx);

  const handleNext = () => setStepIdx(i => Math.min(i + 1, steps.length - 1));
  const handlePrev = () => setStepIdx(i => Math.max(i - 1, 0));

  const currentStep = steps[stepIdx];
  const journey = rawJourneys[journeyIdx];

  if (rawJourneys.length === 0) {
    return (
      <div className="dice-roll-panel">
        <p>Generate journeys first to use the Dice Roll viewer.</p>
      </div>
    );
  }

  return (
    <div className="dice-roll-panel">
      <h3>Single Journey Dice Roll</h3>
      <div className="dice-controls">
        <label htmlFor="journey-picker">Journey #</label>
        <input
          id="journey-picker"
          type="number"
          min={0}
          max={rawJourneys.length - 1}
          value={journeyIdx}
          onChange={e => setJourneyIdx(Number(e.target.value))}
          className="journey-picker"
        />
        <button onClick={handleLoad} className="dice-load-btn">
          Load Journey
        </button>
        {journey && (
          <span className="journey-terminal">
            Terminal: <strong>{journey.terminalState}</strong> · {journey.events.length} events
          </span>
        )}
      </div>

      {steps.length > 0 && (
        <>
          <div className="step-nav">
            <button onClick={handlePrev} disabled={stepIdx === 0} className="step-btn">‹ Prev</button>
            <span className="step-counter">Step {stepIdx + 1} / {steps.length}</span>
            <button onClick={handleNext} disabled={stepIdx === steps.length - 1} className="step-btn">Next ›</button>
          </div>

          {currentStep && (
            <div className="dice-step">
              <div className="dice-step-header">
                <span className="step-stage">Stage: <strong>{currentStep.stage}</strong></span>
                <span className="step-channel">Channel: <strong>{currentStep.channel}</strong></span>
              </div>

              <div className="rng-display">
                <div className="rng-label">RNG roll</div>
                <div className="rng-bar-track">
                  <div
                    className="rng-bar-marker"
                    style={{ left: `${currentStep.rngValue * 100}%` }}
                  />
                </div>
                <div className="rng-value">{currentStep.rngValue.toFixed(4)}</div>
              </div>

              <div className="prob-brackets">
                {currentStep.probBrackets.map((bracket, i) => {
                  const widthPct = bracket.max - bracket.min;
                  return (
                    <div
                      key={i}
                      className={`prob-bracket ${bracket.chosen ? 'bracket-chosen' : ''}`}
                      style={{ flex: widthPct }}
                      title={`${bracket.label}: ${(widthPct * 100).toFixed(1)}%`}
                    >
                      <span className="bracket-label">{bracket.label}</span>
                      <span className="bracket-range">
                        {(bracket.min * 100).toFixed(1)}%–{(bracket.max * 100).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="dice-explanation">
                The RNG rolled <strong>{currentStep.rngValue.toFixed(4)}</strong>, which falls
                in the{' '}
                <strong>
                  {currentStep.probBrackets
                    .find(b => b.chosen)
                    ?.label ?? '?'}
                </strong>{' '}
                bracket (
                {(() => {
                  const chosen = currentStep.probBrackets.find(b => b.chosen);
                  return chosen
                    ? `${(chosen.min * 100).toFixed(1)}%–${(chosen.max * 100).toFixed(1)}%`
                    : '';
                })()}
                ).
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
