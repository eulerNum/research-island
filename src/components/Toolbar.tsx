import { useState, useEffect } from 'react';
import * as d3 from 'd3';
import type { ToolbarMode } from '../hooks/useToolbar';
import { exportSvg, exportPng } from '../utils/exportMap';
import { useThemeContext } from '../contexts/ThemeContext';

const MODE_LABELS: Record<ToolbarMode, string> = {
  select: 'Select',
  'add-island': '+ Island',
  'bridge-connect': 'Bridge',
  'add-city': '+ City',
  'road-connect': 'Road',
};

const MODE_ICONS: Record<ToolbarMode, string> = {
  select: '\u25CB',      // ○
  'add-island': '\u25CE', // ◎
  'bridge-connect': '\u2194', // ↔
  'add-city': '\u25A1',  // □
  'road-connect': '\u2550', // ═
};

interface ToolbarProps {
  mode: ToolbarMode;
  onModeChange: (mode: ToolbarMode) => void;
  availableModes: ToolbarMode[];
  connectionStart: string | null;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export default function Toolbar({
  mode,
  onModeChange,
  availableModes,
  connectionStart,
  svgRef,
}: ToolbarProps) {
  const [showExport, setShowExport] = useState(false);
  const { theme, toggle } = useThemeContext();
  const isBridgeOrRoad = mode === 'bridge-connect' || mode === 'road-connect';
  const statusText = isBridgeOrRoad
    ? connectionStart
      ? 'End point click...'
      : 'Start point click...'
    : null;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        onModeChange('select');
      } else if (e.key >= '1' && e.key <= String(availableModes.length)) {
        const idx = parseInt(e.key) - 1;
        if (availableModes[idx]) onModeChange(availableModes[idx]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onModeChange, availableModes]);

  return (
    <div
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-primary)',
        flexShrink: 0,
      }}
    >
      {availableModes.map((m, i) => (
        <button
          key={m}
          onClick={() => onModeChange(m)}
          title={`${MODE_LABELS[m]} (${i + 1})`}
          style={{
            padding: '6px 14px',
            border: mode === m ? '2px solid var(--btn-active-bg)' : '1px solid var(--btn-secondary-border)',
            borderRadius: 6,
            background: mode === m ? 'var(--btn-active-bg)' : 'var(--btn-secondary-bg)',
            color: mode === m ? 'var(--btn-active-text)' : 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: mode === m ? 'bold' : 'normal',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>{MODE_ICONS[m]}</span>
          {MODE_LABELS[m]}
          <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>{i + 1}</span>
        </button>
      ))}
      {statusText && (
        <span
          style={{
            marginLeft: 16,
            fontSize: '0.85rem',
            color: 'var(--accent-backward)',
            fontWeight: 'bold',
          }}
        >
          {statusText}
        </span>
      )}
      {/* Theme toggle + Fit to view + Export */}
      {svgRef && (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={toggle}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--btn-secondary-border)',
              borderRadius: 6,
              background: 'var(--btn-secondary-bg)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button
            onClick={() => {
              if (!svgRef.current) return;
              const svg = svgRef.current;
              const sel = d3.select(svg);
              const gEl = svg.querySelector('g');
              if (!gEl) return;
              const bbox = gEl.getBBox();
              const svgW = svg.clientWidth || 800;
              const svgH = svg.clientHeight || 600;
              const padding = 40;
              const scale = Math.min(
                (svgW - padding * 2) / (bbox.width || 1),
                (svgH - padding * 2) / (bbox.height || 1),
                2,
              );
              const tx = svgW / 2 - (bbox.x + bbox.width / 2) * scale;
              const ty = svgH / 2 - (bbox.y + bbox.height / 2) * scale;
              const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

              const realZoom = d3.zoom<SVGSVGElement, unknown>()
                .scaleExtent([0.3, 5])
                .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
                  d3.select(svg).select('g').attr('transform', event.transform.toString());
                });
              sel.call(realZoom);
              sel.transition().duration(500).call(realZoom.transform, transform);
            }}
            title="Fit to View (전체 보기)"
            style={{
              padding: '6px 12px',
              border: '1px solid var(--btn-secondary-border)',
              borderRadius: 6,
              background: 'var(--btn-secondary-bg)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Fit
          </button>
        </div>
      )}
      {svgRef && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowExport(!showExport)}
            style={{
              padding: '6px 14px',
              border: '1px solid var(--btn-secondary-border)',
              borderRadius: 6,
              background: 'var(--btn-secondary-bg)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Export
          </button>
          {showExport && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: 'var(--bg-dropdown)',
                border: '1px solid var(--border-secondary)',
                borderRadius: 6,
                boxShadow: 'var(--shadow-dropdown)',
                zIndex: 100,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => {
                  if (svgRef.current) exportSvg(svgRef.current);
                  setShowExport(false);
                }}
                style={exportItemStyle}
              >
                SVG
              </button>
              <button
                onClick={() => {
                  if (svgRef.current) exportPng(svgRef.current);
                  setShowExport(false);
                }}
                style={exportItemStyle}
              >
                PNG
              </button>
            </div>
          )}
        </div>
      )}

      {mode !== 'select' && (
        <button
          onClick={() => onModeChange('select')}
          title="Select mode (ESC)"
          style={{
            padding: '4px 10px',
            border: '1px solid var(--btn-secondary-border)',
            borderRadius: 4,
            background: 'var(--btn-secondary-bg)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          ESC
        </button>
      )}
    </div>
  );
}

const exportItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 20px',
  border: 'none',
  background: 'var(--bg-dropdown)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: '0.85rem',
  textAlign: 'left',
};
