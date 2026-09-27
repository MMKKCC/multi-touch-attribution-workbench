import { useEffect, useCallback, useRef, useState } from 'react';
import * as Comlink from 'comlink';
import type { IAttributionEngine } from './types/index.js';
import { useConfigStore } from './store/configStore.js';
import { useDataStore } from './store/dataStore.js';
import { useResultStore, computeBudget } from './store/resultStore.js';
import { generateJourneys } from './engine/SyntheticGenerator.js';
import { parseCSV } from './utils/csvParser.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ConfigPanel } from './components/controls/ConfigPanel.js';
import { MatrixEditor } from './components/controls/MatrixEditor.js';
import { BudgetPanel } from './components/controls/BudgetPanel.js';
import { PresetLessons } from './components/controls/PresetLessons.js';
import { Visualizer } from './components/visualizers/Visualizer.js';
import { DiceRoll } from './components/visualizers/DiceRoll.js';
import { ModelComparison } from './components/charts/ModelComparison.js';
import { VelocityChart } from './components/charts/VelocityChart.js';
import { saveToUrl, loadFromUrl } from './utils/urlSerializer.js';
import type { SerializableConfig } from './store/configStore.js';

type Tab = 'matrix' | 'budget' | 'presets';
type RightTab = 'visualizer' | 'comparison' | 'velocity' | 'diceroll';

