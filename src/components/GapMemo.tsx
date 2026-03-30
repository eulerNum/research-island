import { useState } from 'react';
import type { ResearchGap } from '../services/types';
import { generateId } from '../utils/idGenerator';

interface GapMemoProps {
  gaps: ResearchGap[];
  gapIds: string[];
  onAddGap: (gap: ResearchGap) => void;
  onDeleteGap: (gapId: string) => void;
}

export default function GapMemo({ gaps, gapIds, onAddGap, onDeleteGap }: GapMemoProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');

  const linkedGaps = gaps.filter((g) => gapIds.includes(g.id));

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

  return (
    <div>
      <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
        Research Gaps ({linkedGaps.length})
      </h4>
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
            <span style={{ flex: 1 }}>{gap.description}</span>
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
              style={{
                padding: '4px 12px',
                background: 'var(--accent-forward)',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Add
            </button>
            <button
              onClick={() => { setIsAdding(false); setText(''); }}
              style={{
                padding: '4px 12px',
                background: 'var(--btn-secondary-bg)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
              }}
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
