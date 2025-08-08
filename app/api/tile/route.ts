import { NextRequest } from "next/server";
import { createClient } from "@libsql/client";

const turso = createClient({
  
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

// Helper: Calculate bounding box for a tile (zoom = 17)
function calculateBoundingBox(lat: number, lng: number) {
  // Use a larger delta for zoom 17 to ensure OSM data is present
  const delta = 0.002; // adjust as needed for zoom 17
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

// Helper: Process OSM data and resolve way coordinates
interface OSMElement {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
  nodeCoords?: Array<{ lat: number; lon: number }>;
  members?: Array<{
    type: string;
    ref: number;
    role: string;
    lat?: number;
    lon?: number;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
  geometry?: Array<{ lat: number; lon: number }>;
}

interface OSMData {
  elements: OSMElement[];
  [key: string]: unknown;
}

// Helper: Calculate centroid for relations
function calculateRelationCentroid(relation: OSMElement): { lat: number; lon: number } | null {
  const allCoords: Array<{ lat: number; lon: number }> = [];
  
  // Collect coordinates from relation geometry if available (from "out geom")
  if (relation.geometry && Array.isArray(relation.geometry)) {
    allCoords.push(...relation.geometry);
  }
  
  // Collect coordinates from members if they have geometry
  if (relation.members && Array.isArray(relation.members)) {
    for (const member of relation.members) {
      if (member.geometry && Array.isArray(member.geometry)) {
        allCoords.push(...member.geometry);
      } else if (member.lat !== undefined && member.lon !== undefined) {
        allCoords.push({ lat: member.lat, lon: member.lon });
      }
    }
  }
  
  // If no coordinates found from geometry/members, try to estimate from member ways
  // This is a fallback for when Overpass doesn't provide geometry
  if (allCoords.length === 0 && relation.members && Array.isArray(relation.members)) {
    // For now, we'll return null and let the relation be filtered out
    // A more sophisticated approach would require resolving member coordinates
    console.log('No geometry found for relation', relation.id, 'with', relation.members.length, 'members');
    return null;
  }
  
  if (allCoords.length === 0) {
    return null;
  }
  
  // Calculate centroid
  const sumLat = allCoords.reduce((sum, coord) => sum + coord.lat, 0);
  const sumLon = allCoords.reduce((sum, coord) => sum + coord.lon, 0);
  
  return {
    lat: sumLat / allCoords.length,
    lon: sumLon / allCoords.length
  };
}

// Helper: Resolve way node coordinates
function resolveWayCoordinates(osmData: OSMData): OSMData {
  if (!osmData.elements || !Array.isArray(osmData.elements)) {
    return osmData;
  }

  // Create a map of node ID -> coordinates for fast lookup
  const nodeMap = new Map<number, { lat: number; lon: number }>();
  
  // First pass: collect all nodes
  osmData.elements.forEach((element: OSMElement) => {
    if (element.type === 'node' && element.lat !== undefined && element.lon !== undefined) {
      nodeMap.set(element.id, { lat: element.lat, lon: element.lon });
    }
  });
  
  console.log(`resolveWayCoordinates: Found ${nodeMap.size} nodes for coordinate lookup`);

  // Second pass: resolve way coordinates and calculate centroids
  const processedElements = osmData.elements.map((element: OSMElement): OSMElement => {
    if (element.type === 'way' && element.nodes && Array.isArray(element.nodes)) {
      console.log(`Processing way ${element.id} with ${element.nodes.length} nodes`);
      // Resolve node coordinates for this way
      const nodeCoords: Array<{ lat: number; lon: number }> = [];
      
      element.nodes.forEach((nodeId: number) => {
        const nodeCoord = nodeMap.get(nodeId);
        if (nodeCoord) {
          nodeCoords.push(nodeCoord);
        }
      });
      
      // Add nodeCoords to the way element if we found coordinates
      if (nodeCoords.length > 0) {
        // Calculate centroid for the way
        const sumLat = nodeCoords.reduce((sum, coord) => sum + coord.lat, 0);
        const sumLon = nodeCoords.reduce((sum, coord) => sum + coord.lon, 0);
        const centroidLat = sumLat / nodeCoords.length;
        const centroidLon = sumLon / nodeCoords.length;
        
        console.log(`Way ${element.id}: calculated centroid lat=${centroidLat}, lon=${centroidLon} from ${nodeCoords.length} nodes`);
        
        return {
          ...element,
          nodeCoords: nodeCoords,
          lat: centroidLat,
          lon: centroidLon
        };
      } else {
        console.log(`Way ${element.id}: no node coordinates found`);
      }
    }
    
    return element;
  });

  return {
    ...osmData,
    elements: processedElements
  };
}

function processOsmData(osmData: OSMData): OSMData {
  // First resolve way coordinates
  const withCoordinates = resolveWayCoordinates(osmData);
  
  // Process relations and add centroids
  const processedElements = Array.isArray(withCoordinates.elements)
    ? withCoordinates.elements.map((element) => {
        if (element.type === 'relation') {
          const centroid = calculateRelationCentroid(element);
          if (centroid) {
            return {
              ...element,
              lat: centroid.lat,
              lon: centroid.lon
            };
          }
        }
        return element;
      })
    : [];
  
  // Then filter out elements with exactly one key
  const filteredElements = processedElements.filter((el) =>
    el && typeof el === "object" && Object.keys(el).length !== 1
  );
  
  return { ...withCoordinates, elements: filteredElements };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const minLat = parseFloat(searchParams.get("minLat") || "");
    const minLng = parseFloat(searchParams.get("minLng") || "");
    const maxLat = parseFloat(searchParams.get("maxLat") || "");
    const maxLng = parseFloat(searchParams.get("maxLng") || "");
    let bbox;
    let tile_id;
    if (!isNaN(minLat) && !isNaN(minLng) && !isNaN(maxLat) && !isNaN(maxLng)) {
      // Use bounding box from query
      bbox = { minLat, minLng, maxLat, maxLng };
      tile_id = `bbox_${minLat.toFixed(5)}_${minLng.toFixed(5)}_${maxLat.toFixed(5)}_${maxLng.toFixed(5)}_z17`;
    } else {
      const lat = parseFloat(searchParams.get("lat") || "");
      const lng = parseFloat(searchParams.get("lng") || "");
      if (isNaN(lat) || isNaN(lng)) {
        return new Response(JSON.stringify({ error: "Missing or invalid lat/lng or bounding box" }), { status: 400 });
      }
      bbox = calculateBoundingBox(lat, lng);
      tile_id = `tile_${lat.toFixed(5)}_${lng.toFixed(5)}_z17`;
    }

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
    const bboxStr = bboxString(bbox);
    // Query to get nodes, ways, and relations with their full geometry
    const overpassQuery = `[out:json][timeout:15];
    (
      node(${bboxStr});
      way(${bboxStr});
      relation(${bboxStr});
    );
    (._;>;);
    out geom;`;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
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
