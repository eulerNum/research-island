import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ResearchMap } from '../services/types';
import { useMapDataContext } from '../contexts/MapDataContext';
import GitHubSettings from './GitHubSettings';
import SheetsSettings from './SheetsSettings';
import ClaudeSettings from './ClaudeSettings';
import { getGitHubConfig } from '../services/githubService';
import { getSheetsConfig, syncToSheets, syncFromSheets, reconcilePapers } from '../services/sheetsService';
import * as mapService from '../services/mapService';

interface SidebarProps {
  data: ResearchMap;
  highlightedPaperId?: string | null;
  onHighlightPaper?: (paperId: string | null) => void;
}

export default function Sidebar({ data, highlightedPaperId, onHighlightPaper }: SidebarProps) {
  const navigate = useNavigate();
  const ctx = useMapDataContext();
  const [showGitHubSettings, setShowGitHubSettings] = useState(false);
  const [showSheetsSettings, setShowSheetsSettings] = useState(false);
  const [showClaudeSettings, setShowClaudeSettings] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIslands, setExpandedIslands] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredPapers = useMemo(() => {
    if (!searchQuery.trim()) return data.papers;
    const q = searchQuery.toLowerCase();
    return data.papers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.authors.some((a) => a.toLowerCase().includes(q)) ||
        (p.journal && p.journal.toLowerCase().includes(q)) ||
        String(p.year).includes(q),
    );
  }, [data.papers, searchQuery]);

  // Island name lookup for bridges
  const islandNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of data.islands) m.set(i.id, i.name);
    return m;
  }, [data.islands]);

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
        borderRight: '1px solid var(--border-secondary)',
        overflowY: 'auto',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <h2 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--text-heading)' }}>
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
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span
                    onClick={(e) => { e.stopPropagation(); toggleExpand(island.id); }}
                    style={{ fontSize: '0.65rem', color: 'var(--text-muted)', width: 12, textAlign: 'center', flexShrink: 0, userSelect: 'none' }}
                  >
                    {island.cities.length > 0 ? (isExpanded ? '\u25BC' : '\u25B6') : '\u00B7'}
                  </span>
                  <span
                    style={{ width: 10, height: 10, borderRadius: '50%', background: island.color ?? '#8ecae6', flexShrink: 0 }}
                  />
                  <span onClick={() => navigate(`/island/${island.id}`)} style={{ flex: 1 }}>
                    {island.name}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{island.cities.length}</span>
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
                          color: 'var(--text-secondary)',
                          borderRadius: 4,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        {city.name}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>
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
        {data.bridges.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {data.bridges.map((bridge) => {
              const srcName = islandNameMap.get(bridge.sourceIslandId) ?? '?';
              const tgtName = islandNameMap.get(bridge.targetIslandId) ?? '?';
              const dirArrow = bridge.direction === 'forward' ? '\u2192' : '\u2190';
              return (
                <li
                  key={bridge.id}
                  onClick={() => navigate(`/?bridge=${bridge.id}`)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    borderRadius: 4,
                    borderLeft: `3px solid ${bridge.color ?? (bridge.direction === 'forward' ? 'var(--accent-forward)' : 'var(--accent-backward)')}`,
                    marginBottom: 2,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{srcName} {dirArrow} {tgtName}</div>
                  <div>{bridge.label || '(no label)'}</div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{bridge.paperIds.length} papers</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 12 }}>
        <h3 style={sectionTitle}>Papers ({data.papers.length})</h3>
        <input
          type="text"
          placeholder="Search papers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '5px 8px',
            border: '1px solid var(--border-input)',
            borderRadius: 4,
            fontSize: '0.8rem',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            marginBottom: 6,
            boxSizing: 'border-box',
          }}
        />
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {filteredPapers.map((paper) => (
            <li
              key={paper.id}
              onClick={() => onHighlightPaper?.(highlightedPaperId === paper.id ? null : paper.id)}
              style={{
                padding: '3px 6px',
                fontSize: '0.8rem',
                color: highlightedPaperId === paper.id ? 'var(--text-heading)' : 'var(--text-secondary)',
                background: highlightedPaperId === paper.id ? 'var(--bg-hover)' : 'transparent',
                borderRadius: 4,
                cursor: onHighlightPaper ? 'pointer' : 'default',
                fontWeight: highlightedPaperId === paper.id ? 600 : 400,
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ flex: 1 }}>{paper.title} ({paper.year})</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`"${paper.title}" 논문을 삭제할까요?`)) {
                    ctx.deletePaper(paper.id);
                  }
                }}
                title="논문 삭제"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  padding: '0 2px',
                  flexShrink: 0,
                  opacity: 0.5,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = '#dc3545'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              >
                &#x2715;
              </button>
            </li>
          ))}
          {searchQuery && filteredPapers.length === 0 && (
            <li style={{ padding: '4px 6px', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No matching papers
            </li>
          )}
        </ul>
      </section>

      <section style={{ marginTop: 12 }}>
        <h3 style={sectionTitle}>Research Gaps ({data.gaps.length})</h3>
        {data.gaps.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {data.gaps.map((gap) => (
              <li
                key={gap.id}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-gap)',
                  borderRadius: 4,
                  borderLeft: '3px solid var(--border-gap)',
                  marginBottom: 3,
                }}
              >
                {gap.description.length > 60 ? gap.description.slice(0, 58) + '...' : gap.description}
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {gap.source} · {gap.relatedPaperIds.length} papers
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* JSON backup */}
      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-secondary)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Local Backup</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => {
              const json = JSON.stringify(data, null, 2);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `research-map-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={syncBtn}
          >
            Export JSON
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={syncBtn}
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const imported = JSON.parse(reader.result as string);
                  if (imported.islands && imported.papers) {
                    if (confirm('현재 맵 데이터를 가져온 데이터로 교체합니다. 계속할까요?')) {
                      ctx.importMap(imported);
                      showStatus('success', 'Imported!');
                    }
                  } else {
                    showStatus('error', 'Invalid map JSON');
                  }
                } catch {
                  showStatus('error', 'JSON parse error');
                }
              };
              reader.readAsText(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* GitHub sync */}
      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-secondary)' }}>
        {status && (
          <div
            style={{
              padding: '6px 8px',
              marginBottom: 8,
              borderRadius: 4,
              fontSize: '0.8rem',
              background: status.type === 'success' ? 'var(--bg-status-success)' : 'var(--bg-status-error)',
              color: status.type === 'success' ? 'var(--text-status-success)' : 'var(--text-status-error)',
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
      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-secondary)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Google Sheets</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleSheetsPush} disabled={loading} style={syncBtn}>Push</button>
          <button onClick={handleSheetsPull} disabled={loading} style={syncBtn}>Pull</button>
          <button onClick={() => setShowSheetsSettings(true)} style={syncBtn} title="Sheets Settings">
            Settings
          </button>
        </div>
      </div>

      {/* Claude AI */}
      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-secondary)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Claude AI</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowClaudeSettings(true)} style={syncBtn}>
            API Settings
          </button>
        </div>
      </div>

      {showGitHubSettings && (
        <GitHubSettings onClose={() => setShowGitHubSettings(false)} />
      )}
      {showSheetsSettings && (
        <SheetsSettings onClose={() => setShowSheetsSettings(false)} />
      )}
      {showClaudeSettings && (
        <ClaudeSettings onClose={() => setShowClaudeSettings(false)} />
      )}
    </aside>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-tertiary)',
  fontWeight: 600,
  marginBottom: 4,
};

const syncBtn: React.CSSProperties = {
  flex: 1,
  padding: '6px 0',
  border: '1px solid var(--btn-secondary-border)',
  borderRadius: 4,
  background: 'var(--btn-secondary-bg)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: '0.75rem',
};
