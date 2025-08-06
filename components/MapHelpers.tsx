"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

// Type definitions
export type NodeCoords = Array<{ lat: number; lon: number }>;
export type TileBounds = [[number, number], [number, number]];
export type TileCoords = { xtile: number; ytile: number };

// Helper to compute center of a way element
export function getWayCenter(nodeCoords: NodeCoords): { lat: number; lon: number } | null {
  if (!nodeCoords || nodeCoords.length === 0) return null;
  
  // For simple cases (lines or small polygons), use arithmetic centroid
  if (nodeCoords.length <= 3) {
    const sum = nodeCoords.reduce((acc, node) => ({
      lat: acc.lat + node.lat,
      lon: acc.lon + node.lon
    }), { lat: 0, lon: 0 });
    return {
      lat: sum.lat / nodeCoords.length,
      lon: sum.lon / nodeCoords.length
    };
  }
  
  // For polygons with 4+ nodes, use geometric centroid for better accuracy
  // Check if it's a closed polygon (first and last points are the same)
  const isClosedPolygon = nodeCoords.length >= 4 && 
    Math.abs(nodeCoords[0].lat - nodeCoords[nodeCoords.length - 1].lat) < 0.0001 &&
    Math.abs(nodeCoords[0].lon - nodeCoords[nodeCoords.length - 1].lon) < 0.0001;
  
  if (isClosedPolygon) {
    // Calculate polygon centroid using the shoelace formula
    let area = 0;
    let centroidLat = 0;
    let centroidLon = 0;
    
    for (let i = 0; i < nodeCoords.length - 1; i++) {
      const curr = nodeCoords[i];
      const next = nodeCoords[i + 1];
      const crossProduct = curr.lon * next.lat - next.lon * curr.lat;
      area += crossProduct;
      centroidLat += (curr.lat + next.lat) * crossProduct;
      centroidLon += (curr.lon + next.lon) * crossProduct;
    }
    
    area = area / 2;
    if (Math.abs(area) < 0.000001) {
      // Fallback to arithmetic centroid for degenerate polygons
      const sum = nodeCoords.reduce((acc, node) => ({
        lat: acc.lat + node.lat,
        lon: acc.lon + node.lon
      }), { lat: 0, lon: 0 });
      return {
        lat: sum.lat / nodeCoords.length,
        lon: sum.lon / nodeCoords.length
      };
    }
    
    return {
      lat: centroidLat / (6 * area),
      lon: centroidLon / (6 * area)
    };
  } else {
    // For open ways (lines), use arithmetic centroid
    const sum = nodeCoords.reduce((acc, node) => ({
      lat: acc.lat + node.lat,
      lon: acc.lon + node.lon
    }), { lat: 0, lon: 0 });
    return {
      lat: sum.lat / nodeCoords.length,
      lon: sum.lon / nodeCoords.length
    };
  }
}

// Convert latitude/longitude to tile coordinates
export function latLngToTile(lat: number, lng: number, zoom: number): TileCoords {
  const n = Math.pow(2, zoom);
  const xtile = Math.floor(((lng + 180) / 360) * n);
  const ytile = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n
  );
  return { xtile, ytile };
}

// Get bounds of a tile given its coordinates
export function getTileBoundsXY(xtile: number, ytile: number, zoom: number): TileBounds {
  const n = Math.pow(2, zoom);
  const lon1 = (xtile / n) * 360 - 180;
  const lat1 = (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - (2 * ytile) / n)));
  const lon2 = ((xtile + 1) / n) * 360 - 180;
  const lat2 = (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - (2 * (ytile + 1)) / n)));
  return [
    [lat1, lon1],
    [lat2, lon2],
  ];
}

// Helper to estimate area covered by tiles (in m²)
export function getTileAreaSqMeters(
  zoom: number, 
  lat: number, 
  tilesChecked: number, 
  position: [number, number] | null
): number {
  // OSM tile size is 256x256 pixels, but we want area in meters
  // At zoom 17, tile width in degrees: 360 / 2^17
  // Use approximate formula for area at latitude
  const tileCount = tilesChecked;
  if (!position || tileCount === 0) return 0;
  
  // Calculate tile width in degrees
  const tileWidthDeg = 360 / Math.pow(2, zoom);
  // Calculate tile height in degrees
  const tileHeightDeg = 180 / Math.pow(2, zoom - 1);
  // Convert degrees to meters at given latitude
  const latRad = lat * Math.PI / 180;
  const metersPerDegLat = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
  const metersPerDegLon = 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);
  const tileWidthMeters = tileWidthDeg * metersPerDegLon;
  const tileHeightMeters = tileHeightDeg * metersPerDegLat;
  const areaPerTile = tileWidthMeters * tileHeightMeters;
  return areaPerTile * tileCount;
}

// Calculate tile bounds for a grid around a position
export function calculateTileBounds(
  position: [number, number], 
  gridSize: number, 
  zoomLevel: number
): TileBounds | null {
  if (!position) return null;
  
  const { xtile, ytile } = latLngToTile(position[0], position[1], zoomLevel);
  const range = Math.floor(gridSize / 2);
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  
  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      const x = xtile + dx;
      const y = ytile + dy;
      const [[lat1, lng1], [lat2, lng2]] = getTileBoundsXY(x, y, zoomLevel);
      minLat = Math.min(minLat, lat1, lat2);
      maxLat = Math.max(maxLat, lat1, lat2);
      minLng = Math.min(minLng, lng1, lng2);
      maxLng = Math.max(maxLng, lng1, lng2);
    }
  }
  
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

// Component: CenterMap helper for centering the map on a position
interface CenterMapProps {
  position: [number, number];
}

export function CenterMap({ position }: CenterMapProps) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);
  return null;
}

// Component: FitBoundsListener for listening to fit bounds events
export function FitBoundsListener() {
  const map = useMap();
  useEffect(() => {
    const handler = (e: CustomEvent<TileBounds>) => {
      if (e.detail) {
        map.fitBounds(e.detail, { animate: true, padding: [40, 40] });
      }
    };
    window.addEventListener('fitTileBounds', handler as EventListener);
    return () => window.removeEventListener('fitTileBounds', handler as EventListener);
  }, [map]);
  return null;
}
