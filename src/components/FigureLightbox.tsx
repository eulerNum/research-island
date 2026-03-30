import { useEffect, useCallback } from 'react';

interface FigureLightboxProps {
  urls: string[];
  currentIndex: number;
  onChangeIndex: (index: number) => void;
  onClose: () => void;
}

export default function FigureLightbox({
  urls,
  currentIndex,
  onChangeIndex,
  onClose,
}: FigureLightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && currentIndex > 0) onChangeIndex(currentIndex - 1);
      else if (e.key === 'ArrowRight' && currentIndex < urls.length - 1) onChangeIndex(currentIndex + 1);
    },
    [currentIndex, urls.length, onChangeIndex, onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
      >
        <img
          src={urls[currentIndex]}
          alt={`Figure ${currentIndex + 1}`}
          style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }}
        />

        {/* Navigation */}
        {urls.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button onClick={() => onChangeIndex(currentIndex - 1)} style={{ ...navBtn, left: -50 }}>
                &larr;
              </button>
            )}
            {currentIndex < urls.length - 1 && (
              <button onClick={() => onChangeIndex(currentIndex + 1)} style={{ ...navBtn, right: -50 }}>
                &rarr;
              </button>
            )}
          </>
        )}

        {/* Counter */}
        <div
          style={{
            textAlign: 'center',
            color: '#fff',
            marginTop: 8,
            fontSize: '0.85rem',
          }}
        >
          {currentIndex + 1} / {urls.length}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: -12,
            right: -12,
            background: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: 28,
            height: 28,
            color: '#333',
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          &times;
        </button>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'rgba(255,255,255,0.9)',
  border: 'none',
  borderRadius: '50%',
  width: 36,
  height: 36,
  fontSize: '1.2rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
