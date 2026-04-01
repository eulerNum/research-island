import { useState, useEffect, useRef } from 'react';

interface GapPostitAnimationProps {
  gapId: string;
  description: string;
  startRect: DOMRect;
  endRect: { x: number; y: number } | null;
  onDismiss: () => void;
}

export default function GapPostitAnimation({
  description,
  startRect,
  endRect,
  onDismiss,
}: GapPostitAnimationProps) {
  const [phase, setPhase] = useState<'flying' | 'stuck' | 'returning'>('flying');
  const elRef = useRef<HTMLDivElement>(null);

  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;
  const targetX = endRect ? endRect.x : startX + 200;
  const targetY = endRect ? endRect.y : startY;

  useEffect(() => {
    if (phase === 'flying') {
      const timer = setTimeout(() => setPhase('stuck'), 600);
      return () => clearTimeout(timer);
    }
    if (phase === 'returning') {
      const timer = setTimeout(() => onDismiss(), 400);
      return () => clearTimeout(timer);
    }
  }, [phase, onDismiss]);

  const handleClick = () => {
    if (phase === 'stuck') setPhase('returning');
  };

  let x: number, y: number, opacity: number, scale: number, rotate: number;

  if (phase === 'flying') {
    x = targetX;
    y = targetY;
    opacity = 1;
    scale = 1;
    rotate = -3;
  } else if (phase === 'stuck') {
    x = targetX;
    y = targetY;
    opacity = 1;
    scale = 1;
    rotate = -3;
  } else {
    // returning
    x = startX;
    y = startY;
    opacity = 0;
    scale = 0.5;
    rotate = 0;
  }

  const isAnimating = phase === 'flying' || phase === 'returning';

  return (
    <div
      ref={elRef}
      onClick={handleClick}
      style={{
        position: 'fixed',
        left: phase === 'flying' ? startX : x,
        top: phase === 'flying' ? startY : y,
        transform: `translate(-50%, -50%) scale(${phase === 'flying' ? 0.5 : scale}) rotate(${rotate}deg)`,
        opacity: phase === 'flying' ? 0.5 : opacity,
        width: 140,
        padding: '10px 12px',
        background: '#fff9c4',
        border: '1px solid #f9e076',
        borderRadius: 3,
        boxShadow: '2px 3px 8px rgba(0,0,0,0.2)',
        fontSize: '0.7rem',
        color: '#5d4037',
        cursor: phase === 'stuck' ? 'pointer' : 'default',
        zIndex: 9999,
        pointerEvents: phase === 'stuck' ? 'auto' : 'none',
        transition: isAnimating
          ? `all ${phase === 'flying' ? '0.6s' : '0.4s'} cubic-bezier(0.34, 1.56, 0.64, 1)`
          : 'none',
      }}
    >
      {description.length > 80 ? description.slice(0, 78) + '...' : description}
      {phase === 'stuck' && (
        <div style={{ fontSize: '0.55rem', color: '#8d6e63', marginTop: 4, textAlign: 'right' }}>
          click to dismiss
        </div>
      )}
    </div>
  );
}
