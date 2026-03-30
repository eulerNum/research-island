import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ResearchMap } from '../services/types';
import { useMapDataContext } from '../contexts/MapDataContext';
import GitHubSettings from './GitHubSettings';
import SheetsSettings from './SheetsSettings';
import { getGitHubConfig } from '../services/githubService';
import { getSheetsConfig, syncToSheets, syncFromSheets, reconcilePapers } from '../services/sheetsService';
import * as mapService from '../services/mapService';

interface SidebarProps {
  data: ResearchMap;
}

export default function Sidebar({ data }: SidebarProps) {
  const navigate = useNavigate();
  const ctx = useMapDataContext();
  const [showGitHubSettings, setShowGitHubSettings] = useState(false);
  const [showSheetsSettings, setShowSheetsSettings] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIslands, setExpandedIslands] = useState<Set<string>>(new Set());

  const toggleExpand = (islandId: string) => {
    setExpandedIslands((prev) => {
      const next = new Set(prev);
      if (next.has(islandId)) next.delete(islandId);
      else next.add(islandId);
      return next;
    });
  };

  const showStatus = (type: 'success' | 'error', msg: string) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleSave = async () => {
    if (!getGitHubConfig()) {
      setShowGitHubSettings(true);
      return;
    }
    setLoading(true);
    try {
      await ctx.saveToGitHub();
      showStatus('success', 'Saved!');
    } catch (e) {
      showStatus('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async () => {
    if (!getGitHubConfig()) {
      setShowGitHubSettings(true);
      return;
    }
    setLoading(true);
    try {
      await ctx.loadFromGitHub();
      showStatus('success', 'Loaded!');
    } catch (e) {
      showStatus('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSheetsPush = async () => {
    const config = getSheetsConfig();
    if (!config?.pushUrl) {
      setShowSheetsSettings(true);
      return;
    }
    setLoading(true);
    try {
      await syncToSheets(config.pushUrl, data.papers);
      showStatus('success', 'Pushed to Sheets!');
    } catch (e) {
      showStatus('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSheetsPull = async () => {
    const config = getSheetsConfig();
    if (!config?.pullUrl) {
      setShowSheetsSettings(true);
      return;
    }
    setLoading(true);
    try {
      const remote = await syncFromSheets(config.pullUrl);
      const merged = reconcilePapers(data.papers, remote);
      const fullMap = mapService.getFullMap();
      fullMap.papers = merged;
      ctx.importMap(fullMap);
      showStatus('success', `Pulled! ${merged.length - data.papers.length} new papers`);
    } catch (e) {
      showStatus('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside
      style={{
        width: 260,
        padding: '14px',
        borderRight: '1px solid #ddd',
        overflowY: 'auto',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <h2 style={{ fontSize: '1rem', marginBottom: '12px', color: '#023047' }}>
        Research Island Map
      </h2>

      <section>
        <h3 style={sectionTitle}>Islands ({data.islands.length})</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.islands.map((island) => {
            const isExpanded = expandedIslands.has(island.id);
            return (
              <li key={island.id}>
                <div
                  style={{
                    padding: '5px 8px',
                    cursor: 'pointer',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.85rem',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f0f4f8'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span
                    onClick={(e) => { e.stopPropagation(); toggleExpand(island.id); }}
                    style={{ fontSize: '0.65rem', color: '#999', width: 12, textAlign: 'center', flexShrink: 0, userSelect: 'none' }}
                  >
                    {island.cities.length > 0 ? (isExpanded ? '\u25BC' : '\u25B6') : '\u00B7'}
                  </span>
                  <span
                    style={{ width: 10, height: 10, borderRadius: '50%', background: island.color ?? '#8ecae6', flexShrink: 0 }}
                  />
                  <span onClick={() => navigate(`/island/${island.id}`)} style={{ flex: 1 }}>
                    {island.name}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#aaa' }}>{island.cities.length}</span>
                </div>
                {isExpanded && island.cities.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {island.cities.map((city) => (
                      <li
                        key={city.id}
                        onClick={() => navigate(`/island/${island.id}`)}
                        style={{
                          padding: '3px 8px 3px 36px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          color: '#666',
                          borderRadius: 4,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8f9fa'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        {city.name}
                        <span style={{ fontSize: '0.7rem', color: '#bbb', marginLeft: 6 }}>
                          {city.paperIds.length} papers
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section style={{ marginTop: 12 }}>
        <h3 style={sectionTitle}>Bridges ({data.bridges.length})</h3>
      </section>

      <section style={{ marginTop: 12 }}>
        <h3 style={sectionTitle}>Papers ({data.papers.length})</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {data.papers.map((paper) => (
            <li key={paper.id} style={{ padding: '3px 0', fontSize: '0.8rem', color: '#555' }}>
              {paper.title} ({paper.year})
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 12 }}>
        <h3 style={sectionTitle}>Research Gaps ({data.gaps.length})</h3>
      </section>

      {/* GitHub sync */}
      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #eee' }}>
        {status && (
          <div
            style={{
              padding: '6px 8px',
              marginBottom: 8,
              borderRadius: 4,
              fontSize: '0.8rem',
              background: status.type === 'success' ? '#d4edda' : '#f8d7da',
              color: status.type === 'success' ? '#155724' : '#721c24',
            }}
          >
            {status.msg}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleSave} disabled={loading} style={syncBtn}>
            {loading ? '...' : 'Save'}
          </button>
          <button onClick={handleLoad} disabled={loading} style={syncBtn}>
            {loading ? '...' : 'Load'}
          </button>
          <button onClick={() => setShowGitHubSettings(true)} style={syncBtn} title="GitHub Settings">
            Settings
          </button>
        </div>
      </div>

      {/* Sheets sync */}
      <div style={{ paddingTop: 8, borderTop: '1px solid #eee' }}>
        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 4 }}>Google Sheets</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleSheetsPush} disabled={loading} style={syncBtn}>Push</button>
          <button onClick={handleSheetsPull} disabled={loading} style={syncBtn}>Pull</button>
          <button onClick={() => setShowSheetsSettings(true)} style={syncBtn} title="Sheets Settings">
            Settings
          </button>
        </div>
      </div>

      {showGitHubSettings && (
        <GitHubSettings onClose={() => setShowGitHubSettings(false)} />
      )}
      {showSheetsSettings && (
        <SheetsSettings onClose={() => setShowSheetsSettings(false)} />
      )}
    </aside>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#888',
  fontWeight: 600,
  marginBottom: 4,
};

const syncBtn: React.CSSProperties = {
  flex: 1,
  padding: '6px 0',
  border: '1px solid #ccc',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
  fontSize: '0.75rem',
};
