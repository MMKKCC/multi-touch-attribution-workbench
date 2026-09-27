import { useConfigStore } from '../../store/configStore.js';
import { useResultStore, computeBudget } from '../../store/resultStore.js';
import { CONVERSION_STAGES } from '../../types/index.js';

export function BudgetPanel() {
  const channels = useConfigStore(s => s.channels);
  const budgetConfig = useConfigStore(s => s.budgetConfig);
  const setBudgetConfig = useConfigStore(s => s.setBudgetConfig);
  const attributionMatrices = useResultStore(s => s.attributionMatrices);
  const budgetResult = useResultStore(s => s.budgetResult);
  const setBudgetResult = useResultStore(s => s.setBudgetResult);

  const markovMatrix = attributionMatrices.markov;

  const handleRun = () => {
    if (!markovMatrix) return;
    const result = computeBudget(markovMatrix, budgetConfig, channels);
    setBudgetResult(result);
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="budget-panel">
      <h3>Budget Optimizer</h3>

      <div className="budget-section">
        <h4>Stage Values</h4>
        {CONVERSION_STAGES.map(stage => (
          <div key={stage} className="budget-row">
            <label>{stage}</label>
            <input
              type="number"
              min={0}
              step={100}
              value={budgetConfig.stageValues[stage] ?? 0}
              onChange={e => {
                const updated = { ...budgetConfig.stageValues, [stage]: Number(e.target.value) };
                setBudgetConfig({ ...budgetConfig, stageValues: updated });
              }}
              className="budget-input"
            />
          </div>
        ))}
      </div>

      <div className="budget-section">
        <h4>Current Channel Spend</h4>
        {channels.map(ch => (
          <div key={ch} className="budget-row">
            <label>{ch}</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={budgetConfig.channelSpend[ch] ?? 0}
              onChange={e => {
                const updated = { ...budgetConfig.channelSpend, [ch]: Number(e.target.value) };
                setBudgetConfig({ ...budgetConfig, channelSpend: updated });
              }}
              className="budget-input"
            />
          </div>
        ))}
        <div className="budget-total">
          Total: {formatCurrency(Object.values(budgetConfig.channelSpend).reduce((a, b) => a + b, 0))}
        </div>
      </div>

      <div className="budget-row">
        <label>
          <input
            type="checkbox"
            checked={budgetConfig.enableSaturation}
            onChange={e => setBudgetConfig({ ...budgetConfig, enableSaturation: e.target.checked })}
          />
          {' '}Diminishing returns (α·log(spend+1))
        </label>
      </div>

      <button
        className="budget-run-btn"
        onClick={handleRun}
        disabled={!markovMatrix}
        title={!markovMatrix ? 'Generate data first' : ''}
      >
        Optimize Budget
      </button>

      {budgetResult && (
        <div className="budget-results">
          <div className="budget-summary">
            <div className="budget-kpi">
              <span>Current Value</span>
              <strong>{formatCurrency(budgetResult.currentValue)}</strong>
            </div>
            <div className="budget-kpi">
              <span>Optimized Value</span>
              <strong className="kpi-positive">{formatCurrency(budgetResult.optimizedValue)}</strong>
            </div>
          </div>

          <table className="budget-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Current</th>
                <th>Optimized</th>
                <th>Δ</th>
              </tr>
            </thead>
            <tbody>
              {channels.map(ch => {
                const current = budgetResult.currentAllocation[ch] ?? 0;
                const optimized = budgetResult.optimizedAllocation[ch] ?? 0;
                const delta = optimized - current;
                return (
                  <tr key={ch}>
                    <td>{ch}</td>
                    <td>{formatCurrency(current)}</td>
                    <td>{formatCurrency(optimized)}</td>
                    <td className={delta >= 0 ? 'delta-positive' : 'delta-negative'}>
                      {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
