import { createContext, useContext } from 'react';

export interface ThemeContextValue {
  theme: 'light' | 'dark';
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggle: () => {} });

export function useThemeContext(): ThemeContextValue {
  return useContext(ThemeContext);
}
