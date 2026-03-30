import { useState } from 'react';
import type { ToolbarMode } from '../hooks/useToolbar';
import { exportSvg, exportPng } from '../utils/exportMap';

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
  const isBridgeOrRoad = mode === 'bridge-connect' || mode === 'road-connect';
  const statusText = isBridgeOrRoad
    ? connectionStart
      ? 'End point click...'
      : 'Start point click...'
    : null;

  return (
    <div
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        background: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        flexShrink: 0,
      }}
    >
      {availableModes.map((m) => (
        <button
          key={m}
          onClick={() => onModeChange(m)}
          style={{
            padding: '6px 14px',
            border: mode === m ? '2px solid #023047' : '1px solid #adb5bd',
            borderRadius: 6,
            background: mode === m ? '#023047' : '#fff',
            color: mode === m ? '#fff' : '#333',
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
        </button>
      ))}
      {statusText && (
        <span
          style={{
            marginLeft: 16,
            fontSize: '0.85rem',
            color: '#e76f51',
            fontWeight: 'bold',
          }}
        >
          {statusText}
        </span>
      )}
      {/* Export dropdown */}
      {svgRef && (
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button
            onClick={() => setShowExport(!showExport)}
            style={{
              padding: '6px 14px',
              border: '1px solid #adb5bd',
              borderRadius: 6,
              background: '#fff',
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
                background: '#fff',
                border: '1px solid #ddd',
                borderRadius: 6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
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
          style={{
            marginLeft: svgRef ? 0 : 'auto',
            padding: '4px 10px',
            border: '1px solid #adb5bd',
            borderRadius: 4,
            background: '#fff',
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
  background: '#fff',
  cursor: 'pointer',
  fontSize: '0.85rem',
  textAlign: 'left',
};
