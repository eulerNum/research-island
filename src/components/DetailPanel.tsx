import { useState, useMemo } from 'react';
import type { Bridge, Road, Paper, ResearchGap } from '../services/types';
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
  highlightedPaperId?: string | null;
  onAddPaper: (paper: Paper) => void;
  onUpdatePaper?: (paper: Paper) => void;
  onAddGap: (gap: ResearchGap) => void;
  onDeleteGap: (gapId: string) => void;
  onHighlightPaper?: (paperId: string | null) => void;
  onNavigateToBridge?: (bridgeId: string) => void;
  onNavigateToRoad?: (roadId: string, islandId: string) => void;
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
  onAddPaper,
  onUpdatePaper,
  onAddGap,
  onDeleteGap,
  onHighlightPaper,
  onNavigateToBridge,
  onNavigateToRoad,
  onClose,
}: DetailPanelProps) {
  const [showPaperForm, setShowPaperForm] = useState(false);
  const [pinnedPaperId, setPinnedPaperId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  const entity = bridge ?? road;
  const paperIds = entity?.paperIds ?? [];
  const linkedPapers = papers.filter((p) => paperIds.includes(p.id));

  const crossRefMap = useMemo(() => {
    const map = new Map<string, CrossRef[]>();
    for (const paper of linkedPapers) {
      const refs: CrossRef[] = [];
      for (const b of allBridges) {
        if (b.id !== bridge?.id && b.paperIds.includes(paper.id)) {
          refs.push({ type: 'bridge', id: b.id, label: b.label || b.id.slice(0, 8), direction: b.direction });
        }
      }
      for (const r of allRoads) {
        if (r.id !== road?.id && r.paperIds.includes(paper.id)) {
          const islandId = allIslandCityMap?.get(r.sourceCityId) ?? allIslandCityMap?.get(r.targetCityId);
          refs.push({ type: 'road', id: r.id, label: r.label || r.id.slice(0, 8), direction: r.direction, islandId });
        }
      }
      if (refs.length > 0) map.set(paper.id, refs);
    }
    return map;
  }, [linkedPapers, allBridges, allRoads, allIslandCityMap, bridge, road]);

  if (!entity) return null;

  const entityType = bridge ? 'Bridge' : 'Road';
  const gapIds = entity.gapIds;
  const dirColor = entity.direction === 'forward' ? '#2a9d8f' : '#e76f51';

  return (
    <aside
      style={{
        width: 360,
        borderLeft: '1px solid #ddd',
        background: '#fff',
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1rem', margin: 0 }}>
          <span style={{ color: dirColor }}>{entity.direction === 'forward' ? '\u2192' : '\u2190'}</span>{' '}
          {entityType}: {entity.label || 'Untitled'}
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.2rem',
            cursor: 'pointer',
            color: '#999',
          }}
        >
          &times;
        </button>
      </div>

      {/* Gap Memos */}
      <GapMemo gaps={gaps} gapIds={gapIds} onAddGap={onAddGap} onDeleteGap={onDeleteGap} />

      {/* Papers */}
      <div>
        <h4 style={{ fontSize: '0.85rem', color: '#555', marginBottom: 8 }}>
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
                  background: isHighlighted ? '#fff8e1' : '#f8f9fa',
                  borderRadius: 6,
                  border: `1px solid ${isHighlighted ? '#ffd700' : '#e9ecef'}`,
                  borderLeft: isHighlighted ? '3px solid #ffd700' : '1px solid #e9ecef',
                  fontSize: '0.85rem',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={() => { if (!pinnedPaperId) onHighlightPaper?.(paper.id); }}
                onMouseLeave={() => { if (!pinnedPaperId) onHighlightPaper?.(null); }}
              >
                <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    {paper.title}{' '}
                    <span style={{ fontWeight: 'normal', color: '#888' }}>({paper.year})</span>
                  </span>
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
                      color: isPinned ? '#ffd700' : '#ccc',
                      padding: '0 2px',
                      flexShrink: 0,
                    }}
                  >
                    {isPinned ? '\u2605' : '\u2606'}
                  </button>
                </div>
                {paper.authors.length > 0 && (
                  <div style={{ color: '#666', fontSize: '0.8rem', marginTop: 2 }}>
                    {paper.authors.join(', ')}
                  </div>
                )}
                {paper.journal && (
                  <div style={{ color: '#888', fontSize: '0.75rem', marginTop: 2, fontStyle: 'italic' }}>
                    {paper.journal}
                  </div>
                )}
                {paper.abstract && (
                  <div style={{ color: '#777', fontSize: '0.8rem', marginTop: 4 }}>
                    {paper.abstract.slice(0, 120)}
                    {paper.abstract.length > 120 ? '...' : ''}
                  </div>
                )}
                {paper.comment && (
                  <div style={{ color: '#5a7d9a', fontSize: '0.75rem', marginTop: 4, fontStyle: 'italic', borderLeft: '2px solid #a8dadc', paddingLeft: 6 }}>
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
                        border: '1px solid #ddd',
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
                        border: '1px dashed #ccc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        color: '#aaa',
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
                    style={{ fontSize: '0.75rem', color: '#2a9d8f' }}
                  >
                    DOI link
                  </a>
                )}
                {crossRefs.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 4 }}>
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
                            color: ref.direction === 'forward' ? '#2a9d8f' : '#e76f51',
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

        {/* Add paper */}
        {showPaperForm ? (
          <div style={{ marginTop: 8 }}>
            <PaperForm
              onSubmit={(paper) => {
                onAddPaper(paper);
                setShowPaperForm(false);
              }}
              onCancel={() => setShowPaperForm(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowPaperForm(true)}
            style={{
              marginTop: 8,
              padding: '6px 12px',
              background: '#f8f9fa',
              border: '1px dashed #adb5bd',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.8rem',
              color: '#666',
            }}
          >
            + Add Paper
          </button>
        )}
      </div>

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
