import { useState } from 'react';
import type { ResearchGap, Paper } from '../services/types';
import { generateId } from '../utils/idGenerator';
import { analyzeGaps, type GapSuggestion } from '../services/gapAnalysisService';

interface GapMemoProps {
  gaps: ResearchGap[];
  gapIds: string[];
  onAddGap: (gap: ResearchGap) => void;
  onDeleteGap: (gapId: string) => void;
  papers?: Paper[];
  sourceLabel?: string;
  targetLabel?: string;
  direction?: string;
}

const DIMENSION_COLORS: Record<string, string> = {
  '방법론':   '#3b82f6',
  '대상/재료': '#10b981',
  '스케일':   '#f59e0b',
  '측정변수': '#8b5cf6',
  '메커니즘': '#ef4444',
  '기타':     '#6b7280',
};

function DimensionBadge({ label }: { label: string }) {
  const color = DIMENSION_COLORS[label] ?? DIMENSION_COLORS['기타'];
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      borderRadius: 10,
      fontSize: '0.7rem',
      fontWeight: 600,
      color: '#fff',
      background: color,
      marginBottom: 4,
      flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

export default function GapMemo({
  gaps, gapIds, onAddGap, onDeleteGap,
  papers, sourceLabel, targetLabel, direction,
}: GapMemoProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<GapSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const linkedGaps = gaps.filter((g) => gapIds.includes(g.id));
  const canAnalyze = (papers?.length ?? 0) > 0;
  const visibleSuggestions = suggestions.filter((_, i) => !dismissed.has(i));

  const handleAdd = () => {
    if (!text.trim()) return;
    const gap: ResearchGap = {
      id: generateId(),
      description: text.trim(),
      source: 'manual',
      relatedPaperIds: [],
      createdAt: new Date().toISOString(),
    };
    onAddGap(gap);
    setText('');
    setIsAdding(false);
  };

  const handleAnalyze = async () => {
    if (!papers || !sourceLabel || !targetLabel) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setSuggestions([]);
    setDismissed(new Set());
    try {
      const result = await analyzeGaps({
        sourceLabel,
        targetLabel,
        direction: direction ?? 'forward',
        papers,
        existingGapDescriptions: linkedGaps.map((g) => g.description),
      });
      if (result.length === 0) {
        setAnalyzeError('제안을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setSuggestions(result);
      }
    } catch {
      setAnalyzeError('분석 중 오류가 발생했습니다.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApprove = (idx: number, suggestion: GapSuggestion) => {
    const gap: ResearchGap = {
      id: generateId(),
      description: suggestion.description,
      source: 'auto_detected',
      relatedPaperIds: suggestion.relatedPaperIds,
      createdAt: new Date().toISOString(),
    };
    onAddGap(gap);
    setDismissed((prev) => new Set(prev).add(idx));
  };

  const handleDismiss = (idx: number) => {
    setDismissed((prev) => new Set(prev).add(idx));
  };

  const btnBase: React.CSSProperties = {
    padding: '2px 8px',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.75rem',
  };

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
          Research Gaps ({linkedGaps.length})
        </h4>
        {canAnalyze && (
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            style={{
              ...btnBase,
              background: analyzing ? 'var(--btn-secondary-bg)' : 'var(--accent-forward)',
              color: analyzing ? 'var(--text-secondary)' : '#fff',
              opacity: analyzing ? 0.7 : 1,
            }}
          >
            {analyzing ? '분석 중...' : visibleSuggestions.length > 0 ? '재분석' : 'AI 분석'}
          </button>
        )}
      </div>

      {/* AI Suggestion cards */}
      {visibleSuggestions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {suggestions.map((s, i) => {
            if (dismissed.has(i)) return null;
            return (
              <div
                key={i}
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '8px 10px',
                  borderRadius: 6,
                  borderLeft: '3px dashed var(--accent-forward, #2a9d8f)',
                  border: '1px solid var(--border-paper)',
                  borderLeftWidth: 3,
                  borderLeftStyle: 'dashed',
                  fontSize: '0.83rem',
                }}
                title={s.rationale}
              >
                <DimensionBadge label={s.dimension} />
                <div style={{ color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 6 }}>
                  {s.description}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  {s.relatedPaperIds.length > 0 && (
                    <span>관련 논문 {s.relatedPaperIds.length}개</span>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => handleApprove(i, s)}
                      style={{ ...btnBase, background: 'var(--accent-forward)', color: '#fff' }}
                    >
                      추가
                    </button>
                    <button
                      onClick={() => handleDismiss(i)}
                      style={{ ...btnBase, background: 'var(--btn-secondary-bg)', color: 'var(--text-secondary)' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {analyzeError && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-status-error)', marginBottom: 6 }}>
          {analyzeError}
        </div>
      )}

      {/* Existing gap cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {linkedGaps.map((gap) => (
          <div
            key={gap.id}
            style={{
              background: 'var(--bg-gap)',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-gap)',
              fontSize: '0.85rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              boxShadow: '1px 2px 4px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ flex: 1 }}>
              {gap.source === 'auto_detected' && (
                <span style={{
                  display: 'inline-block',
                  padding: '1px 5px',
                  borderRadius: 8,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  background: 'var(--accent-forward)',
                  color: '#fff',
                  marginRight: 5,
                  verticalAlign: 'middle',
                }}>
                  AI
                </span>
              )}
              {gap.description}
            </div>
            <button
              onClick={() => onDeleteGap(gap.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1rem',
                marginLeft: 6,
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* Manual add */}
      {isAdding ? (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="gap description..."
            style={{
              width: '100%',
              minHeight: 60,
              padding: 8,
              border: '1px solid var(--border-input)',
              borderRadius: 4,
              fontSize: '0.85rem',
              resize: 'vertical',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
            }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button
              onClick={handleAdd}
              style={{ padding: '4px 12px', background: 'var(--accent-forward)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Add
            </button>
            <button
              onClick={() => { setIsAdding(false); setText(''); }}
              style={{ padding: '4px 12px', background: 'var(--btn-secondary-bg)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          style={{
            marginTop: 8,
            padding: '4px 10px',
            background: 'var(--bg-gap)',
            border: '1px dashed var(--border-gap)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          + Gap Memo
        </button>
      )}
    </div>
  );
}
