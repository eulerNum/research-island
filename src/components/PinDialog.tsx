import { useState, useRef, useEffect } from 'react';

interface PinDialogProps {
  mapName: string;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
  error?: string | null;
}

export default function PinDialog({ mapName, onConfirm, onCancel, error }: PinDialogProps) {
  const [pin, setPin] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 4) onConfirm(pin);
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
        style={{
          background: 'var(--bg-primary)',
          borderRadius: 12,
          padding: '32px 40px',
          textAlign: 'center',
          minWidth: 300,
          boxShadow: 'var(--shadow-dropdown)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: 'var(--text-heading)' }}>
          {mapName}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          PIN 4자리를 입력하세요
        </p>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 4);
            setPin(v);
          }}
          style={{
            width: 140,
            padding: '12px 16px',
            fontSize: '1.5rem',
            textAlign: 'center',
            letterSpacing: '0.5em',
            border: `2px solid ${error ? '#dc3545' : 'var(--border-input)'}`,
            borderRadius: 8,
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
          placeholder="····"
        />
        {error && (
          <div style={{ color: '#dc3545', fontSize: '0.8rem', marginTop: 8 }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 20px',
              border: '1px solid var(--btn-secondary-border)',
              borderRadius: 6,
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={pin.length !== 4}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderRadius: 6,
              background: 'var(--accent-forward)',
              color: '#fff',
              cursor: pin.length === 4 ? 'pointer' : 'default',
              fontSize: '0.85rem',
              opacity: pin.length === 4 ? 1 : 0.5,
            }}
          >
            확인
          </button>
        </div>
      </form>
    </div>
  );
}
