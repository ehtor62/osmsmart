import { NextRequest } from "next/server";
import { createClient } from "@libsql/client";

const turso = createClient({
  
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

// Helper: Calculate bounding box for a tile (simple example for z=13)
function calculateBoundingBox(lat: number, lng: number) {
  // Use a larger delta for zoom 17 to ensure OSM data is present
  const delta = 0.002; // smaller box for high zoom, but larger than before
  return {
    minLat: lat - delta,
    minLng: lng - delta,
    maxLat: lat + delta,
    maxLng: lng + delta,
  };
}

// Helper: Format Overpass bounding box string
function bboxString(bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }) {
  return `${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}`;
}

// Helper: Process OSM data (identity for demo)
interface OSMData {
  elements: unknown[];
  [key: string]: unknown;
}
function processOsmData(osmData: OSMData): OSMData {
  // Filter out elements with exactly one key
  const filteredElements = Array.isArray(osmData.elements)
    ? osmData.elements.filter((el) =>
        el && typeof el === "object" && Object.keys(el).length !== 1
      )
    : [];
  return { ...osmData, elements: filteredElements };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    if (isNaN(lat) || isNaN(lng)) {
      return new Response(JSON.stringify({ error: "Missing or invalid lat/lng" }), { status: 400 });
    }

    const tile_id = `tile_${lat.toFixed(5)}_${lng.toFixed(5)}_z13`;

    // 1. Check Turso for cached tile
    const cached = await turso.execute("SELECT data FROM tiles WHERE id = ?", [tile_id]);
    if (cached.rows.length > 0) {
      // Ensure cached data is returned as a string
      return new Response(
        typeof cached.rows[0].data === "string"
          ? cached.rows[0].data
          : JSON.stringify(cached.rows[0].data),
        {
          status: 200,
          headers: { "Content-Type": "application/json", "X-Cache": "hit" },
        }
      );
    }

    // 2. Cache MISS: Generate tile
    const bbox = calculateBoundingBox(lat, lng);
    const bboxStr = bboxString(bbox);
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];(node(${bboxStr});way(${bboxStr});relation(${bboxStr}););out;`;
    const overpassRes = await fetch(overpassUrl);
    if (!overpassRes.ok) {
      console.error("Overpass API error", await overpassRes.text());
      return new Response(JSON.stringify({ error: "Overpass API error" }), { status: 502 });
    }
    const osmData = await overpassRes.json();
    console.log("Overpass OSM Data:", osmData); // Debug log

    // 3. Process and cache
    const processed = processOsmData(osmData);
    try {
      await turso.execute("INSERT OR REPLACE INTO tiles (id, data) VALUES (?, ?)", [tile_id, JSON.stringify(processed)]);
    } catch (dbErr) {
      console.error("Turso DB error", dbErr);
      return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
    }

    // 4. Respond
    return new Response(JSON.stringify(processed), {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Cache": "miss" },
    });
  } catch (err) {
    console.error("API route error", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
