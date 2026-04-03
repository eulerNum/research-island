import { useState } from 'react';
import { getLLMConfig, setLLMConfig, AVAILABLE_MODELS } from '../services/llmService';
import type { LLMProvider, AIFeature, CostTier } from '../services/llmService';

interface AISettingsProps {
  onClose: () => void;
}

const COST_LABELS: Record<CostTier, { text: string; color: string }> = {
  free: { text: 'free', color: '#2a9d8f' },
  cheap: { text: 'cheap', color: '#6ab04c' },
  moderate: { text: 'moderate', color: '#f0932b' },
  expensive: { text: 'expensive', color: '#e76f51' },
};

const FEATURE_LABELS: { key: AIFeature; label: string; desc: string }[] = [
  { key: 'chat', label: 'Chat (AI 채팅)', desc: 'tool use 포함' },
  { key: 'deepSearch', label: 'Deep Search (깊은 탐색)', desc: '논문 탐색 파이프라인' },
  { key: 'summary', label: 'Summary (논문 요약)', desc: '개별 논문 요약' },
];

const PROVIDER_LABELS: Record<LLMProvider, { name: string; placeholder: string; link?: string }> = {
  gemini: { name: 'Gemini', placeholder: 'AIzaSy...', link: 'https://aistudio.google.com/apikey' },
  openai: { name: 'OpenAI', placeholder: 'sk-proj-...', link: 'https://platform.openai.com/api-keys' },
  anthropic: { name: 'Anthropic', placeholder: 'sk-ant-...', link: 'https://console.anthropic.com/settings/keys' },
};

export default function AISettings({ onClose }: AISettingsProps) {
  const existing = getLLMConfig();
  const [keys, setKeys] = useState<Record<LLMProvider, string>>({
    gemini: existing.apiKeys.gemini ?? '',
    openai: existing.apiKeys.openai ?? '',
    anthropic: existing.apiKeys.anthropic ?? '',
  });
  const [models, setModels] = useState(existing.models);

  const handleSave = () => {
    setLLMConfig({
      apiKeys: {
        gemini: keys.gemini.trim() || undefined,
        openai: keys.openai.trim() || undefined,
        anthropic: keys.anthropic.trim() || undefined,
      },
      models,
    });
    onClose();
  };

  const availableModelsForFeature = (feature: AIFeature) => {
    return AVAILABLE_MODELS.filter((m) => {
      // Show models whose provider has a key entered (or already selected)
      const hasKey = !!keys[m.provider].trim();
      const isSelected = models[feature].provider === m.provider && models[feature].modelId === m.modelId;
      return hasKey || isSelected;
    });
  };

  const hasAnyKey = Object.values(keys).some((k) => k.trim());

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-modal-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-primary)',
          borderRadius: 10,
          padding: 24,
          color: 'var(--text-primary)',
          width: 480,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>AI Settings</h3>

        {/* API Keys */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            API Keys
          </div>
          {(Object.keys(PROVIDER_LABELS) as LLMProvider[]).map((provider) => {
            const info = PROVIDER_LABELS[provider];
            return (
              <div key={provider} style={{ marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 3 }}>
                  {info.name}
                  {keys[provider].trim() && <span style={{ color: '#2a9d8f', fontSize: '0.7rem' }}>saved</span>}
                </label>
                <input
                  type="password"
                  value={keys[provider]}
                  onChange={(e) => setKeys({ ...keys, [provider]: e.target.value })}
                  placeholder={info.placeholder}
                  style={inputStyle}
                />
                {info.link && (
                  <a
                    href={info.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.65rem', color: 'var(--accent-forward)', marginTop: 2, display: 'inline-block' }}
                  >
                    Get API key
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* Model Selection */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Model Selection
          </div>
          {FEATURE_LABELS.map(({ key, label, desc }) => {
            const options = availableModelsForFeature(key);
            const currentModel = AVAILABLE_MODELS.find(
              (m) => m.provider === models[key].provider && m.modelId === models[key].modelId,
            );
            const cost = currentModel ? COST_LABELS[currentModel.costTier] : null;

            return (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 3 }}>
                  {label}
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 6 }}>{desc}</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={`${models[key].provider}:${models[key].modelId}`}
                    onChange={(e) => {
                      const [provider, modelId] = e.target.value.split(':') as [LLMProvider, string];
                      setModels({ ...models, [key]: { provider, modelId } });
                    }}
                    style={selectStyle}
                  >
                    {options.map((m) => (
                      <option key={`${m.provider}:${m.modelId}`} value={`${m.provider}:${m.modelId}`}>
                        {m.displayName}
                      </option>
                    ))}
                    {options.length === 0 && (
                      <option disabled>API 키를 먼저 입력하세요</option>
                    )}
                  </select>
                  {cost && (
                    <span style={{
                      fontSize: '0.65rem',
                      color: cost.color,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}>
                      {cost.text}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
          API 키가 입력된 provider의 모델만 선택 가능합니다.
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!hasAnyKey}
            style={{
              ...btnPrimary,
              opacity: hasAnyKey ? 1 : 0.5,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border-input)',
  borderRadius: 4,
  fontSize: '0.85rem',
  boxSizing: 'border-box',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
};

const selectStyle: React.CSSProperties = {
  flex: 1,
  padding: '7px 10px',
  border: '1px solid var(--border-input)',
  borderRadius: 4,
  fontSize: '0.82rem',
  boxSizing: 'border-box',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  padding: '6px 14px',
  border: 'none',
  borderRadius: 4,
  background: 'var(--accent-forward)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '0.85rem',
};

const btnSecondary: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid var(--btn-secondary-border)',
  borderRadius: 4,
  background: 'var(--bg-primary)',
  cursor: 'pointer',
  fontSize: '0.85rem',
  color: 'var(--text-primary)',
};
