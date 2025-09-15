
"use client";
import useSWR from "swr";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { MapProps } from "./ui/Map"; 

const Map = dynamic<MapProps>(() => import("./ui/Map"), { ssr: false }); // <-- type it

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function Page() {
  const { data, error, isLoading } = useSWR("/api/balloons", fetcher, {
    refreshInterval: 10 * 60 * 1000
  });

  const balloons = useMemo(() => (data?.balloons ?? []), [data]);

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <div className="panel">
        <div><b>WindBorne Tracks + Winds</b></div>
        <div>• Last 24h of balloon positions (robust ingestion)</div>
        <div>• Click a track → compute best-fit <b>pressure level</b> (1000→300 hPa)</div>
        <div>• Auto-refreshes every 10 minutes</div>
        {error && <div className="bad">Failed to load balloon data.</div>}
        {isLoading && <div>Loading…</div>}
        {data?.updatedAt && <div style={{ opacity: .8 }}>Updated: {new Date(data.updatedAt).toLocaleString()}</div>}
      </div>
      <Map balloons={balloons} /> 
      <div className="legend">
        <div><b>Legend</b></div>
        <div>1000 hPa → 300 hPa: red → violet</div>
        <div><span className="good">Δθ small</span> = good match; <span className="bad">Δθ big</span> = anomaly</div>
      </div>
    </div>
  );
}
