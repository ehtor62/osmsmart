"use client";

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Gemini marker type definition
export type GeminiMarker = {
  name: string;
  description: string;
  lat: number;
  lon: number;
};

// Helper to parse Gemini results for markers
export function parseGeminiMarkers(summary: string): GeminiMarker[] {
  // Find the markdown table (robustly)
  const tableRegex = /(\|\s*Name\s*\|[\s\S]*?\n\|---[\s\S]*?)(?=\n\n|$)/;
  const tableMatch = summary.match(tableRegex);
  if (!tableMatch) return [];
  
  const table = tableMatch[0];
  let lines = table.split('\n').filter(line => line.trim().startsWith('|'));
  if (lines.length < 2) return [];
  
  // Repair header: ensure all required columns are present and in correct order
  const requiredHeaders = ['name', 'description', 'popularity', 'insider tips', 'latitude', 'longitude'];
  let headerCells = lines[0].split('|').map(cell => cell.trim().toLowerCase());
  const headerMap: { [key: string]: number } = {};
  requiredHeaders.forEach(h => {
    headerMap[h] = headerCells.indexOf(h);
  });
  
  // If any required column is missing, repair header and rows
  const needsRepair = requiredHeaders.some(h => headerMap[h] === -1);
  if (needsRepair) {
    // Build new header in correct order
    const newHeader = '| ' + requiredHeaders.map(h => h.charAt(0).toUpperCase() + h.slice(1)).join(' | ') + ' |';
    // Build new separator
    const newSeparator = '| ' + requiredHeaders.map(() => '---').join(' | ') + ' |';
    // Repair each row: fill missing columns with empty string
    const newRows = lines.slice(2).map(row => {
      const cells = row.split('|').map(cell => cell.trim());
      // Remove any leading/trailing empty cell
      if (cells.length > 0 && cells[0] === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      const rowObj: { [key: string]: string } = {};
      headerCells.forEach(h => {
        rowObj[h] = cells[headerCells.indexOf(h)] || '';
      });
      // Build new row in required order
      const newRow = '| ' + requiredHeaders.map(h => rowObj[h] || '').join(' | ') + ' |';
      return newRow;
    });
    lines = [newHeader, newSeparator, ...newRows];
    headerCells = requiredHeaders;
  }
  
  // Now parse rows
  const nameIdx = headerCells.findIndex(h => h === 'name');
  const descIdx = headerCells.findIndex(h => h === 'description');
  const latIdx = headerCells.findIndex(h => h === 'latitude');
  const lonIdx = headerCells.findIndex(h => h === 'longitude');
  const dataLines = lines.filter((_, i) => i > 1);
  const markers: GeminiMarker[] = [];
  
  dataLines.forEach(line => {
    const cells = line.split('|').map(cell => cell.trim());
    if (
      cells.length > Math.max(nameIdx, descIdx, latIdx, lonIdx) &&
      latIdx !== -1 && lonIdx !== -1
    ) {
      const name = nameIdx !== -1 ? cells[nameIdx] : '';
      const description = descIdx !== -1 ? cells[descIdx] : '';
      const lat = parseFloat(cells[latIdx]);
      const lon = parseFloat(cells[lonIdx]);
      if (!isNaN(lat) && !isNaN(lon)) {
        markers.push({ name, description, lat, lon });
      }
    }
  });
  
  return markers;
}

interface GeminiMarkersProps {
  summary: string;
}

export default function GeminiMarkers({ summary }: GeminiMarkersProps) {
  const geminiMarkers = summary ? parseGeminiMarkers(summary) : [];

  return (
    <>
      {/* Markers for Gemini summary table */}
      {geminiMarkers
        .filter(marker => marker.name?.trim() || marker.description?.trim())
        .map((marker, idx) => {
          const numberIcon = L.divIcon({
            className: 'numbered-marker',
            html: `<div style="background:#2563eb;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.1rem;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.10);">${idx + 1}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32],
          });
          
          return (
            <Marker key={idx} position={[marker.lat, marker.lon]} icon={numberIcon}>
              <Popup>
                <div style={{ maxWidth: 300 }}>
                  <div className="font-bold mb-1">{marker.name}</div>
                  <div>{marker.description}</div>
                  <div className="text-xs text-gray-700">
                    lat: {marker.lat}, lon: {marker.lon}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
    </>
  );
}
