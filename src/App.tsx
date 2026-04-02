// v2 — AI chat + deep search
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeContext } from './contexts/ThemeContext';
import { useTheme } from './hooks/useTheme';
import HomePage from './pages/HomePage';
import MapWrapper from './pages/MapWrapper';
import './App.css';

function App() {
  const themeActions = useTheme();

  return (
    <ThemeContext.Provider value={themeActions}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/map/:mapId/*" element={<MapWrapper />} />
        </Routes>
      </BrowserRouter>
    </ThemeContext.Provider>
  );
}

export default App;
