import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGitHubConfig, saveToGitHub } from '../services/githubService';
import {
  loadMapsIndex,
  saveMapsIndex,
  hashPin,
  verifyPin,
} from '../services/mapIndexService';
import type { MapMeta, MapsIndex } from '../services/mapIndexService';
import { generateId } from '../utils/idGenerator';
import { useThemeContext } from '../contexts/ThemeContext';
import GitHubSettings from '../components/GitHubSettings';
import SheetsSettings from '../components/SheetsSettings';
import AISettings from '../components/AISettings';
import PinDialog from '../components/PinDialog';
import NewMapDialog from '../components/NewMapDialog';

export default function HomePage() {
  const navigate = useNavigate();
  const { theme, toggle } = useThemeContext();
  const [mapsIndex, setMapsIndex] = useState<MapsIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGitHubSettings, setShowGitHubSettings] = useState(false);
  const [showSheetsSettings, setShowSheetsSettings] = useState(false);
  const [showClaudeSettings, setShowClaudeSettings] = useState(false);
  const [showNewMap, setShowNewMap] = useState(false);
  const [pinTarget, setPinTarget] = useState<MapMeta | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const config = getGitHubConfig();

  const loadIndex = useCallback(async () => {
    const cfg = getGitHubConfig();
    if (!cfg) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const index = await loadMapsIndex(cfg);
      setMapsIndex(index);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  const handleCreateMap = async (name: string, description: string, pin: string) => {
    const cfg = getGitHubConfig();
    if (!cfg) return;
    try {
      const pinH = await hashPin(pin);
      const now = new Date().toISOString();
      const newMap: MapMeta = {
        id: generateId(),
        name,
        description: description || undefined,
        pinHash: pinH,
        createdAt: now,
        updatedAt: now,
        stats: { islands: 0, bridges: 0, papers: 0 },
      };
      const index = mapsIndex ?? { maps: [] };
      index.maps.push(newMap);
      await saveMapsIndex(cfg, index);

      // Save empty map to GitHub
      await saveToGitHub(cfg, { islands: [], bridges: [], roads: [], papers: [], gaps: [] }, newMap.id);

      setMapsIndex({ ...index });
      setShowNewMap(false);
      // Navigate directly (just created, no PIN needed)
      navigate(`/map/${newMap.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handlePinSubmit = async (pin: string) => {
    if (!pinTarget) return;
    const ok = await verifyPin(pin, pinTarget.pinHash);
    if (ok) {
      setPinTarget(null);
      setPinError(null);
      // Store auth in sessionStorage so we don't ask again this session
      sessionStorage.setItem(`pin-ok-${pinTarget.id}`, '1');
      navigate(`/map/${pinTarget.id}`);
    } else {
      setPinError('PIN이 틀렸습니다');
    }
  };

  const handleMapClick = (map: MapMeta) => {
    // Skip PIN if already verified this session
    if (sessionStorage.getItem(`pin-ok-${map.id}`)) {
      navigate(`/map/${map.id}`);
      return;
    }
    setPinTarget(map);
    setPinError(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-map)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '60px 20px',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontSize: '2rem', color: 'var(--text-heading)', margin: '0 0 8px' }}>
          Research Island Map
        </h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.95rem' }}>
          연구 논문을 섬-다리 메타포로 시각화
        </p>
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-secondary)',
          borderRadius: 8,
          padding: '6px 10px',
          cursor: 'pointer',
          fontSize: '1rem',
        }}
        title="테마 전환"
      >
        {theme === 'light' ? '\u{1F319}' : '\u2600\uFE0F'}
      </button>

      {/* GitHub not configured */}
      {!config && (
        <div
          style={{
            background: 'var(--bg-primary)',
            borderRadius: 12,
            padding: '32px 40px',
            textAlign: 'center',
            maxWidth: 400,
            boxShadow: 'var(--shadow-dropdown)',
          }}
        >
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.9rem' }}>
            GitHub 연결이 필요합니다. PAT 토큰을 설정하세요.
          </p>
          <button
            onClick={() => setShowGitHubSettings(true)}
            style={{
              padding: '10px 24px',
              border: 'none',
              borderRadius: 8,
              background: 'var(--accent-forward)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            GitHub 설정
          </button>
        </div>
      )}

      {/* Loading */}
      {config && loading && (
        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>맵 목록 로딩 중...</div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            background: 'var(--bg-status-error)',
            color: 'var(--text-status-error)',
            padding: '10px 16px',
            borderRadius: 8,
            marginBottom: 20,
            fontSize: '0.85rem',
            textAlign: 'center',
          }}
        >
          {error}
          <button
            onClick={() => setShowGitHubSettings(true)}
            style={{
              display: 'block',
              margin: '10px auto 0',
              padding: '6px 16px',
              border: 'none',
              borderRadius: 6,
              background: 'var(--accent-forward)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            GitHub 설정 변경
          </button>
        </div>
      )}

      {/* Map cards */}
      {config && !loading && mapsIndex && (
        <div style={{ width: '100%', maxWidth: 700 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}
          >
            {mapsIndex.maps.map((map) => (
              <div
                key={map.id}
                onClick={() => handleMapClick(map)}
                style={{
                  background: 'var(--bg-primary)',
                  borderRadius: 12,
                  padding: '20px',
                  cursor: 'pointer',
                  border: '1px solid var(--border-secondary)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  boxShadow: 'var(--shadow-dropdown)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = '';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-dropdown)';
                }}
              >
                <h3 style={{ margin: '0 0 6px', fontSize: '1rem', color: 'var(--text-heading)' }}>
                  {map.name}
                </h3>
                {map.description && (
                  <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    {map.description}
                  </p>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {map.stats.islands} islands · {map.stats.bridges} bridges · {map.stats.papers} papers
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  {new Date(map.updatedAt).toLocaleDateString('ko-KR')}
                </div>
              </div>
            ))}

            {/* New map card */}
            <div
              onClick={() => setShowNewMap(true)}
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: 12,
                padding: '20px',
                cursor: 'pointer',
                border: '2px dashed var(--border-secondary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 120,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-forward)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-secondary)';
              }}
            >
              <span style={{ fontSize: '2rem', color: 'var(--text-muted)' }}>+</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                새 맵 만들기
              </span>
            </div>
          </div>

          {/* Settings */}
          <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button
              onClick={() => setShowGitHubSettings(true)}
              style={settingsLink}
            >
              GitHub
            </button>
            <button
              onClick={() => setShowSheetsSettings(true)}
              style={settingsLink}
            >
              Google Sheets
            </button>
            <button
              onClick={() => setShowClaudeSettings(true)}
              style={settingsLink}
            >
              Claude AI
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showGitHubSettings && (
        <GitHubSettings
          onClose={() => {
            setShowGitHubSettings(false);
            loadIndex();
          }}
        />
      )}
      {showSheetsSettings && (
        <SheetsSettings onClose={() => setShowSheetsSettings(false)} />
      )}
      {showClaudeSettings && (
        <AISettings onClose={() => setShowClaudeSettings(false)} />
      )}
      {showNewMap && (
        <NewMapDialog
          onConfirm={handleCreateMap}
          onCancel={() => setShowNewMap(false)}
        />
      )}
      {pinTarget && (
        <PinDialog
          mapName={pinTarget.name}
          onConfirm={handlePinSubmit}
          onCancel={() => { setPinTarget(null); setPinError(null); }}
          error={pinError}
        />
      )}
    </div>
  );
}

const settingsLink: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '0.8rem',
  textDecoration: 'underline',
};
