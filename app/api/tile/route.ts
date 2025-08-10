import { NextRequest } from "next/server";
import { createClient } from "@libsql/client";

const turso = createClient({
  
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

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

// Helper: Resolve way node coordinates (only for full geometry queries)
function resolveWayCoordinates(osmData: OSMData, isRadiusQuery: boolean = false): OSMData {
  if (!osmData.elements || !Array.isArray(osmData.elements)) {
    return osmData;
  }

  // For radius queries with centroid data, skip coordinate resolution
  if (isRadiusQuery) {
    console.log(`resolveWayCoordinates: Skipping coordinate resolution for radius query (using centroids)`);
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
  let processedWays = 0;
  const processedElements = osmData.elements.map((element: OSMElement): OSMElement => {
    if (element.type === 'way' && element.nodes && Array.isArray(element.nodes)) {
      processedWays++;
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
        
        return {
          ...element,
          nodeCoords: nodeCoords,
          lat: centroidLat,
          lon: centroidLon
        };
      }
    }
    
    return element;
  });

  console.log(`resolveWayCoordinates: Processed ${processedWays} ways`);

  return {
    ...osmData,
    elements: processedElements
  };
}

function processOsmData(osmData: OSMData, isRadiusQuery: boolean = false): OSMData {
  // First resolve way coordinates
  const withCoordinates = resolveWayCoordinates(osmData, isRadiusQuery);
  
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
    
    // Check if this is a radius-based query
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const radius = parseFloat(searchParams.get("radius") || "");
    const innerRadius = parseFloat(searchParams.get("innerRadius") || "0"); // New parameter for ring queries
    
    // Legacy bounding box support (for backward compatibility)
    const minLat = parseFloat(searchParams.get("minLat") || "");
    const minLng = parseFloat(searchParams.get("minLng") || "");
    const maxLat = parseFloat(searchParams.get("maxLat") || "");
    const maxLng = parseFloat(searchParams.get("maxLng") || "");
    
    let bbox;
    let tile_id;
    let isRadiusQuery = false;
    
    if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius)) {
      // Radius-based query (including ring queries)
      isRadiusQuery = true;
      if (innerRadius > 0) {
        tile_id = `ring_${lat.toFixed(5)}_${lng.toFixed(5)}_${innerRadius}-${radius}m`;
      } else {
        tile_id = `radius_${lat.toFixed(5)}_${lng.toFixed(5)}_${radius}m`;
      }
      // For caching purposes, we'll still use a bounding box
      // Calculate approximate bounding box from radius (for cache key)
      const latDelta = radius / 111000; // roughly 111km per degree
      const lngDelta = radius / (111000 * Math.cos(lat * Math.PI / 180));
      bbox = {
        minLat: lat - latDelta,
        minLng: lng - lngDelta,
        maxLat: lat + latDelta,
        maxLng: lng + lngDelta
      };
    } else if (!isNaN(minLat) && !isNaN(minLng) && !isNaN(maxLat) && !isNaN(maxLng)) {
      // Use bounding box from query (legacy support)
      bbox = { minLat, minLng, maxLat, maxLng };
      tile_id = `bbox_${minLat.toFixed(5)}_${minLng.toFixed(5)}_${maxLat.toFixed(5)}_${maxLng.toFixed(5)}_z17`;
    } else {
      return new Response(JSON.stringify({ error: "Missing required parameters. Provide either (lat, lng, radius) or (minLat, minLng, maxLat, maxLng)" }), { status: 400 });
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
    let overpassQuery;
    
    if (isRadiusQuery) {
      // Radius-based query using Overpass around syntax
      if (innerRadius > 0) {
        // Ring query: get elements in outer radius but exclude those in inner radius
        overpassQuery = `[out:json][timeout:30];
        (
          (
            node(around:${radius},${lat},${lng});
            way(around:${radius},${lat},${lng});
            relation(around:${radius},${lat},${lng});
          );
          -
          (
            node(around:${innerRadius},${lat},${lng});
            way(around:${innerRadius},${lat},${lng});
            relation(around:${innerRadius},${lat},${lng});
          );
        );
        out center;`; // Ring search: outer circle minus inner circle
      } else {
        // Standard radius query
        overpassQuery = `[out:json][timeout:30];
        (
          node(around:${radius},${lat},${lng});
          way(around:${radius},${lat},${lng});
          relation(around:${radius},${lat},${lng});
        );
        out center;`; // Use 'center' instead of 'geom' to reduce data size drastically
      }
    } else {
      // Legacy bounding box query
      const bboxStr = bboxString(bbox);
      overpassQuery = `[out:json][timeout:30];
      (
        node(${bboxStr});
        way(${bboxStr});
        relation(${bboxStr});
      );
      (._;>;);
      out geom;`;
    }
    
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    
    // Add timeout and retry logic for Overpass API
    let overpassRes;
    try {
      // Create timeout controller manually for better compatibility
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000); // 35 seconds timeout
      
      overpassRes = await fetch(overpassUrl, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError) {
      console.error("Overpass API fetch timeout or error:", fetchError);
      return new Response(JSON.stringify({ error: "Overpass API timeout - area too large or server overloaded" }), { status: 408 });
    }
    
    if (!overpassRes.ok) {
      const errorText = await overpassRes.text();
      console.error("Overpass API error", errorText);
      if (overpassRes.status === 429) {
        return new Response(JSON.stringify({ error: "Overpass API rate limit - please wait and try again" }), { status: 429 });
      }
      return new Response(JSON.stringify({ error: "Overpass API error" }), { status: 502 });
    }
    
    const osmData = await overpassRes.json();
    console.log(`Overpass API returned ${osmData.elements?.length || 0} elements for ${isRadiusQuery ? `radius ${radius}m` : 'bounding box'} query`);
    
    // Check raw data size
    const jsonSize = JSON.stringify(osmData).length;
    console.log(`Raw JSON size: ${(jsonSize / 1024).toFixed(1)} KB`);

    // Check if dataset is too large before processing
    if (osmData.elements && osmData.elements.length > 50000) {
      console.warn(`Dataset too large: ${osmData.elements.length} elements (max 50,000)`);
      return new Response(JSON.stringify({ 
        error: "Area too large - contains too much data. Please try a smaller area or use specific interests." 
      }), { status: 413 }); // 413 Payload Too Large
    }

    // 3. Process and cache
    let processed;
    try {
      processed = processOsmData(osmData, isRadiusQuery);
      console.log(`Processed ${processed.elements?.length || 0} elements`);
      
      // Check processed data size to prevent database memory issues
      const jsonSize = JSON.stringify(processed).length;
      const jsonSizeMB = jsonSize / (1024 * 1024);
      console.log(`Processed data size: ${jsonSizeMB.toFixed(2)} MB`);
      
      if (jsonSizeMB > 10) {
        console.warn(`Processed data too large: ${jsonSizeMB.toFixed(2)} MB (max 10 MB)`);
        return new Response(JSON.stringify({ 
          error: "Processed data too large for storage. Please try a smaller area or use specific interests." 
        }), { status: 413 });
      }
    } catch (processError) {
      console.error("Error processing OSM data:", processError);
      return new Response(JSON.stringify({ error: "Failed to process OSM data" }), { status: 500 });
    }
    
    try {
      await turso.execute("INSERT OR REPLACE INTO tiles (id, data) VALUES (?, ?)", [tile_id, JSON.stringify(processed)]);
    } catch (dbErr) {
      console.error("Turso DB error", dbErr);
      const errorMessage = String(dbErr);
      if (errorMessage.includes('SQLITE_NOMEM') || errorMessage.includes('out of memory')) {
        return new Response(JSON.stringify({ error: "Data too large for database storage. Please try a smaller area." }), { status: 413 });
      }
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
