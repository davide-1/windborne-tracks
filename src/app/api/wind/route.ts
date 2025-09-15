import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  const levels = url.searchParams.get("levels") ?? "1000,925,850,700,500,300";
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!lat || !lon || !start || !end) {
    return NextResponse.json({ error: "lat, lon, start, end required" }, { status: 400 });
    }

  const ep = new URL("https://historical-forecast-api.open-meteo.com/v1/forecast");
  ep.searchParams.set("latitude", lat);
  ep.searchParams.set("longitude", lon);
  ep.searchParams.set("start_date", start);
  ep.searchParams.set("end_date", end);
  ep.searchParams.set("timeformat", "unixtime");
  ep.searchParams.set("windspeed_unit", "kmh");
  ep.searchParams.set("hourly", "wind_speed,wind_direction");
  ep.searchParams.set("pressure_level", levels);

  const r = await fetch(ep.toString(), { cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: "open-meteo error", status: r.status }, { status: 502 });
  const data = await r.json();
  return NextResponse.json(data);
}
