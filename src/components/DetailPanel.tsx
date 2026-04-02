import { useState, useMemo, useCallback, useRef } from 'react';
import type { Bridge, Road, Paper, ResearchGap } from '../services/types';
import { getClaudeConfig, suggestPapers } from '../services/aiService';
import type { AISuggestion } from '../services/aiService';
import { getGitHubConfig } from '../services/githubService';
import { uploadFigure } from '../services/figureService';
import { generateId } from '../utils/idGenerator';
import GapMemo from './GapMemo';
import PaperForm from './PaperForm';
import FigureLightbox from './FigureLightbox';
import ClaudeSettings from './ClaudeSettings';
import AIChatPanel from './AIChatPanel';

interface CrossRef {
  type: 'bridge' | 'road';
  id: string;
  label: string;
  direction: 'forward' | 'backward';
  islandId?: string; // for roads — which island to navigate to
}

interface DetailPanelProps {
  bridge?: Bridge;
  road?: Road;
  papers: Paper[];
  gaps: ResearchGap[];
  allBridges: Bridge[];
  allRoads: Road[];
  allIslandCityMap?: Map<string, string>; // cityId → islandId lookup
  islandNameMap?: Map<string, string>; // islandId → name lookup
  cityNameMap?: Map<string, string>; // cityId → name lookup
  highlightedPaperId?: string | null;
  sourceLabel?: string; // source island/city name for AI prompt
  targetLabel?: string; // target island/city name for AI prompt
  onAddPaper: (paper: Paper) => void;
  onAddPaperWithId?: (paper: Paper) => string; // returns actual (deduped) paper ID
  onUpdatePaper?: (paper: Paper) => void;
  onAddGap: (gap: ResearchGap) => void;
  onDeleteGap: (gapId: string) => void;
  onRemovePaper?: (paperId: string) => void;
  onDeletePaper?: (paperId: string) => void;
  onHighlightPaper?: (paperId: string | null) => void;
  onNavigateToBridge?: (bridgeId: string) => void;
  onNavigateToRoad?: (roadId: string, islandId: string) => void;
  onAddPaperToBridge?: (paperId: string, bridgeId: string) => void;
  onAddPaperToRoad?: (paperId: string, roadId: string) => void;
  onClose: () => void;
}

