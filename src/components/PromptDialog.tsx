import { useState } from 'react';

interface PromptDialogProps {
  title: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export default function PromptDialog({ title, defaultValue, onConfirm, onCancel }: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  return (
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
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)',
          padding: '20px 24px',
          borderRadius: 10,
          boxShadow: 'var(--shadow-dropdown)',
          color: 'var(--text-primary)',
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
            border: '1px solid var(--border-input)',
            borderRadius: 6,
            fontSize: '0.9rem',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 16px',
              border: '1px solid var(--btn-secondary-border)',
              borderRadius: 6,
              background: 'var(--bg-primary)',
              cursor: 'pointer',
              color: 'var(--text-primary)',
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
              background: 'var(--text-heading)',
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
