import { Routes, Route, useParams } from 'react-router-dom';
import { MapDataContext } from '../contexts/MapDataContext';
import { useMapData } from '../hooks/useMapData';
import OverviewPage from './OverviewPage';
import IslandDetailPage from './IslandDetailPage';

export default function MapWrapper() {
  const { mapId } = useParams<{ mapId: string }>();
  const mapDataActions = useMapData(mapId);

  return (
    <MapDataContext.Provider value={mapDataActions}>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/island/:id" element={<IslandDetailPage />} />
      </Routes>
    </MapDataContext.Provider>
  );
}
