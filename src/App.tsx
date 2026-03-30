import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MapDataContext } from './contexts/MapDataContext';
import { useMapData } from './hooks/useMapData';
import OverviewPage from './pages/OverviewPage';
import IslandDetailPage from './pages/IslandDetailPage';
import './App.css';

function App() {
  const mapDataActions = useMapData();

  return (
    <MapDataContext.Provider value={mapDataActions}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/island/:id" element={<IslandDetailPage />} />
        </Routes>
      </BrowserRouter>
    </MapDataContext.Provider>
  );
}

export default App;
