
'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type Balloon = {
  id: string;
  points: { t: number; lat: number; lon: number }[];
  latest?: { t: number; lat: number; lon: number };
};

export type MapProps = { balloons: Balloon[] };

// Default marker icons from /public
const DefaultIcon = L.icon({
  iconUrl: '/marker-icon.png',
  iconRetinaUrl: '/marker-icon-2x.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function Map({ balloons }: MapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Call all hooks on every render (no early return before this)
  const safeBalloons = useMemo(() => {
    const isNum = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
    const cleaned = balloons.filter((b) => {
      const lat = b.latest?.lat, lon = b.latest?.lon;
      return isNum(lat) && isNum(lon) && Math.abs(lat as number) <= 90 && Math.abs(lon as number) <= 180;
    });
    return cleaned.slice(0, 300);
  }, [balloons]);

  return (
    // Full height to avoid black band
    <div style={{ height: '100%' }}>
      {mounted && (
        <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {safeBalloons.map((b) => {
            const { lat, lon, t } = b.latest!;
            return (
              <Marker key={b.id} position={[lat, lon]}>
                <Popup>
                  <div><b>ID:</b> {b.id}</div>
                  <div>Lat: {lat.toFixed(4)}°</div>
                  <div>Lon: {lon.toFixed(4)}°</div>
                  {typeof t === 'number' && <div>Updated: {new Date(t * 1000).toLocaleString()}</div>}
                </Popup>
                <Tooltip>{`${lat.toFixed(3)}, ${lon.toFixed(3)}`}</Tooltip>
              </Marker>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
}
