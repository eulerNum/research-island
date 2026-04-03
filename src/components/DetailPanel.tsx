import { useState, useMemo, useCallback, useRef } from 'react';
import type { Bridge, Road, Paper, ResearchGap } from '../services/types';
import { getGitHubConfig } from '../services/githubService';
import { uploadFigure } from '../services/figureService';
import GapMemo from './GapMemo';
import PaperForm from './PaperForm';
import FigureLightbox from './FigureLightbox';

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
  aiChatOpen?: boolean;
  onToggleAIChat?: () => void;
  onStudyPaper?: (paperId: string) => void;
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
  onAddPaper,
  onUpdatePaper,
  onAddGap,
  onDeleteGap,
  onRemovePaper,
  onDeletePaper,
  onHighlightPaper,
  onNavigateToBridge,
  onNavigateToRoad,
  onClose,
  aiChatOpen,
  onToggleAIChat,
  onStudyPaper,
  sourceLabel,
  targetLabel,
}: DetailPanelProps) {
  const [showPaperForm, setShowPaperForm] = useState(false);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [pinnedPaperId, setPinnedPaperId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [panelWidth, setPanelWidth] = useState(420);
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
        <h3 style={{ fontSize: '1rem', margin: 0, flex: 1, minWidth: 0 }}>
          <span style={{ color: dirColor }}>{entity.direction === 'forward' ? '\u2192' : '\u2190'}</span>{' '}
          {entityDisplayName}
        </h3>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {onToggleAIChat && (
            <button
              onClick={onToggleAIChat}
              title="AI Chat"
              style={{
                padding: '2px 8px',
                background: aiChatOpen ? 'var(--text-ai)' : 'var(--bg-ai)',
                color: aiChatOpen ? '#fff' : 'var(--text-ai)',
                border: '1px solid var(--border-ai)',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              AI
            </button>
          )}
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
      </div>

      {/* Scrollable content area — papers, gaps, suggestions */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 16px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>

      {/* Gap Memos */}
      <GapMemo
        gaps={gaps}
        gapIds={gapIds}
        onAddGap={onAddGap}
        onDeleteGap={onDeleteGap}
        papers={papers}
        sourceLabel={sourceLabel}
        targetLabel={targetLabel}
        direction={bridge?.direction ?? road?.direction}
      />

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
                onDoubleClick={() => onStudyPaper?.(paper.id)}
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

        {/* Add/Edit paper */}
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
          </div>
        ) : null}

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
    </aside>
  );
}
