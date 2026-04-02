import { useState } from 'react';
import { getClaudeConfig, setClaudeConfig } from '../services/aiService';
import { getGeminiConfig, setGeminiConfig } from '../services/geminiService';

interface ClaudeSettingsProps {
  onClose: () => void;
}

export default function ClaudeSettings({ onClose }: ClaudeSettingsProps) {
  const existingClaude = getClaudeConfig();
  const existingGemini = getGeminiConfig();
  const [claudeKey, setClaudeKey] = useState(existingClaude?.apiKey ?? '');
  const [geminiKey, setGeminiKey] = useState(existingGemini?.apiKey ?? '');

  const handleSave = () => {
    if (claudeKey.trim()) {
      setClaudeConfig({ apiKey: claudeKey.trim() });
    }
    if (geminiKey.trim()) {
      setGeminiConfig({ apiKey: geminiKey.trim() });
    }
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
          width: 420,
          maxWidth: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>AI Settings</h3>

        {/* Claude API Key */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            Claude API Key
          </label>
          <input
            type="password"
            value={claudeKey}
            onChange={(e) => setClaudeKey(e.target.value)}
            placeholder="sk-ant-..."
            style={inputStyle}
          />
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>
            AI 채팅 기능에 사용 (유료). 없으면 채팅 비활성화.
          </div>
        </div>

        {/* Gemini API Key */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            Gemini API Key
          </label>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIzaSy..."
            style={inputStyle}
          />
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>
            깊은 탐색에 사용 (무료).{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent-forward)' }}
            >
              Google AI Studio에서 발급
            </a>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!claudeKey.trim() && !geminiKey.trim()}
            style={{
              ...btnPrimary,
              opacity: (claudeKey.trim() || geminiKey.trim()) ? 1 : 0.5,
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
