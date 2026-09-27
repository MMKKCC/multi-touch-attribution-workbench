import { useResultStore } from '../../store/resultStore.js';
import { useConfigStore } from '../../store/configStore.js';
import { CONVERSION_STAGES } from '../../types/index.js';

export function VelocityChart() {
  const velocityMatrix = useResultStore(s => s.velocityMatrix);
  const channels = useConfigStore(s => s.channels);

  if (!velocityMatrix) {
    return (
      <div className="velocity-empty">
        <p>Velocity metrics will appear after calculation.</p>
      </div>
    );
  }

  // For each stage, find max velocity to normalize bars
  const maxVelocities = Object.fromEntries(
    CONVERSION_STAGES.map(stage => {
      const max = Math.max(
        1,
        ...channels.map(ch => velocityMatrix[ch]?.[stage] ?? 0)
      );
      return [stage, max];
    })
  );

  const formatDuration = (seconds: number): string => {
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
    return `${(seconds / 86400).toFixed(1)}d`;
  };

  return (
    <div className="velocity-chart">
      <h3>Velocity: Avg Time in Stage (by Channel)</h3>
      <div className="velocity-stages">
        {CONVERSION_STAGES.map(stage => (
          <div key={stage} className="velocity-stage-col">
            <div className="velocity-stage-header">{stage}</div>
            {channels.map(ch => {
              const duration = velocityMatrix[ch]?.[stage] ?? 0;
              const pct = maxVelocities[stage] > 0 ? duration / maxVelocities[stage] : 0;
              // Invert color: shorter time = faster = green
              const hue = Math.round((1 - pct) * 120); // 0=red, 120=green
              return (
                <div key={ch} className="velocity-row">
                  <span className="velocity-channel">{ch}</span>
                  <div className="velocity-bar-track">
                    <div
                      className="velocity-bar"
                      style={{
                        width: `${pct * 100}%`,
                        backgroundColor: `hsl(${hue}, 70%, 45%)`,
                      }}
                    />
                  </div>
                  <span className="velocity-value">
                    {duration > 0 ? formatDuration(duration) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="velocity-note">
        Shorter bars = faster pipeline velocity. Green = fast, Red = slow.
      </p>
    </div>
  );
}
