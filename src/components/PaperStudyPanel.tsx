import { useState, useRef, useCallback, useMemo } from 'react';
import type { Paper, Bridge, Road } from '../services/types';
import { getGitHubConfig } from '../services/githubService';
import { uploadFigure } from '../services/figureService';
import { summarizePaper } from '../services/aiService';
import FigureLightbox from './FigureLightbox';
import AISettings from './AISettings';

interface PaperStudyPanelProps {
  paper: Paper;
  allBridges: Bridge[];
  allRoads: Road[];
  islandNameMap: Map<string, string>;
  cityNameMap: Map<string, string>;
  allIslandCityMap: Map<string, string>;
  onUpdatePaper: (paper: Paper) => void;
  onNavigateToBridge?: (bridgeId: string) => void;
  onNavigateToRoad?: (roadId: string, islandId: string) => void;
  onClose: () => void;
}

/** Simple markdown to HTML (bold, italic, headers, lists — no external deps) */
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n/g, '<br>');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

const SH = 'font-size:0.72rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.06em;margin:14px 0 5px';

/** Structured renderer for AI summary output */
function renderAISummary(text: string): string {
  const parts = text.split(/(?=^## )/m).filter(s => s.trim());
  return parts.map(part => {
    const nl = part.indexOf('\n');
    if (nl === -1) return renderMarkdown(part);
    const title = part.slice(2, nl).trim(); // strip leading '## '
    const body = part.slice(nl + 1).trim();

    if (title.includes('한줄 요약')) {
      return `<div style="background:rgba(42,157,143,0.1);border-left:3px solid var(--accent-forward,#2a9d8f);padding:8px 12px;border-radius:0 4px 4px 0;font-weight:500;margin-bottom:2px">${renderInline(body)}</div>`;
    }

    if (title.includes('연구 프레임')) {
      const rows = body.split('\n')
        .filter(l => l.trim().startsWith('-'))
        .map(l => {
          const m = l.match(/^-\s*\*\*(.+?)\*\*:\s*(.+)$/);
          if (!m) return '';
          return `<tr>
            <th style="padding:5px 10px 5px 0;white-space:nowrap;color:var(--text-secondary);font-weight:600;font-size:0.8rem;vertical-align:top;width:1%">${escapeHtml(m[1])}</th>
            <td style="padding:5px 0;font-size:0.82rem;color:var(--text-primary)">${renderInline(m[2])}</td>
          </tr>`;
        }).filter(Boolean).join('');
      if (!rows) return renderMarkdown(part);
      return `<p style="${SH}">${escapeHtml(title)}</p><table style="width:100%;border-collapse:collapse">${rows}</table>`;
    }

    if (title.includes('주요 발견')) {
      const items = body.split('\n')
        .filter(l => l.trim().startsWith('-'))
        .map(l => `<li style="margin-bottom:3px">${renderInline(l.replace(/^-\s*/, ''))}</li>`)
        .join('');
      return `<p style="${SH}">${escapeHtml(title)}</p><ul style="margin:0;padding-left:18px;font-size:0.82rem">${items}</ul>`;
    }

    if (title.includes('인용 포인트')) {
      const quotes = body.split('\n')
        .filter(l => l.trim().startsWith('>'))
        .map(l => `<blockquote style="border-left:3px solid var(--text-tertiary,#999);margin:4px 0;padding:4px 10px;color:var(--text-secondary);font-style:italic;font-size:0.82rem">${renderInline(l.replace(/^>\s*/, ''))}</blockquote>`)
        .join('');
      return `<p style="${SH}">${escapeHtml(title)}</p>${quotes || renderMarkdown(body)}`;
    }

    return `<p style="${SH}">${escapeHtml(title)}</p><div style="font-size:0.82rem">${renderMarkdown(body)}</div>`;
  }).join('');
}

export default function PaperStudyPanel({
  paper,
  allBridges,
  allRoads,
  islandNameMap,
  cityNameMap,
  allIslandCityMap,
  onUpdatePaper,
  onNavigateToBridge,
  onNavigateToRoad,
  onClose,
}: PaperStudyPanelProps) {
  const [commentDraft, setCommentDraft] = useState(paper.comment ?? '');
  const [previewMode, setPreviewMode] = useState(false);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showClaudeSettings, setShowClaudeSettings] = useState(false);
  const [panelWidth, setPanelWidth] = useState(420);
  const resizingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<number | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startX - ev.clientX;
      setPanelWidth(Math.max(320, Math.min(600, startWidth + delta)));
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

  // Cross-references: which bridges/roads contain this paper
  const crossRefs = useMemo(() => {
    const refs: { type: 'bridge' | 'road'; id: string; label: string; direction: string; islandId?: string }[] = [];
    for (const b of allBridges) {
      if (b.paperIds.includes(paper.id)) {
        const src = islandNameMap.get(b.sourceIslandId) ?? '?';
        const tgt = islandNameMap.get(b.targetIslandId) ?? '?';
        refs.push({ type: 'bridge', id: b.id, label: b.label ? `${src}\u2192${tgt}: ${b.label}` : `${src}\u2192${tgt}`, direction: b.direction });
      }
    }
    for (const r of allRoads) {
      if (r.paperIds.includes(paper.id)) {
        const islandId = allIslandCityMap.get(r.sourceCityId) ?? allIslandCityMap.get(r.targetCityId);
        const src = cityNameMap.get(r.sourceCityId) ?? '?';
        const tgt = cityNameMap.get(r.targetCityId) ?? '?';
        refs.push({ type: 'road', id: r.id, label: r.label ? `${src}\u2192${tgt}: ${r.label}` : `${src}\u2192${tgt}`, direction: r.direction, islandId });
      }
    }
    return refs;
  }, [paper.id, allBridges, allRoads, islandNameMap, cityNameMap, allIslandCityMap]);

  // Comment auto-save on change (debounced)
  const handleCommentChange = useCallback((value: string) => {
    setCommentDraft(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      onUpdatePaper({ ...paper, comment: value || undefined });
    }, 1000);
  }, [paper, onUpdatePaper]);

  const handleCommentBlur = useCallback(() => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    if (commentDraft !== (paper.comment ?? '')) {
      onUpdatePaper({ ...paper, comment: commentDraft || undefined });
    }
  }, [commentDraft, paper, onUpdatePaper]);

  // AI summary
  const handleGenerateSummary = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const summary = await summarizePaper(paper);
      onUpdatePaper({ ...paper, aiSummary: summary });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('API 키가 설정되지 않았습니다')) {
        setShowClaudeSettings(true);
      }
      setAiError(msg);
    } finally {
      setAiLoading(false);
    }
  }, [paper, onUpdatePaper]);

  // Figure upload
  const handleFigureUpload = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const ghConfig = getGitHubConfig();
    const existingCount = (paper.figureUrls ?? []).length;
    if (ghConfig) {
      Promise.all(files.map((f, fi) => uploadFigure(ghConfig, paper.id, f, existingCount + fi)))
        .then((newUrls) => onUpdatePaper({ ...paper, figureUrls: [...(paper.figureUrls ?? []), ...newUrls] }));
    } else {
      Promise.all(files.map((f) => new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(f);
      }))).then((newUrls) => onUpdatePaper({ ...paper, figureUrls: [...(paper.figureUrls ?? []), ...newUrls] }));
    }
  }, [paper, onUpdatePaper]);

  return (
    <aside
      style={{
        width: panelWidth,
        borderLeft: '1px solid var(--border-secondary)',
        background: 'var(--bg-primary)',
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        position: 'relative',
        flexShrink: 0,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <h2 style={{ fontSize: '1.3rem', margin: 0, color: 'var(--text-heading)', lineHeight: 1.3 }}>
          {paper.title}
        </h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: 'var(--text-muted)', flexShrink: 0, padding: 0 }}>&times;</button>
      </div>

      {/* Basic info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {paper.authors.join(', ')}
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          <span>{paper.year}</span>
          {paper.journal && <span style={{ fontStyle: 'italic' }}>{paper.journal}</span>}
        </div>
        {paper.url && (
          <a
            href={paper.url.startsWith('http') ? paper.url : `https://doi.org/${paper.url}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.8rem', color: 'var(--accent-forward)' }}
          >
            DOI Link
          </a>
        )}
      </div>

      {/* AI Summary */}
      <section>
        <h3 style={sectionHeader}>AI Summary</h3>
        {paper.aiSummary ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
            <div dangerouslySetInnerHTML={{ __html: renderAISummary(paper.aiSummary) }} />
            <div style={{ marginTop: 8 }}>
              <button onClick={handleGenerateSummary} disabled={aiLoading} style={smallBtn}>
                {aiLoading ? '...' : 'Regenerate'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button onClick={handleGenerateSummary} disabled={aiLoading} style={smallBtn}>
              {aiLoading ? 'Generating...' : 'Generate Summary'}
            </button>
            {!paper.abstract && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Abstract not available — summary will be based on title and authors
              </div>
            )}
          </div>
        )}
        {aiError && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-status-error)', marginTop: 4 }}>{aiError}</div>
        )}
      </section>

      {/* Figure Gallery */}
      <section>
        <h3 style={sectionHeader}>Figures ({(paper.figureUrls ?? []).length})</h3>
        <div
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
          onPaste={(e) => {
            const items = e.clipboardData.items;
            const imageFiles: File[] = [];
            for (let i = 0; i < items.length; i++) {
              if (items[i].type.startsWith('image/')) {
                const f = items[i].getAsFile();
                if (f) imageFiles.push(f);
              }
            }
            if (imageFiles.length > 0) {
              e.preventDefault();
              handleFigureUpload(imageFiles);
            }
          }}
          tabIndex={0}
        >
          {(paper.figureUrls ?? []).map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`Fig ${i + 1}`}
              onClick={() => setLightbox({ urls: paper.figureUrls!, index: i })}
              style={{
                width: 120,
                height: 120,
                objectFit: 'cover',
                borderRadius: 6,
                border: '1px solid var(--border-secondary)',
                cursor: 'pointer',
              }}
            />
          ))}
          <label
            style={{
              width: 120,
              height: 120,
              borderRadius: 6,
              border: '2px dashed var(--border-input)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.5rem',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
            title="Add figure (or Ctrl+V paste)"
          >
            +
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                handleFigureUpload(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </section>

      {/* Cross-references */}
      {crossRefs.length > 0 && (
        <section>
          <h3 style={sectionHeader}>Placed in ({crossRefs.length})</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {crossRefs.map((ref) => (
              <span
                key={`${ref.type}-${ref.id}`}
                onClick={() => {
                  if (ref.type === 'bridge') onNavigateToBridge?.(ref.id);
                  else if (ref.islandId) onNavigateToRoad?.(ref.id, ref.islandId);
                }}
                style={{
                  fontSize: '0.75rem',
                  padding: '3px 8px',
                  borderRadius: 12,
                  background: ref.direction === 'forward' ? 'rgba(42,157,143,0.15)' : 'rgba(231,111,81,0.15)',
                  color: ref.direction === 'forward' ? 'var(--accent-forward)' : 'var(--accent-backward)',
                  cursor: 'pointer',
                  border: `1px solid ${ref.direction === 'forward' ? 'rgba(42,157,143,0.3)' : 'rgba(231,111,81,0.3)'}`,
                }}
              >
                {ref.type === 'bridge' ? 'Bridge' : 'Road'}: {ref.label}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Study Notes */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <h3 style={{ ...sectionHeader, marginBottom: 0, flex: 1 }}>Study Notes</h3>
          <button
            onClick={() => setPreviewMode((p) => !p)}
            style={{ ...smallBtn, fontSize: '0.65rem' }}
          >
            {previewMode ? 'Edit' : 'Preview'}
          </button>
        </div>
        {previewMode ? (
          <div
            style={{
              flex: 1,
              minHeight: 150,
              padding: '10px 12px',
              background: 'var(--bg-secondary)',
              borderRadius: 6,
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              overflow: 'auto',
            }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(commentDraft || '_No notes yet_') }}
          />
        ) : (
          <textarea
            value={commentDraft}
            onChange={(e) => handleCommentChange(e.target.value)}
            onBlur={handleCommentBlur}
            placeholder="Write your study notes here... (supports **bold**, *italic*, # headers, - lists)"
            style={{
              flex: 1,
              minHeight: 150,
              padding: '10px 12px',
              border: '1px solid var(--border-input)',
              borderRadius: 6,
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              lineHeight: 1.6,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        )}
      </section>

      {lightbox && (
        <FigureLightbox
          urls={lightbox.urls}
          currentIndex={lightbox.index}
          onChangeIndex={(i) => setLightbox((prev) => prev ? { ...prev, index: i } : null)}
          onClose={() => setLightbox(null)}
        />
      )}
      {showClaudeSettings && (
        <AISettings onClose={() => setShowClaudeSettings(false)} />
      )}
    </aside>
  );
}

const sectionHeader: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  margin: '0 0 8px',
};

const smallBtn: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid var(--btn-secondary-border)',
  borderRadius: 4,
  background: 'var(--btn-secondary-bg)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: '0.75rem',
};
