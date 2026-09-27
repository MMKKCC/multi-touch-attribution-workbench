import { useState, useCallback } from 'react';
import { useConfigStore } from '../../store/configStore.js';

export function MatrixEditor() {
  const channels = useConfigStore(s => s.channels);
  const entryProbs = useConfigStore(s => s.entryProbs);
  const transitions = useConfigStore(s => s.transitions);
  const setTransitionCell = useConfigStore(s => s.setTransitionCell);
  const setEntryProbs = useConfigStore(s => s.setEntryProbs);

  const n = channels.length;
  const colLabels = [...channels, 'Advance', 'Drop'];

  const rowSum = (row: number[]): number =>
    row.reduce((a, b) => a + b, 0);

  const [focusedCell, setFocusedCell] = useState<{ r: number; c: number } | null>(null);

  const handleCellChange = useCallback(
    (row: number, col: number, rawValue: string) => {
      const value = parseFloat(rawValue);
      if (isNaN(value)) return;
      setTransitionCell(row, col, Math.max(0, Math.min(1, value / 100)));
    },
    [setTransitionCell]
  );

  const handleEntryChange = useCallback(
    (idx: number, rawValue: string) => {
      const value = parseFloat(rawValue);
      if (isNaN(value)) return;
      const updated = [...entryProbs];
      updated[idx] = Math.max(0, Math.min(1, value / 100));
      setEntryProbs(updated);
    },
    [entryProbs, setEntryProbs]
  );

  const entrySum = entryProbs.reduce((a, b) => a + b, 0);

  return (
    <div className="matrix-editor">
      <h3>Transition Matrix</h3>
      <p className="matrix-help">
        Each row is a channel. Columns show probability (%) of moving to each next channel,
        advancing the stage, or dropping out. Rows must sum to 100%.
      </p>

      <div className="matrix-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th className="matrix-label-col">From ↓ / To →</th>
              <th className="matrix-entry-col">Entry %</th>
              {colLabels.map(label => (
                <th key={label} className={label === 'Advance' ? 'col-advance' : label === 'Drop' ? 'col-drop' : ''}>
                  {label}
                </th>
              ))}
              <th>Sum</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((ch, row) => {
              const sum = rowSum(transitions[row]);
              const sumPct = Math.round(sum * 100);
              const isValid = Math.abs(sum - 1) < 0.005;

              return (
                <tr key={ch} className={isValid ? '' : 'row-invalid'}>
                  <td className="matrix-channel-label">{ch}</td>
                  <td className="matrix-entry-cell">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      defaultValue={Math.round(entryProbs[row] * 100)}
                      key={`entry-${row}-${Math.round(entryProbs[row] * 100)}`}
                      onBlur={e => handleEntryChange(row, e.target.value)}
                      className="matrix-input"
                    />
                  </td>
                  {transitions[row].map((cell, col) => {
                    const isFocused = focusedCell?.r === row && focusedCell?.c === col;
                    return (
                      <td
                        key={col}
                        className={`matrix-cell ${col === n ? 'col-advance' : col === n + 1 ? 'col-drop' : ''}`}
                      >
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          defaultValue={Math.round(cell * 100)}
                          key={`cell-${row}-${col}-${Math.round(cell * 100)}`}
                          onFocus={() => setFocusedCell({ r: row, c: col })}
                          onBlur={e => {
                            setFocusedCell(null);
                            handleCellChange(row, col, e.target.value);
                          }}
                          className={`matrix-input ${isFocused ? 'focused' : ''}`}
                        />
                      </td>
                    );
                  })}
                  <td
                    className={`matrix-sum ${isValid ? 'sum-valid' : 'sum-invalid'}`}
                  >
                    {sumPct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="matrix-channel-label">Entry Sum</td>
              <td
                colSpan={colLabels.length + 1}
                className={`matrix-sum ${Math.abs(entrySum - 1) < 0.005 ? 'sum-valid' : 'sum-invalid'}`}
              >
                {Math.round(entrySum * 100)}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
