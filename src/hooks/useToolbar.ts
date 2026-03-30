import { useState, useCallback } from 'react';

export type ToolbarMode =
  | 'select'
  | 'add-island'
  | 'bridge-connect'
  | 'add-city'
  | 'road-connect';

export function useToolbar() {
  const [mode, setMode] = useState<ToolbarMode>('select');
  const [connectionStart, setConnectionStart] = useState<string | null>(null);

  const resetConnection = useCallback(() => {
    setConnectionStart(null);
    setMode('select');
  }, []);

  return { mode, setMode, connectionStart, setConnectionStart, resetConnection };
}
