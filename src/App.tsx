import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MapDataContext } from './contexts/MapDataContext';
import { ThemeContext } from './contexts/ThemeContext';
import { useMapData } from './hooks/useMapData';
import { useTheme } from './hooks/useTheme';
import OverviewPage from './pages/OverviewPage';
import IslandDetailPage from './pages/IslandDetailPage';
import './App.css';

function App() {
  const mapDataActions = useMapData();
  const themeActions = useTheme();

  return (
    <ThemeContext.Provider value={themeActions}>
      <MapDataContext.Provider value={mapDataActions}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/island/:id" element={<IslandDetailPage />} />
          </Routes>
        </BrowserRouter>
      </MapDataContext.Provider>
    </ThemeContext.Provider>
  );
}

export default App;
