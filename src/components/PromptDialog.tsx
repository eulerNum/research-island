import { useState } from 'react';

interface PromptDialogProps {
  title: string;
  defaultValue?: string;
  showDirection?: boolean;
  onConfirm: (value: string, direction?: 'forward' | 'backward') => void;
  onCancel: () => void;
}

export default function PromptDialog({ title, defaultValue, showDirection, onConfirm, onCancel }: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue ?? '');
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim(), showDirection ? direction : undefined);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          padding: '20px 24px',
          borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          minWidth: 300,
        }}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>{title}</h3>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #ccc',
            borderRadius: 6,
            fontSize: '0.9rem',
          }}
        />
        {showDirection && (
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="radio"
                name="direction"
                checked={direction === 'forward'}
                onChange={() => setDirection('forward')}
              />
              <span style={{ color: '#2a9d8f', fontWeight: 600 }}>Forward →</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="radio"
                name="direction"
                checked={direction === 'backward'}
                onChange={() => setDirection('backward')}
              />
              <span style={{ color: '#e76f51', fontWeight: 600 }}>← Backward</span>
            </label>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 16px',
              border: '1px solid #ccc',
              borderRadius: 6,
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: '6px 16px',
              border: 'none',
              borderRadius: 6,
              background: '#023047',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            OK
          </button>
        </div>
      </form>
    </div>
  );
}
