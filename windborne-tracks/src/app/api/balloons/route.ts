

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FlightPoint = { id: string; t: number; lat: number; lon: number };

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const BASE = "https://a.windbornesystems.com/treasure";

const R = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
function speedKmH(a: FlightPoint, b: FlightPoint) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
  const dist = 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  const dtH = Math.max(1e-6, (b.t - a.t)) / 3600;
  return dist / dtH;
}
const wrapLon = (x: number) => ((x + 540) % 360) - 180;

function salvageRows(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (json && typeof json === "object") {
    const all: any[] = [];
    for (const v of Object.values(json)) if (Array.isArray(v)) all.push(...v);
    if (all.length) return all;
  }
  return [];
}

function parseAllArraysFromText(text: string): any[] {
  const arrays: any[] = [];
  const re = /\[[\s\S]*?\]/g;
  const matches = text.match(re);
  if (matches) {
    for (const m of matches) {
      try {
        const a = JSON.parse(m);
        if (Array.isArray(a)) arrays.push(...a);
      } catch {}
    }
  }
  if (!arrays.length) {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const s = line.trim();
      if (!s || s[0] !== "{") continue;
      try { arrays.push(JSON.parse(s)); } catch {}
    }
  }
  return arrays;
}

// Try to pull {lat,lon,t,id} from either arrays or objects
function coercePoint(row: any, fallbackT: number, hh: string, idx: number): FlightPoint | null {
  // Case A: array like [lat, lon, maybeId]
  if (Array.isArray(row)) {
    const [a,b,c] = row;
    const lat = Number(a);
    const lon0 = Number(b);
    if (Number.isFinite(lat) && Number.isFinite(lon0)) {
      const lon = wrapLon(lon0);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        const id = (c != null ? String(c) : `arr-${hh}-${idx}`);
        return { id, t: fallbackT, lat, lon };
      }
    }
    return null;
  }

  // Case B: object with keys
  const n = (x: any) => (typeof x === "number" && Number.isFinite(x)) ? x : Number.isFinite(+x) ? +x : NaN;
  const latKeys = ["lat","latitude","Lat","y"];
  const lonKeys = ["lon","lng","longitude","Long","x"];
  let lat: number | null = null, lon: number | null = null;
  for (const k of latKeys) if (lat == null && row[k] != null) {
    const v = n(row[k]);
    if (Number.isFinite(v)) lat = v;
  }
  for (const k of lonKeys) if (lon == null && row[k] != null) {
    const v = n(row[k]);
    if (Number.isFinite(v)) lon = wrapLon(v);
  }
  if (lat == null || lon == null) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  // time (prefer valid epoch seconds; else fallback to file hour)
  const timeCands = [row.t, row.ts, row.time, row.timestamp, row.date, row.dt, row.epoch, row.ms];
  let t: number | null = null;
  for (const c of timeCands) {
    if (typeof c === "number" && Number.isFinite(c)) {
      t = c > 1e12 ? Math.floor(c/1000) : (c > 1e9 && c < 4e9) ? Math.floor(c) : null;
      if (t) break;
    }
    if (typeof c === "string") {
      const num = +c;
      if (!Number.isNaN(num)) {
        t = num > 1e12 ? Math.floor(num/1000) : (num > 1e9 && num < 4e9) ? Math.floor(num) : null;
        if (t) break;
      }
      const d = Date.parse(c);
      if (!Number.isNaN(d)) { t = Math.floor(d/1000); break; }
    }
  }
  if (!t) t = fallbackT;

  // id
  const id = [row.id, row.i, row.name, row.device_id, row.balloon_id, row.serial, row.unit_id]
    .map(v => (v == null ? null : String(v))).find(Boolean) || `obj-${hh}-${idx}`;

  return { id, t, lat, lon };
}

async function fetchHour(hh: string) {
  const url = `${BASE}/${hh}.json`;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: ac.signal, cache: "no-store",
      headers: {
        "Accept": "application/json,text/plain;q=0.8,*/*;q=0.5",
        "User-Agent": "Mozilla/5.0 (compatible; WindborneChallenge/1.0)"
      }
    });
    const text = await res.text();

    let rows: any[] = [];
    try { rows = salvageRows(JSON.parse(text)); }
    catch { rows = parseAllArraysFromText(text); }

    // Timestamp: align to "hh hours ago" from NOW
    const fallbackT = Math.floor(Date.now()/1000) - parseInt(hh, 10) * 3600;

    const out: FlightPoint[] = [];
    rows.forEach((row, i) => {
      const p = coercePoint(row, fallbackT, hh, i);
      if (p) out.push(p);
    });
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(to);
  }
}

export async function GET(req: NextRequest) {
  const results = await Promise.all(HOURS.map(fetchHour));
  const all: FlightPoint[] = results.flat();

  // group → sort → relaxed teleport filter
  const byId = new Map<string, FlightPoint[]>();
  for (const p of all) {
    const a = byId.get(p.id) || [];
    a.push(p);
    byId.set(p.id, a);
  }

  const balloons = [...byId.entries()].map(([id, pts]) => {
    const sorted = pts.sort((a,b) => a.t - b.t);

    // de-dup exact duplicates
    const dedup: FlightPoint[] = [];
    for (const p of sorted) {
      const prev = dedup[dedup.length - 1];
      if (prev && prev.t === p.t && prev.lat === p.lat && prev.lon === p.lon) continue;
      dedup.push(p);
    }

    // allow up to 1000 km/h to avoid over-pruning
    const cleaned: FlightPoint[] = [];
    for (let i=0;i<dedup.length;i++) {
      if (i===0) { cleaned.push(dedup[i]); continue; }
      const v = speedKmH(dedup[i-1], dedup[i]);
      if (Number.isFinite(v) && v < 1000) cleaned.push(dedup[i]);
    }

    const latest = cleaned.at(-1) ?? null;
    return { id, points: cleaned, latest };
  }).filter(b => b.points.length >= 1);

  return NextResponse.json({ updatedAt: Date.now(), balloons });
}
