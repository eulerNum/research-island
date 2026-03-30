import { useEffect, useRef } from 'react';

export interface ContextMenuButtonItem {
  type?: 'button';
  label: string;
  color?: string;
  onClick: () => void;
}

export interface ContextMenuPaletteItem {
  type: 'palette';
  label: string;
  colors: string[];
  currentColor?: string;
  onSelect: (color: string) => void;
}

export type ContextMenuItem = ContextMenuButtonItem | ContextMenuPaletteItem;

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-secondary)',
        borderRadius: 8,
        boxShadow: 'var(--shadow-dropdown)',
        zIndex: 2000,
        minWidth: 160,
        padding: '4px 0',
      }}
    >
      {items.map((item, i) => {
        if (item.type === 'palette') {
          return (
            <div key={i} style={{ padding: '6px 12px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {item.colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      item.onSelect(c);
                      onClose();
                    }}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: item.currentColor === c ? '2px solid var(--text-heading)' : '2px solid transparent',
                      background: c,
                      cursor: 'pointer',
                      padding: 0,
                      outline: item.currentColor === c ? '1px solid var(--bg-primary)' : 'none',
                      outlineOffset: -3,
                    }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          );
        }

        const btn = item as ContextMenuButtonItem;
        return (
          <button
            key={i}
            onClick={() => {
              btn.onClick();
              onClose();
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '0.85rem',
              color: btn.color ?? 'var(--text-primary)',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'transparent';
            }}
          >
            {btn.label}
          </button>
        );
      })}
    </div>
  );
}
