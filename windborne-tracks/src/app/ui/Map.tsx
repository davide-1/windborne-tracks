// "use client";

// import { MapContainer, TileLayer, Polyline, Tooltip, Marker } from "react-leaflet";
// import type { LatLngExpression } from "leaflet";
// import { useMemo, useState } from "react";

// type P = { lat: number; lon: number; t: number };
// type Balloon = { id: string; points: P[]; latest?: P | null };

// function bearingDeg(a: P, b: P) {
//   const toRad = (d: number) => (d * Math.PI) / 180;
//   const toDeg = (r: number) => (r * 180) / Math.PI;
//   const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
//   const λ1 = toRad(a.lon), λ2 = toRad(b.lon);
//   const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
//   const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
//   return (toDeg(Math.atan2(y, x)) + 360) % 360;
// }

// function angDiff(a: number, b: number) {
//   let d = Math.abs(a - b) % 360;
//   return d > 180 ? 360 - d : d;
// }

// export default function Map({ balloons }: { balloons: Balloon[] }) {
//   const [status, setStatus] = useState<string>("");

//   const center: LatLngExpression = [20, 0];

//   const onClickTrack = async (b: Balloon) => {
//     try {
//       setStatus(`Computing winds for ${b.id}…`);
//       const pts = b.points;
//       if (pts.length < 1) return;

//       const end = new Date((pts[pts.length - 1].t) * 1000);
//       const start = new Date(end.getTime() - 24 * 3600 * 1000);
//       const iso = (d: Date) => d.toISOString().slice(0, 10);

//       const { lat, lon } = pts[pts.length - 1];
//       const levels = "1000,925,850,700,500,300";
//       const url = `/api/wind?lat=${lat}&lon=${lon}&levels=${levels}&start=${iso(start)}&end=${iso(end)}`;
//       const wind = await fetch(url).then(r => r.json());

//       const times: number[] = wind?.hourly?.time ?? [];
//       const dirByLevel: Record<string, number[]> = wind?.hourly?.wind_direction ?? {};

//       const nearestIndex = (tSec: number) => {
//         if (!times.length) return -1;
//         let lo = 0, hi = times.length - 1;
//         while (lo < hi) {
//           const mid = (lo + hi) >> 1;
//           if (times[mid] < tSec) lo = mid + 1; else hi = mid;
//         }
//         const i = lo, j = Math.max(0, i - 1);
//         return Math.abs(times[i] - tSec) < Math.abs(times[j] - tSec) ? i : j;
//       };

//       const agg: Record<string, { sum: number; n: number }> = {};
//       for (let i = 0; i < pts.length - 1; i++) {
//         const a = pts[i], c = pts[i + 1];
//         const midT = (a.t + c.t) / 2;
//         const drift = bearingDeg(a, c);
//         const j = nearestIndex(midT);
//         if (j < 0) continue;
//         for (const lvl of ["1000","925","850","700","500","300"]) {
//           const wd = dirByLevel?.[lvl]?.[j];
//           if (wd == null) continue;
//           const dθ = angDiff(drift, wd);
//           (agg[lvl] ??= { sum: 0, n: 0 });
//           agg[lvl].sum += dθ; agg[lvl].n += 1;
//         }
//       }

//       let best = "1000", bestMean = Infinity;
//       for (const [lvl, s] of Object.entries(agg)) {
//         if (!s.n) continue;
//         const m = s.sum / s.n;
//         if (m < bestMean) { bestMean = m; best = lvl; }
//       }
//       setStatus(`${b.id}: best-fit ≈ ${best} hPa (mean Δθ ≈ ${Number.isFinite(bestMean) ? bestMean.toFixed(0) : "—"}°)`);
//     } catch (e: any) {
//       setStatus(`Error: ${e.message ?? e}`);
//     }
//   };

//   const shapes = useMemo(() =>
//     balloons.map(b => ({
//       id: b.id,
//       latlngs: b.points.map(p => [p.lat, p.lon]) as [number, number][],
//       updated: b.latest?.t
//     })), [balloons]);

//   return (
//     <>
//       <MapContainer center={center} zoom={2} style={{ height: "100%", width: "100%" }}>
//         <TileLayer
//           url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//           attribution="© OpenStreetMap"
//         />
//         {shapes.map(s => {
//           if (s.latlngs.length >= 2) {
//             return (
//               <Polyline
//                 key={s.id}
//                 positions={s.latlngs}
//                 weight={2}
//                 pathOptions={{ color: "#2dd4bf" }}
//                 eventHandlers={{ click: () => onClickTrack(balloons.find(b => b.id === s.id)!)}}
//               >
//                 <Tooltip sticky>
//                   <div>
//                     <b>{s.id}</b><div>Pts: {s.latlngs.length}</div>
//                     {s.updated && <div>Updated: {new Date(s.updated * 1000).toUTCString()}</div>}
//                     <div>Click to compute best-fit pressure level</div>
//                   </div>
//                 </Tooltip>
//               </Polyline>
//             );
//           } else if (s.latlngs.length === 1) {
//             const [lat, lon] = s.latlngs[0];
//             return (
//               <Marker
//                 key={s.id}
//                 position={[lat, lon] as LatLngExpression}
//                 eventHandlers={{ click: () => onClickTrack(balloons.find(b => b.id === s.id)!)}}
//               >
//                 <Tooltip sticky>
//                   <div><b>{s.id}</b><div>Pts: 1</div><div>Click to compute best-fit level</div></div>
//                 </Tooltip>
//               </Marker>
//             );
//           }
//           return null;
//         })}
//       </MapContainer>
//       {status && (
//         <div className="panel" style={{ top: "unset", bottom: 12, right: 12, left: "unset" }}>
//           {status}
//         </div>
//       )}
//     </>
//   );
// }





// src/app/ui/Map.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useMapEvents } from 'react-leaflet';
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