export default function App() {
  const engineRef = useRef<Comlink.Remote<IAttributionEngine> | null>(null);

  const toMarkovConfig = useConfigStore(s => s.toMarkovConfig);
  const channels = useConfigStore(s => s.channels);
  const markovOrder = useConfigStore(s => s.markovOrder);
  const shapleyIterations = useConfigStore(s => s.shapleyIterations);
  const bootstrapIterations = useConfigStore(s => s.bootstrapIterations);
  const budgetConfig = useConfigStore(s => s.budgetConfig);
  const serializable = useConfigStore(s => s.serializable);
  const loadFromSerializable = useConfigStore(s => s.loadFromSerializable);

  const setJourneys = useDataStore(s => s.setJourneys);
  const setLoading = useDataStore(s => s.setLoading);
  const encodedDataset = useDataStore(s => s.encodedDataset);
  const serializedDict = useDataStore(s => s.serializedDict);

  const setHeuristics = useResultStore(s => s.setHeuristics);
  const setMarkov = useResultStore(s => s.setMarkov);
  const setShapley = useResultStore(s => s.setShapley);
  const setConfidenceIntervals = useResultStore(s => s.setConfidenceIntervals);
  const setVelocityMatrix = useResultStore(s => s.setVelocityMatrix);
  const setBudgetResult = useResultStore(s => s.setBudgetResult);
  const setCalculating = useResultStore(s => s.setCalculating);
  const setShapleyProgress = useResultStore(s => s.setShapleyProgress);
  const setError = useResultStore(s => s.setError);
  const isCalculating = useResultStore(s => s.isCalculating);
  const shapleyProgress = useResultStore(s => s.shapleyProgress);
  const attributionMatrices = useResultStore(s => s.attributionMatrices);
  const calcError = useResultStore(s => s.error);

  const [leftTab, setLeftTab] = useState<Tab>('matrix');
  const [rightTab, setRightTab] = useState<RightTab>('visualizer');
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize Comlink worker
  useEffect(() => {
    const worker = new Worker(new URL('./engine/worker.ts', import.meta.url), {
      type: 'module',
    });
    engineRef.current = Comlink.wrap<IAttributionEngine>(worker);

    return () => {
      worker.terminate();
    };
  }, []);

  // Load config from URL on mount
  useEffect(() => {
    const saved = loadFromUrl<SerializableConfig>();
    if (saved) loadFromSerializable(saved);
  }, [loadFromSerializable]);

  const runAllCalculations = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || !encodedDataset || !serializedDict) return;

    setCalculating(true);
    setError(null);

    try {
      await engine.ingestData(encodedDataset, serializedDict);

      // Heuristics
      const heuristics = await engine.calculateHeuristics();
      setHeuristics(heuristics);

      // Markov
      const markov = await engine.calculateMarkov(markovOrder);
      setMarkov(markov);

      // Velocity
      const velocity = await engine.calculateVelocityMetrics();
      setVelocityMatrix(velocity);

      // Bootstrap CI on markov
      const ci = await engine.runBootstrap('markov', bootstrapIterations);
      setConfidenceIntervals(ci);

      // Shapley (can be slow)
      const shapley = await engine.calculateShapley(
        shapleyIterations,
        Comlink.proxy((pct: number) => setShapleyProgress(pct))
      );
      setShapley(shapley);
      setShapleyProgress(1);

      // Budget
      if (markov) {
        const budgetResult = computeBudget(markov, budgetConfig, channels);
        setBudgetResult(budgetResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCalculating(false);
    }
  }, [
    encodedDataset,
    serializedDict,
    markovOrder,
    shapleyIterations,
    bootstrapIterations,
    budgetConfig,
    channels,
    setHeuristics,
    setMarkov,
    setShapley,
    setConfidenceIntervals,
    setVelocityMatrix,
    setBudgetResult,
    setCalculating,
    setShapleyProgress,
    setError,
  ]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const config = toMarkovConfig();
      const { journeys, rngSnapshots } = generateJourneys(config);
      setJourneys(journeys, config.channels, rngSnapshots);
    } finally {
      setIsGenerating(false);
    }
  }, [toMarkovConfig, setJourneys]);

  const handleCSVUpload = useCallback(async (file: File) => {
    setIsGenerating(true);
    try {
      const journeys = await parseCSV(file);
      if (journeys.length === 0) throw new Error('No valid journeys found in CSV.');
      // Extract channels from the uploaded data
      const channelSet = new Set<string>();
      for (const j of journeys) {
        for (const e of j.events) channelSet.add(e.channel);
      }
      const csvChannels = Array.from(channelSet).sort();
      setJourneys(journeys, csvChannels, []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  }, [setJourneys]);

  // Auto-calculate when encoded dataset changes
  useEffect(() => {
    if (encodedDataset) {
      runAllCalculations();
    }
  }, [encodedDataset]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShare = () => {
    saveToUrl(serializable());
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">MTA Sandbox</h1>
          <span className="app-subtitle">Multi-Touch Attribution Visualizer</span>
        </div>
        <div className="header-right">
          {calcError && (
            <div className="calc-error" title={calcError}>
              ⚠ Error — check console
            </div>
          )}
          {isCalculating && (
            <div className="calc-status">
              {shapleyProgress > 0 && shapleyProgress < 1
                ? `Shapley ${Math.round(shapleyProgress * 100)}%…`
                : 'Calculating…'}
            </div>
          )}
          <button className="share-btn" onClick={handleShare} title="Copy shareable URL">
            Share URL
          </button>
        </div>
      </header>

      <div className="app-body">
        {/* ─── Left panel ───────────────────────────────── */}
        <aside className="left-panel">
          <div className="tab-bar">
            {(['matrix', 'budget', 'presets'] as Tab[]).map(tab => (
              <button
                key={tab}
                className={`tab-btn ${leftTab === tab ? 'active' : ''}`}
                onClick={() => setLeftTab(tab)}
              >
                {tab === 'matrix' ? 'Matrix' : tab === 'budget' ? 'Budget' : 'Lessons'}
              </button>
            ))}
          </div>

          <ConfigPanel
            onGenerate={handleGenerate}
            isGenerating={isGenerating || isCalculating}
            onCSVUpload={handleCSVUpload}
          />

          <div className="tab-content">
            {leftTab === 'matrix' && <MatrixEditor />}
            {leftTab === 'budget' && <BudgetPanel />}
            {leftTab === 'presets' && (
              <PresetLessons onPresetLoad={handleGenerate} />
            )}
          </div>
        </aside>

        {/* ─── Right panel ──────────────────────────────── */}
        <main className="right-panel">
          <div className="tab-bar">
            {(
              [
                ['visualizer', 'Flow'],
                ['comparison', 'Model Comparison'],
                ['velocity', 'Velocity'],
                ['diceroll', 'Dice Roll'],
              ] as [RightTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                className={`tab-btn ${rightTab === id ? 'active' : ''}`}
                onClick={() => setRightTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="right-content">
            <ErrorBoundary>
              {rightTab === 'visualizer' && <Visualizer />}
              {rightTab === 'comparison' && <ModelComparison />}
              {rightTab === 'velocity' && <VelocityChart />}
              {rightTab === 'diceroll' && <DiceRoll />}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
