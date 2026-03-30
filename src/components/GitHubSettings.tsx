import { useState } from 'react';
import { getGitHubConfig, setGitHubConfig } from '../services/githubService';

interface GitHubSettingsProps {
  onClose: () => void;
}

export default function GitHubSettings({ onClose }: GitHubSettingsProps) {
  const existing = getGitHubConfig();
  const [token, setToken] = useState(existing?.token ?? '');
  const [owner, setOwner] = useState(existing?.owner ?? '');
  const [repo, setRepo] = useState(existing?.repo ?? '');

  const handleSave = () => {
    if (!token.trim() || !owner.trim() || !repo.trim()) return;
    setGitHubConfig({ token: token.trim(), owner: owner.trim(), repo: repo.trim() });
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
          padding: '24px',
          borderRadius: 10,
          boxShadow: 'var(--shadow-dropdown)',
          color: 'var(--text-primary)',
          minWidth: 340,
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>GitHub Settings</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={labelStyle}>Personal Access Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={inputStyle}
              placeholder="ghp_..."
            />
          </div>
          <div>
            <label style={labelStyle}>Owner (username)</label>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              style={inputStyle}
              placeholder="your-username"
            />
          </div>
          <div>
            <label style={labelStyle}>Repository</label>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              style={inputStyle}
              placeholder="research-island-map"
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>
            Cancel
          </button>
          <button onClick={handleSave} style={btnPrimary}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: 'var(--text-secondary)',
  marginBottom: 2,
};

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
  padding: '8px 18px',
  background: 'var(--text-heading)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.85rem',
};

const btnSecondary: React.CSSProperties = {
  padding: '8px 18px',
  background: 'var(--bg-primary)',
  border: '1px solid var(--btn-secondary-border)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.85rem',
  color: 'var(--text-primary)',
};
