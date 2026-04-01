import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ResearchMap } from '../services/types';
import { useMapDataContext } from '../contexts/MapDataContext';
import GitHubSettings from './GitHubSettings';
import { getGitHubConfig } from '../services/githubService';

interface SidebarProps {
  data: ResearchMap;
  highlightedPaperId?: string | null;
  onHighlightPaper?: (paperId: string | null) => void;
  onSelectPaper?: (paperId: string) => void;
  onGapAnimate?: (gapId: string, description: string, sourceRect: DOMRect) => void;
}

export default function Sidebar({ data, highlightedPaperId, onHighlightPaper, onSelectPaper, onGapAnimate }: SidebarProps) {
  const navigate = useNavigate();
  const { mapId } = useParams<{ mapId: string }>();
  const basePath = mapId ? `/map/${mapId}` : '';
  const ctx = useMapDataContext();
  const [showGitHubSettings, setShowGitHubSettings] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIslands, setExpandedIslands] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'none' | 'year' | 'journal'>('year');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(true);
  const [pinned, setPinned] = useState(false);
  const collapseTimer = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (collapseTimer.current) { clearTimeout(collapseTimer.current); collapseTimer.current = null; }
    setCollapsed(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (pinned) return;
    collapseTimer.current = window.setTimeout(() => setCollapsed(true), 200);
  }, [pinned]);

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

  const groupedPapers = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups = new Map<string, typeof filteredPapers>();
    for (const p of filteredPapers) {
      const key = groupBy === 'year' ? String(p.year) : (p.journal || 'Unknown');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    // Sort: year descending, journal alphabetical
    const entries = Array.from(groups.entries());
    if (groupBy === 'year') {
      entries.sort((a, b) => Number(b[0]) - Number(a[0]));
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    }
    return entries;
  }, [filteredPapers, groupBy]);

  const yearDistribution = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of data.papers) {
      counts.set(p.year, (counts.get(p.year) || 0) + 1);
    }
    const entries = Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
    const max = Math.max(...entries.map(([, c]) => c), 1);
    return { entries, max };
  }, [data.papers]);

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  const isExpanded = !collapsed;

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: isExpanded ? 260 : 48,
        padding: isExpanded ? '14px' : '14px 6px',
        borderRight: '1px solid var(--border-secondary)',
        overflowY: isExpanded ? 'auto' : 'hidden',
        overflowX: 'hidden',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: 'width 0.2s ease, padding 0.2s ease',
        whiteSpace: isExpanded ? 'normal' : 'nowrap',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 24 }}>
        <button
          onClick={() => navigate('/')}
          title="홈으로"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            color: 'var(--text-muted)',
            padding: 0,
            flexShrink: 0,
          }}
        >
          &larr;
        </button>
        {isExpanded && (
          <>
            <h2 style={{ fontSize: '1rem', margin: 0, color: 'var(--text-heading)', flex: 1 }}>
              Research Island Map
            </h2>
            <button
              onClick={() => setPinned((p) => !p)}
              title={pinned ? '사이드바 자동 접기' : '사이드바 고정'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: pinned ? 'var(--accent-forward)' : 'var(--text-muted)',
                padding: 0,
                flexShrink: 0,
              }}
            >
              {pinned ? '\u{1F4CC}' : '\u{1F4CC}'}
            </button>
          </>
        )}
      </div>

      {/* Save/Load — 최상단 */}
      <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-secondary)' }}>
        {isExpanded && ctx.lastSyncError && (
          <div
            style={{
              padding: '6px 8px',
              marginBottom: 6,
              borderRadius: 4,
              fontSize: '0.75rem',
              background: '#fff3cd',
              color: '#856404',
              border: '1px solid #ffc107',
            }}
          >
            {ctx.lastSyncError}
            <button
              onClick={handleLoad}
              style={{
                display: 'block',
                marginTop: 4,
                padding: '3px 8px',
                border: '1px solid #856404',
                borderRadius: 3,
                background: 'transparent',
                color: '#856404',
                cursor: 'pointer',
                fontSize: '0.7rem',
              }}
            >
              Load로 최신 데이터 가져오기
            </button>
          </div>
        )}
        {isExpanded && status && (
          <div
            style={{
              padding: '6px 8px',
              marginBottom: 6,
              borderRadius: 4,
              fontSize: '0.8rem',
              background: status.type === 'success' ? 'var(--bg-status-success)' : 'var(--bg-status-error)',
              color: status.type === 'success' ? 'var(--text-status-success)' : 'var(--text-status-error)',
            }}
          >
            {status.msg}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: isExpanded ? 'row' : 'column', gap: 6 }}>
          <button onClick={handleSave} disabled={loading} style={isExpanded ? syncBtn : iconBtn} title="Save">
            {isExpanded ? (loading ? '...' : 'Save') : '\u{1F4BE}'}
          </button>
          <button onClick={handleLoad} disabled={loading} style={isExpanded ? syncBtn : iconBtn} title="Load">
            {isExpanded ? (loading ? '...' : 'Load') : '\u{1F4E5}'}
          </button>
        </div>
      </div>

      {/* 맵 요약 숫자 */}
      {isExpanded ? (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span>섬 {data.islands.length}</span>
          <span>다리 {data.bridges.length}</span>
          <span>논문 {data.papers.length}</span>
          <span>갭 {data.gaps.length}</span>
        </div>
      ) : (
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center', lineHeight: 1.6 }}>
          <div>{data.islands.length}</div>
          <div>{data.papers.length}</div>
        </div>
      )}

      {/* Collapsed icons for sections */}
      {!isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', fontSize: '1rem' }}>
          <span title={`Islands (${data.islands.length})`} style={{ cursor: 'default', opacity: 0.6 }}>{'\u{1F3DD}'}</span>
          <span title={`Papers (${data.papers.length})`} style={{ cursor: 'default', opacity: 0.6 }}>{'\u{1F4C4}'}</span>
          <span title={`Gaps (${data.gaps.length})`} style={{ cursor: 'default', opacity: 0.6 }}>{'\u26A0'}</span>
        </div>
      )}

      {/* Islands */}
      {isExpanded && <section>
        <h3 style={sectionTitle}>Islands ({data.islands.length})</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.islands.map((island) => {
            const isIslandExpanded = expandedIslands.has(island.id);
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
                    {island.cities.length > 0 ? (isIslandExpanded ? '\u25BC' : '\u25B6') : '\u00B7'}
                  </span>
                  <span
                    style={{ width: 10, height: 10, borderRadius: '50%', background: island.color ?? '#8ecae6', flexShrink: 0 }}
                  />
                  <span onClick={() => navigate(`${basePath}/island/${island.id}`)} style={{ flex: 1 }}>
                    {island.name}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{island.cities.length}</span>
                </div>
                {isIslandExpanded && island.cities.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {island.cities.map((city) => (
                      <li
                        key={city.id}
                        onClick={() => navigate(`${basePath}/island/${island.id}`)}
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
      </section>}

      {/* Papers */}
      {isExpanded && <section style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <h3 style={{ ...sectionTitle, marginBottom: 0, flex: 1 }}>Papers ({data.papers.length})</h3>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'none' | 'year' | 'journal')}
            style={{
              fontSize: '0.65rem',
              padding: '1px 4px',
              border: '1px solid var(--border-input)',
              borderRadius: 3,
              background: 'var(--bg-input)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <option value="year">연도별</option>
            <option value="journal">저널별</option>
            <option value="none">전체</option>
          </select>
        </div>

        {/* Year distribution mini bar chart */}
        {data.papers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24, marginBottom: 6 }}>
            {yearDistribution.entries.map(([year, count]) => (
              <div key={year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 20,
                    height: Math.max(3, (count / yearDistribution.max) * 20),
                    background: 'var(--accent-forward)',
                    borderRadius: '2px 2px 0 0',
                    opacity: 0.7,
                  }}
                  title={`${year}: ${count}편`}
                />
                <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)', lineHeight: 1 }}>
                  {String(year).slice(-2)}
                </span>
              </div>
            ))}
          </div>
        )}

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

        {/* Grouped or flat paper list */}
        {groupedPapers ? (
          groupedPapers.map(([groupKey, papers]) => {
            const isGroupCollapsed = collapsedGroups.has(groupKey);
            return (
              <div key={groupKey} style={{ marginBottom: 4 }}>
                <div
                  onClick={() => toggleGroupCollapse(groupKey)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    borderRadius: 3,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: '0.6rem', width: 10 }}>{isGroupCollapsed ? '\u25B6' : '\u25BC'}</span>
                  <span style={{ flex: 1 }}>{groupKey}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 400 }}>{papers.length}</span>
                </div>
                {!isGroupCollapsed && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {papers.map((paper) => (
                      <PaperItem
                        key={paper.id}
                        paper={paper}
                        highlightedPaperId={highlightedPaperId}
                        onHighlightPaper={onHighlightPaper}
                        onSelectPaper={onSelectPaper}
                        onDelete={() => ctx.deletePaper(paper.id)}
                        showYear={groupBy !== 'year'}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {filteredPapers.map((paper) => (
              <PaperItem
                key={paper.id}
                paper={paper}
                highlightedPaperId={highlightedPaperId}
                onHighlightPaper={onHighlightPaper}
                onSelectPaper={onSelectPaper}
                onDelete={() => ctx.deletePaper(paper.id)}
                showYear
              />
            ))}
          </ul>
        )}
        {searchQuery && filteredPapers.length === 0 && (
          <div style={{ padding: '4px 6px', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No matching papers
          </div>
        )}
      </section>}

      {/* Research Gaps */}
      {isExpanded && <section style={{ marginTop: 12 }}>
        <h3 style={sectionTitle}>Research Gaps ({data.gaps.length})</h3>
        {data.gaps.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {data.gaps.map((gap) => (
              <li
                key={gap.id}
                onClick={(e) => {
                  if (onGapAnimate) {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    onGapAnimate(gap.id, gap.description, rect);
                  }
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-gap)',
                  borderRadius: 4,
                  borderLeft: '3px solid var(--border-gap)',
                  marginBottom: 3,
                  cursor: onGapAnimate ? 'pointer' : 'default',
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
      </section>}

      {/* Local Backup */}
      {isExpanded && <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-secondary)' }}>
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
      </div>}

      {showGitHubSettings && (
        <GitHubSettings onClose={() => setShowGitHubSettings(false)} />
      )}
    </aside>
  );
}

/* Extracted paper list item — 3 separate interactions:
   1. Highlight icon (bulb) click → glow on map
   2. Title click → open in DetailPanel
   3. Drag → drop on bridge/road */
function PaperItem({ paper, highlightedPaperId, onHighlightPaper, onSelectPaper, onDelete, showYear }: {
  paper: { id: string; title: string; year: number };
  highlightedPaperId?: string | null;
  onHighlightPaper?: (paperId: string | null) => void;
  onSelectPaper?: (paperId: string) => void;
  onDelete: () => void;
  showYear: boolean;
}) {
  const isHighlighted = highlightedPaperId === paper.id;
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/paper-id', paper.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      style={{
        padding: '3px 6px',
        fontSize: '0.8rem',
        color: isHighlighted ? 'var(--text-heading)' : 'var(--text-secondary)',
        background: isHighlighted ? 'var(--bg-hover)' : 'transparent',
        borderRadius: 4,
        cursor: 'grab',
        fontWeight: isHighlighted ? 600 : 400,
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {/* Highlight toggle button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onHighlightPaper?.(isHighlighted ? null : paper.id);
        }}
        title="맵에서 하이라이트"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.75rem',
          padding: 0,
          flexShrink: 0,
          opacity: isHighlighted ? 1 : 0.4,
          filter: isHighlighted ? 'none' : 'grayscale(1)',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={(e) => { if (!isHighlighted) (e.currentTarget as HTMLElement).style.opacity = '0.4'; }}
      >
        {isHighlighted ? '\u{1F4A1}' : '\u{1F4A1}'}
      </button>
      {/* Title — click to open in DetailPanel */}
      <span
        onClick={() => onSelectPaper?.(paper.id)}
        style={{ flex: 1, cursor: 'pointer' }}
      >
        {paper.title}{showYear ? ` (${paper.year})` : ''}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`"${paper.title}" 논문을 삭제할까요?`)) onDelete();
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
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-tertiary)',
  fontWeight: 600,
  marginBottom: 4,
};

const iconBtn: React.CSSProperties = {
  width: 36,
  height: 30,
  border: '1px solid var(--btn-secondary-border)',
  borderRadius: 4,
  background: 'var(--btn-secondary-bg)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: '0.9rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
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