export default function DetailPanel({
  bridge,
  road,
  papers,
  gaps,
  allBridges,
  allRoads,
  allIslandCityMap,
  highlightedPaperId,
  islandNameMap,
  cityNameMap,
  sourceLabel,
  targetLabel,
  onAddPaper,
  onAddPaperWithId,
  onUpdatePaper,
  onAddGap,
  onDeleteGap,
  onRemovePaper,
  onDeletePaper,
  onHighlightPaper,
  onNavigateToBridge,
  onNavigateToRoad,
  onAddPaperToBridge,
  onAddPaperToRoad,
  onClose,
}: DetailPanelProps) {
  const [showPaperForm, setShowPaperForm] = useState(false);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [pinnedPaperId, setPinnedPaperId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showClaudeSettings, setShowClaudeSettings] = useState(false);
  const [panelWidth, setPanelWidth] = useState(420);
  const [chatExpanded, setChatExpanded] = useState(false);
  const resizingRef = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startX - ev.clientX;
      setPanelWidth(Math.max(360, Math.min(800, startWidth + delta)));
    };
    const onUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  const entity = bridge ?? road;
  const paperIds = entity?.paperIds ?? [];
  const linkedPapers = papers.filter((p) => paperIds.includes(p.id));

  const crossRefMap = useMemo(() => {
    const map = new Map<string, CrossRef[]>();
    for (const paper of linkedPapers) {
      const refs: CrossRef[] = [];
      for (const b of allBridges) {
        if (b.id !== bridge?.id && b.paperIds.includes(paper.id)) {
          const src = islandNameMap?.get(b.sourceIslandId) ?? '?';
          const tgt = islandNameMap?.get(b.targetIslandId) ?? '?';
          const contextLabel = b.label ? `${src}→${tgt}: ${b.label}` : `${src}→${tgt}`;
          refs.push({ type: 'bridge', id: b.id, label: contextLabel, direction: b.direction });
        }
      }
      for (const r of allRoads) {
        if (r.id !== road?.id && r.paperIds.includes(paper.id)) {
          const islandId = allIslandCityMap?.get(r.sourceCityId) ?? allIslandCityMap?.get(r.targetCityId);
          const src = cityNameMap?.get(r.sourceCityId) ?? '?';
          const tgt = cityNameMap?.get(r.targetCityId) ?? '?';
          const contextLabel = r.label ? `${src}→${tgt}: ${r.label}` : `${src}→${tgt}`;
          refs.push({ type: 'road', id: r.id, label: contextLabel, direction: r.direction, islandId });
        }
      }
      if (refs.length > 0) map.set(paper.id, refs);
    }
    return map;
  }, [linkedPapers, allBridges, allRoads, allIslandCityMap, islandNameMap, cityNameMap, bridge, road]);

  // Build bridge/road label lists for AI chat context
  const chatBridgeList = useMemo(() =>
    allBridges.map((b) => ({
      id: b.id,
      sourceLabel: islandNameMap?.get(b.sourceIslandId) ?? '?',
      targetLabel: islandNameMap?.get(b.targetIslandId) ?? '?',
      label: b.label ?? '',
    })),
  [allBridges, islandNameMap]);

  const chatRoadList = useMemo(() =>
    allRoads.map((r) => ({
      id: r.id,
      sourceLabel: cityNameMap?.get(r.sourceCityId) ?? '?',
      targetLabel: cityNameMap?.get(r.targetCityId) ?? '?',
      label: r.label ?? '',
    })),
  [allRoads, cityNameMap]);

  if (!entity) return null;

  const gapIds = entity.gapIds;
  const dirColor = entity.color ?? (entity.direction === 'forward' ? 'var(--accent-forward)' : 'var(--accent-backward)');

  // Build full display name: "Source→Target: label"
  let entityDisplayName: string;
  if (bridge) {
    const src = islandNameMap?.get(bridge.sourceIslandId) ?? '?';
    const tgt = islandNameMap?.get(bridge.targetIslandId) ?? '?';
    entityDisplayName = bridge.label ? `${src}→${tgt}: ${bridge.label}` : `${src}→${tgt}`;
  } else if (road) {
    const src = cityNameMap?.get(road.sourceCityId) ?? '?';
    const tgt = cityNameMap?.get(road.targetCityId) ?? '?';
    entityDisplayName = road.label ? `${src}→${tgt}: ${road.label}` : `${src}→${tgt}`;
  } else {
    entityDisplayName = entity.label || 'Untitled';
  }

  return (
    <aside
      style={{
        width: panelWidth,
        borderLeft: '1px solid var(--border-secondary)',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          cursor: 'col-resize',
          zIndex: 10,
          background: 'transparent',
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--accent-forward)'; }}
        onMouseLeave={(e) => { if (!resizingRef.current) (e.target as HTMLElement).style.background = 'transparent'; }}
      />

      {/* Header */}
      <div style={{ padding: '16px 16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1rem', margin: 0 }}>
          <span style={{ color: dirColor }}>{entity.direction === 'forward' ? '\u2192' : '\u2190'}</span>{' '}
          {entityDisplayName}
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.2rem',
            cursor: 'pointer',
            color: 'var(--text-muted)',
          }}
        >
          &times;
        </button>
      </div>
      </div>

      {/* AI Chat Panel — top of sidebar */}
      {onAddPaperWithId && onAddPaperToBridge && onAddPaperToRoad && onUpdatePaper && (
        <AIChatPanel
          entity={entity}
          entityType={bridge ? 'bridge' : 'road'}
          sourceLabel={sourceLabel ?? 'Source'}
          targetLabel={targetLabel ?? 'Target'}
          existingPapers={linkedPapers}
          gaps={gaps.filter((g) => gapIds.includes(g.id))}
          allBridges={chatBridgeList}
          allRoads={chatRoadList}
          onAddPaper={onAddPaperWithId}
          onAddPaperToBridge={onAddPaperToBridge}
          onAddPaperToRoad={onAddPaperToRoad}
          onUpdatePaper={onUpdatePaper}
          onShowClaudeSettings={() => setShowClaudeSettings(true)}
          onExpandChange={setChatExpanded}
        />
      )}

      {/* Scrollable content area — papers, gaps, suggestions */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 16px 16px',
        display: chatExpanded ? 'none' : 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>

      {/* Gap Memos */}
      <GapMemo gaps={gaps} gapIds={gapIds} onAddGap={onAddGap} onDeleteGap={onDeleteGap} />

      {/* Papers */}
      <div>
        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
          Papers ({linkedPapers.length})
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {linkedPapers.map((paper) => {
            const crossRefs = crossRefMap.get(paper.id) ?? [];
            const isPinned = pinnedPaperId === paper.id;
            const isHighlighted = highlightedPaperId === paper.id;
            return (
              <div
                key={paper.id}
                style={{
                  padding: '8px 10px',
                  background: isHighlighted ? 'var(--bg-highlight)' : 'var(--bg-paper)',
                  borderRadius: 6,
                  border: `1px solid ${isHighlighted ? 'var(--accent-highlight)' : 'var(--border-paper)'}`,
                  borderLeft: isHighlighted ? '3px solid var(--accent-highlight)' : `1px solid var(--border-paper)`,
                  fontSize: '0.85rem',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={() => { if (!pinnedPaperId) onHighlightPaper?.(paper.id); }}
                onMouseLeave={() => { if (!pinnedPaperId) onHighlightPaper?.(null); }}
              >
                <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ flex: 1 }}>
                    {paper.title}{' '}
                    <span style={{ fontWeight: 'normal', color: 'var(--text-tertiary)' }}>({paper.year})</span>
                  </span>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isPinned) {
                          setPinnedPaperId(null);
                          onHighlightPaper?.(null);
                        } else {
                          setPinnedPaperId(paper.id);
                          onHighlightPaper?.(paper.id);
                        }
                      }}
                      title={isPinned ? '하이라이트 해제' : '하이라이트 고정'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        color: isPinned ? 'var(--accent-highlight)' : 'var(--text-muted)',
                        padding: '0 2px',
                      }}
                    >
                      {isPinned ? '\u2605' : '\u2606'}
                    </button>
                    {onUpdatePaper && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPaper(paper);
                          setShowPaperForm(false);
                        }}
                        title="논문 편집"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          color: 'var(--text-tertiary)',
                          padding: '0 2px',
                        }}
                      >
                        &#x270E;
                      </button>
                    )}
                    {onRemovePaper && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemovePaper(paper.id);
                        }}
                        title="이 다리/도로에서 연결 해제"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          padding: '0 2px',
                        }}
                      >
                        &#x2715;
                      </button>
                    )}
                    {onDeletePaper && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`"${paper.title}" 논문을 맵 전체에서 삭제할까요?`)) {
                            onDeletePaper(paper.id);
                          }
                        }}
                        title="맵 전체에서 논문 삭제"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          color: '#dc3545',
                          padding: '0 2px',
                        }}
                      >
                        &#x1F5D1;
                      </button>
                    )}
                  </div>
                </div>
                {paper.authors.length > 0 && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 2 }}>
                    {paper.authors.join(', ')}
                  </div>
                )}
                {paper.journal && (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: 2, fontStyle: 'italic' }}>
                    {paper.journal}
                  </div>
                )}
                {paper.abstract && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 4 }}>
                    {paper.abstract.slice(0, 120)}
                    {paper.abstract.length > 120 ? '...' : ''}
                  </div>
                )}
                {paper.comment && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 4, fontStyle: 'italic', borderLeft: '2px solid var(--accent-forward)', paddingLeft: 6 }}>
                    {paper.comment}
                  </div>
                )}
                {/* Figure thumbnails + add button */}
                <div
                  style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}
                  onPaste={(e) => {
                    const items = e.clipboardData.items;
                    const imageFiles: File[] = [];
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.startsWith('image/')) {
                        const f = items[i].getAsFile();
                        if (f) imageFiles.push(f);
                      }
                    }
                    if (imageFiles.length > 0 && onUpdatePaper) {
                      e.preventDefault();
                      const ghConfig = getGitHubConfig();
                      const existingCount = (paper.figureUrls ?? []).length;
                      if (ghConfig) {
                        Promise.all(imageFiles.map((f, fi) =>
                          uploadFigure(ghConfig, paper.id, f, existingCount + fi),
                        )).then((newUrls) => {
                          onUpdatePaper({ ...paper, figureUrls: [...(paper.figureUrls ?? []), ...newUrls] });
                        });
                      } else {
                        Promise.all(imageFiles.map((f) => {
                          return new Promise<string>((res, rej) => {
                            const reader = new FileReader();
                            reader.onload = () => res(reader.result as string);
                            reader.onerror = rej;
                            reader.readAsDataURL(f);
                          });
                        })).then((newUrls) => {
                          onUpdatePaper({ ...paper, figureUrls: [...(paper.figureUrls ?? []), ...newUrls] });
                        });
                      }
                    }
                  }}
                  tabIndex={0}
                >
                  {(paper.figureUrls ?? []).map((figUrl, i) => (
                    <img
                      key={i}
                      src={figUrl}
                      alt={`Fig ${i + 1}`}
                      onClick={() => setLightbox({ urls: paper.figureUrls!, index: i })}
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: 'cover',
                        borderRadius: 4,
                        border: '1px solid var(--border-secondary)',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                  {onUpdatePaper && (
                    <label
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 4,
                        border: '1px dashed var(--border-input)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                      }}
                      title="Add figure (or Ctrl+V paste)"
                    >
                      +
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          if (files.length === 0) return;
                          const ghConfig = getGitHubConfig();
                          const existingCount = (paper.figureUrls ?? []).length;
                          if (ghConfig) {
                            Promise.all(files.map((f, fi) =>
                              uploadFigure(ghConfig, paper.id, f, existingCount + fi),
                            )).then((newUrls) => {
                              onUpdatePaper({ ...paper, figureUrls: [...(paper.figureUrls ?? []), ...newUrls] });
                            });
                          } else {
                            Promise.all(files.map((f) => {
                              return new Promise<string>((res, rej) => {
                                const reader = new FileReader();
                                reader.onload = () => res(reader.result as string);
                                reader.onerror = rej;
                                reader.readAsDataURL(f);
                              });
                            })).then((newUrls) => {
                              onUpdatePaper({ ...paper, figureUrls: [...(paper.figureUrls ?? []), ...newUrls] });
                            });
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
                {paper.url && (
                  <a
                    href={paper.url.startsWith('http') ? paper.url : `https://doi.org/${paper.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.75rem', color: 'var(--accent-forward)' }}
                  >
                    DOI link
                  </a>
                )}
                {crossRefs.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Also in:{' '}
                    {crossRefs.map((ref, i) => (
                      <span key={`${ref.type}-${ref.id}`}>
                        {i > 0 && ', '}
                        <span
                          onClick={() => {
                            if (ref.type === 'bridge') {
                              onNavigateToBridge?.(ref.id);
                            } else if (ref.islandId) {
                              onNavigateToRoad?.(ref.id, ref.islandId);
                            }
                          }}
                          style={{
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            color: ref.direction === 'forward' ? 'var(--accent-forward)' : 'var(--accent-backward)',
                          }}
                        >
                          {ref.type === 'bridge' ? 'Bridge' : 'Road'}: {ref.label}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add/Edit paper — no inline form, buttons open modal */}
        {!editingPaper ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              onClick={() => setShowPaperForm(true)}
              style={{
                padding: '6px 12px',
                background: 'var(--btn-secondary-bg)',
                border: '1px dashed var(--btn-secondary-border)',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
              }}
            >
              + Add Paper
            </button>
            <button
              onClick={async () => {
                const config = getClaudeConfig();
                if (!config) {
                  setShowClaudeSettings(true);
                  return;
                }
                setAiLoading(true);
                setAiError(null);
                setAiSuggestions([]);
                try {
                  const linkedGaps = gaps.filter((g) => (entity?.gapIds ?? []).includes(g.id));
                  const result = await suggestPapers(
                    config,
                    entity!,
                    sourceLabel ?? 'Source',
                    targetLabel ?? 'Target',
                    linkedPapers,
                    linkedGaps,
                  );
                  setAiSuggestions(result);
                } catch (e) {
                  setAiError((e as Error).message);
                } finally {
                  setAiLoading(false);
                }
              }}
              disabled={aiLoading}
              style={{
                padding: '6px 12px',
                background: aiLoading ? 'var(--btn-secondary-bg)' : 'var(--bg-ai)',
                border: '1px dashed var(--border-ai)',
                borderRadius: 4,
                cursor: aiLoading ? 'default' : 'pointer',
                fontSize: '0.8rem',
                color: 'var(--text-ai)',
              }}
            >
              {aiLoading ? 'AI 검색 중...' : 'AI 논문 제안'}
            </button>
          </div>
        ) : null}

        {/* AI Suggestion Results */}
        {aiError && (
          <div style={{
            marginTop: 8,
            padding: '8px 10px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            fontSize: '0.8rem',
            color: '#dc2626',
          }}>
            {aiError}
            <button
              onClick={() => setShowClaudeSettings(true)}
              style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--text-ai)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              API 설정
            </button>
          </div>
        )}
        {aiSuggestions.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-ai)', fontWeight: 600, marginBottom: 6 }}>
              AI 제안 ({aiSuggestions.length})
            </div>
            {aiSuggestions.map((sug, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 10px',
                  background: 'var(--bg-ai)',
                  borderRadius: 6,
                  border: '1px solid var(--border-ai)',
                  fontSize: '0.8rem',
                  marginBottom: 6,
                }}
              >
                <div style={{ fontWeight: 'bold' }}>
                  {sug.title} <span style={{ fontWeight: 'normal', color: 'var(--text-tertiary)' }}>({sug.year})</span>
                </div>
                {sug.authors.length > 0 && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 2 }}>
                    {sug.authors.join(', ')}
                  </div>
                )}
                {sug.journal && (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', fontStyle: 'italic', marginTop: 1 }}>
                    {sug.journal}
                  </div>
                )}
                <div style={{ color: 'var(--text-ai)', fontSize: '0.75rem', marginTop: 4 }}>
                  {sug.relevance}
                </div>
                {sug.addressesGap && sug.addressesGap !== 'null' && (
                  <div style={{ color: '#b45309', fontSize: '0.7rem', marginTop: 2 }}>
                    Gap: {sug.addressesGap}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button
                    onClick={() => {
                      const paper: Paper = {
                        id: generateId(),
                        title: sug.title,
                        authors: sug.authors,
                        year: sug.year,
                        journal: sug.journal,
                        url: sug.url,
                        comment: sug.relevance,
                        source: 'manual',
                        createdAt: new Date().toISOString(),
                      };
                      onAddPaper(paper);
                      setAiSuggestions((prev) => prev.filter((_, i) => i !== idx));
                    }}
                    style={{
                      padding: '3px 10px',
                      background: 'var(--accent-forward)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    추가
                  </button>
                  <button
                    onClick={() => setAiSuggestions((prev) => prev.filter((_, i) => i !== idx))}
                    style={{
                      padding: '3px 10px',
                      background: 'var(--btn-secondary-bg)',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    무시
                  </button>
                  {sug.url && (
                    <a
                      href={sug.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.7rem', color: 'var(--accent-forward)', alignSelf: 'center' }}
                    >
                      DOI
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>{/* end scrollable content area */}

      {/* Paper form modal */}
      {(showPaperForm || editingPaper) && (
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
          onClick={() => { setShowPaperForm(false); setEditingPaper(null); }}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: 10,
              padding: 24,
              width: 480,
              maxWidth: '90vw',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-dropdown)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', color: 'var(--text-heading)' }}>
              {editingPaper ? 'Edit Paper' : 'Add Paper'}
            </h3>
            <PaperForm
              initialPaper={editingPaper ?? undefined}
              onSubmit={(paper) => {
                if (editingPaper && onUpdatePaper) {
                  onUpdatePaper(paper);
                  setEditingPaper(null);
                } else {
                  onAddPaper(paper);
                  setShowPaperForm(false);
                }
              }}
              onCancel={() => { setShowPaperForm(false); setEditingPaper(null); }}
            />
          </div>
        </div>
      )}

      {lightbox && (
        <FigureLightbox
          urls={lightbox.urls}
          currentIndex={lightbox.index}
          onChangeIndex={(i) => setLightbox({ ...lightbox, index: i })}
          onClose={() => setLightbox(null)}
        />
      )}
      {showClaudeSettings && (
        <ClaudeSettings onClose={() => setShowClaudeSettings(false)} />
      )}
    </aside>
  );
}
