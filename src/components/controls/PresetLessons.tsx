import { useConfigStore } from '../../store/configStore.js';
import { PRESET_LESSONS } from '../../store/presets.js';

interface PresetLessonsProps {
  onPresetLoad: () => void;
}

export function PresetLessons({ onPresetLoad }: PresetLessonsProps) {
  const loadPreset = useConfigStore(s => s.loadPreset);

  const handleLoad = (id: string) => {
    loadPreset(id);
    onPresetLoad();
  };

  return (
    <div className="presets-panel">
      <h3>Lesson Presets</h3>
      <div className="presets-grid">
        {PRESET_LESSONS.map(lesson => (
          <button
            key={lesson.id}
            className="preset-card"
            onClick={() => handleLoad(lesson.id)}
            title={lesson.description}
          >
            <span className="preset-name">{lesson.name}</span>
            <span className="preset-desc">{lesson.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
