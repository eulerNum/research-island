import { useState } from 'react';
import { getClaudeConfig, setClaudeConfig } from '../services/aiService';

interface ClaudeSettingsProps {
  onClose: () => void;
}

export default function ClaudeSettings({ onClose }: ClaudeSettingsProps) {
  const existing = getClaudeConfig();
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '');

  const handleSave = () => {
    if (!apiKey.trim()) return;
    setClaudeConfig({ apiKey: apiKey.trim() });
    onClose();
  };

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
          width: 400,
          maxWidth: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>Claude API Settings</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid var(--border-input)',
              borderRadius: 4,
              fontSize: '0.85rem',
              boxSizing: 'border-box',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
            }}
            autoFocus
          />
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Anthropic API key. Stored in localStorage only.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              border: '1px solid var(--btn-secondary-border)',
              borderRadius: 4,
              background: 'var(--bg-primary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: 4,
              background: 'var(--accent-forward)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.85rem',
              opacity: apiKey.trim() ? 1 : 0.5,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
