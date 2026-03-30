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
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        zIndex: 2000,
        minWidth: 160,
        padding: '4px 0',
      }}
    >
      {items.map((item, i) => {
        if (item.type === 'palette') {
          return (
            <div key={i} style={{ padding: '6px 12px' }}>
              <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 4 }}>
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
                      border: item.currentColor === c ? '2px solid #023047' : '2px solid transparent',
                      background: c,
                      cursor: 'pointer',
                      padding: 0,
                      outline: item.currentColor === c ? '1px solid #fff' : 'none',
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
              color: btn.color ?? '#333',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = '#f0f0f0';
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
