import { useState } from 'react';
import { getSheetsConfig, setSheetsConfig } from '../services/sheetsService';

interface SheetsSettingsProps {
  onClose: () => void;
}

export default function SheetsSettings({ onClose }: SheetsSettingsProps) {
  const existing = getSheetsConfig();
  const [pushUrl, setPushUrl] = useState(existing?.pushUrl ?? '');
  const [pullUrl, setPullUrl] = useState(existing?.pullUrl ?? '');

  const handleSave = () => {
    setSheetsConfig({ pushUrl: pushUrl.trim(), pullUrl: pullUrl.trim() });
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
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)',
          padding: '20px 24px',
          borderRadius: 10,
          boxShadow: 'var(--shadow-dropdown)',
          color: 'var(--text-primary)',
          minWidth: 360,
        }}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Google Sheets (n8n)</h3>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
            Push Webhook URL
          </label>
          <input
            value={pushUrl}
            onChange={(e) => setPushUrl(e.target.value)}
            placeholder="https://n8n.example.com/webhook/push"
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
            Pull Webhook URL
          </label>
          <input
            value={pullUrl}
            onChange={(e) => setPullUrl(e.target.value)}
            placeholder="https://n8n.example.com/webhook/pull"
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} style={btnPrimary}>Save</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border-input)',
  borderRadius: 6,
  fontSize: '0.85rem',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
};

const btnPrimary: React.CSSProperties = {
  padding: '6px 16px',
  border: 'none',
  borderRadius: 6,
  background: 'var(--text-heading)',
  color: '#fff',
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '6px 16px',
  border: '1px solid var(--btn-secondary-border)',
  borderRadius: 6,
  background: 'var(--bg-primary)',
  cursor: 'pointer',
  color: 'var(--text-primary)',
};
