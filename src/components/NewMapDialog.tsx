import { useState } from 'react';

interface NewMapDialogProps {
  onConfirm: (name: string, description: string, pin: string) => void;
  onCancel: () => void;
}

export default function NewMapDialog({ onConfirm, onCancel }: NewMapDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  const pinMatch = pin === pinConfirm;
  const canSubmit = name.trim() && pin.length === 4 && pinMatch;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) onConfirm(name.trim(), description.trim(), pin);
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
          padding: 28,
          width: 420,
          maxWidth: '90vw',
          boxShadow: 'var(--shadow-dropdown)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem', color: 'var(--text-heading)' }}>
          New Map
        </h3>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            placeholder="예: 박사논문 맵"
            autoFocus
            required
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={inputStyle}
            placeholder="예: 관능과학 선행연구 정리"
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>PIN (4자리 숫자) *</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            style={{ ...inputStyle, letterSpacing: '0.3em' }}
            placeholder="····"
            required
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>PIN 확인 *</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
            style={{
              ...inputStyle,
              letterSpacing: '0.3em',
              borderColor: pinConfirm && !pinMatch ? '#dc3545' : 'var(--border-input)',
            }}
            placeholder="····"
            required
          />
          {pinConfirm && !pinMatch && (
            <div style={{ color: '#dc3545', fontSize: '0.75rem', marginTop: 4 }}>
              PIN이 일치하지 않습니다
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
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
            disabled={!canSubmit}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderRadius: 6,
              background: 'var(--accent-forward)',
              color: '#fff',
              cursor: canSubmit ? 'pointer' : 'default',
              fontSize: '0.85rem',
              opacity: canSubmit ? 1 : 0.5,
            }}
          >
            만들기
          </button>
        </div>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border-input)',
  borderRadius: 6,
  fontSize: '0.9rem',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
};
