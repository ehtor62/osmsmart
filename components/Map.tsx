// OSM element type definition
"use client";
type OsmElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
  members?: Array<{ type: string; ref: number; role: string }>;
};
import { useEffect, useState } from "react";
import { allowedTags } from "../utils/allowedTags";
import InitialModal from "./InitialModal";
import { MapContainer, TileLayer, Marker, Popup, useMap, Rectangle } from "react-leaflet";
import OsmDataPanel from "./OsmDataPanel";
import GeminiSummaryPanel from "./GeminiSummaryPanel";
// ...existing code...
// Helper to parse Gemini results for markers
function parseGeminiMarkers(summary: string): Array<{ name: string; description: string; lat: number; lon: number }> {
  // Find the markdown table (robustly)
  const tableRegex = /(\|\s*Name\s*\|[\s\S]*?\n\|---[\s\S]*?)(?=\n\n|$)/;
  const tableMatch = summary.match(tableRegex);
  if (!tableMatch) return [];
  const table = tableMatch[0];
  const lines = table.split('\n').filter(line => line.trim().startsWith('|'));
  // Remove header and separator
  const dataLines = lines.filter((_, i) => i > 1);
  const markers: Array<{ name: string; description: string; lat: number; lon: number }> = [];
  dataLines.forEach(line => {
    // Split and trim, but keep empty cells
    const cells = line.split('|').map(cell => cell.trim());
    // Expect: | Name | Description | Best For | Insider Tips | Latitude | Longitude |
    // cells[1]=Name, cells[2]=Description, cells[5]=Latitude, cells[6]=Longitude
    if (cells.length >= 7) {
      const name = cells[1];
      const description = cells[2];
      const lat = parseFloat(cells[5]);
      const lon = parseFloat(cells[6]);
      if (!isNaN(lat) && !isNaN(lon)) {
        console.log(`Gemini marker lat/lon:`, lat, lon);
        markers.push({ name, description, lat, lon });
      }
    }
  });
  return markers;
}

// CenterMap helper must be defined before use
function CenterMap({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);
  return null;
}

import L from "leaflet";
import "leaflet/dist/leaflet.css";

const redMarkerIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function Map() {
  // City/countryside toggle state
  const [cityMode, setCityMode] = useState<'inside' | 'outside'>('inside');
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [osmData, setOsmData] = useState<OsmElement[] | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);
  const [panelOpen, setPanelOpen] = useState<boolean>(false);
  const [topPanelOpen, setTopPanelOpen] = useState<boolean>(false);
  const [topPanelMinimized, setTopPanelMinimized] = useState<boolean>(false);
  const [showInitModal, setShowInitModal] = useState<boolean>(true);
  const [shouldFetchOsm, setShouldFetchOsm] = useState<boolean>(false);
  const [showSpinner, setShowSpinner] = useState<boolean>(false);
  const zoomLevel = 16;

  // On load, center on Zurich only, do not open panel
  useEffect(() => {
    setPosition([47.3769, 8.5417]);
    setPanelOpen(false);
  }, []);

  // Function to trigger geolocation search and OSM fetch
  const handleFindLocation = () => {
    setShowInitModal(false);
    setShowSpinner(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude, pos.coords.longitude]);
          setShouldFetchOsm(true);
        },
        () => {
          setPosition([47.3769, 8.5417]); // fallback: Zurich
          setShouldFetchOsm(true);
        }
      );
    } else {
      setPosition([47.3769, 8.5417]); // fallback: Zurich
      setShouldFetchOsm(true);
    }
  };

  useEffect(() => {
    if (shouldFetchOsm && position) {
      setShowSpinner(false);
      function latLngToTile(lat: number, lng: number, zoom: number) {
        const n = Math.pow(2, zoom);
        const xtile = Math.floor(((lng + 180) / 360) * n);
        const ytile = Math.floor(
          ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n
        );
        return { xtile, ytile };
      }
      function tileToLatLng(xtile: number, ytile: number, zoom: number): [number, number] {
        const n = Math.pow(2, zoom);
        const lon = (xtile + 0.5) / n * 360 - 180;
        const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ytile + 0.5) / n)));
        const lat = latRad * 180 / Math.PI;
        return [lat, lon];
      }
      // Debug: log the position used for tile calculation
      // ...existing code...
      const { xtile, ytile } = latLngToTile(position[0], position[1], zoomLevel);
      let tiles: Array<{ lat: number; lng: number }> = [];
      if (cityMode === 'inside') {
        tiles = [{ lat: position[0], lng: position[1] }];
      } else {
        const tileSet = new Set<string>();
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const x = xtile + dx;
            const y = ytile + dy;
            const [lat, lng] = tileToLatLng(x, y, zoomLevel);
            const key = `${x},${y}`;
            if (!tileSet.has(key)) {
              tileSet.add(key);
              tiles.push({ lat, lng });
            }
          }
        }
      }
      Promise.all(
        tiles.map(({ lat, lng }) =>
          fetch(`/api/tile?lat=${lat}&lng=${lng}`)
            .then(async (res) => {
              if (!res.ok) return [];
              try {
                const data = await res.json();
                return data && data.elements ? data.elements : [];
              } catch {
                return [];
              }
            })
        )
      ).then((results) => {
        const allElements: OsmElement[] = ([] as OsmElement[]).concat(...results);
        const seen = new Set<string>();
        const filtered = allElements.filter((el) => {
          if (el.id == null || el.type == null) return false;
          const key = `${el.type}:${el.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          if (!el.tags) return false;
          // filter using allowedTags from utils/allowedTags
          for (const [k, v] of Object.entries(el.tags)) {
            if (allowedTags.has(k)) return true;
            if (allowedTags.has(`${k}:${v}`)) return true;
          }
          return false;
        });
        setOsmData(filtered);
        setPanelOpen(true);
      }).catch(() => {
        setOsmData([]);
        setPanelOpen(true);
      });
      setShouldFetchOsm(false);
    }
  }, [shouldFetchOsm, position, cityMode]);

  function getTileBoundsXY(xtile: number, ytile: number, zoom: number): [[number, number], [number, number]] {
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

  let tileBounds: [[number, number], [number, number]] | null = null;
  if (position) {
    const latLngToTile = (lat: number, lng: number, zoom: number) => {
      const n = Math.pow(2, zoom);
      const xtile = Math.floor(((lng + 180) / 360) * n);
      const ytile = Math.floor(
        ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n
      );
      return { xtile, ytile };
    };
    const { xtile, ytile } = latLngToTile(position[0], position[1], zoomLevel);
    if (cityMode === 'inside') {
      tileBounds = getTileBoundsXY(xtile, ytile, zoomLevel);
    } else {
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const x = xtile + dx;
          const y = ytile + dy;
          const [[lat1, lng1], [lat2, lng2]] = getTileBoundsXY(x, y, zoomLevel);
          minLat = Math.min(minLat, lat1, lat2);
          maxLat = Math.max(maxLat, lat1, lat2);
          minLng = Math.min(minLng, lng1, lng2);
          maxLng = Math.max(maxLng, lng1, lng2);
        }
      }
      tileBounds = [
        [minLat, minLng],
        [maxLat, maxLng],
      ];
    }
  }

  const geminiMarkers = summary ? parseGeminiMarkers(summary) : [];
  const showGeminiSpinner = loadingSummary && !topPanelOpen;

  return (
    <>
      {/* Spinner overlay for Gemini summary */}
      {showGeminiSpinner && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(30, 41, 59, 0.25)',
            zIndex: 7000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{
            border: '6px solid #e5e7eb',
            borderTop: '6px solid #2563eb',
            borderRadius: '50%',
            width: 64,
            height: 64,
            animation: 'spin 1s linear infinite',
            marginBottom: 24,
          }} />
          <div style={{ color: '#2563eb', fontWeight: 600, fontSize: '1.15rem', letterSpacing: 0.5 }}>asking local guides…</div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
      {showSpinner ? (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(30, 41, 59, 0.25)',
            zIndex: 6000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{
            border: '6px solid #e5e7eb',
            borderTop: '6px solid #2563eb',
            borderRadius: '50%',
            width: 64,
            height: 64,
            animation: 'spin 1s linear infinite',
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : null}
      <div className="w-screen h-screen flex flex-row" style={{ position: 'relative' }}>
        <InitialModal
          show={showInitModal}
          cityMode={cityMode}
          onFindLocation={handleFindLocation}
          onClose={() => setShowInitModal(false)}
          onToggleCityMode={() => setCityMode(cityMode === 'inside' ? 'outside' : 'inside')}
        />
        <OsmDataPanel
          open={panelOpen}
          osmData={osmData}
          loadingSummary={loadingSummary}
          onClose={() => setPanelOpen(false)}
          onSummarize={async () => {
            if (!osmData) return;
            setLoadingSummary(true);
            setSummary("");
            setPanelOpen(false);
            try {
              const response = await fetch("/api/gemini", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  relevantData: osmData,
                  prompt: "Summarize the most relevant tourist information from these OpenStreetMap elements."
                })
              });
              const result = await response.json();
              setSummary(result.answer || "No summary available.");
              setTopPanelOpen(true);
            } catch {
              setSummary("Error retrieving summary.");
              setTopPanelOpen(true);
            }
            setLoadingSummary(false);
          }}
        />
        <GeminiSummaryPanel
          summary={summary}
          open={topPanelOpen}
          minimized={topPanelMinimized}
          onMinimize={() => {
            setTopPanelMinimized((prev) => !prev);
          }}
          onClose={() => {
            setPosition([47.3769, 8.5417]);
            setShowInitModal(true);
            setTopPanelOpen(false);
            setPanelOpen(false);
            setTopPanelMinimized(false);
            setOsmData(null);
            setSummary("");
          }}
        />
        <div className="flex-1 h-full">
          <MapContainer
            center={position || [47.3769, 8.5417]}
            zoom={zoomLevel}
            scrollWheelZoom={true}
            style={{ width: "100%", height: "100vh" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {position && (
              <>
                <CenterMap position={position} />
                <Marker position={position} icon={redMarkerIcon}>
                  <Popup>
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                      <div className="font-bold mb-1">Your current location</div>
                      {osmData && osmData.length > 0 ? (
                        <span className="italic text-gray-500">No address data found nearby.</span>
                      ) : (
                        <span className="italic text-gray-500">No OSM data for this tile.</span>
                      )}
                    </div>
                  </Popup>
                </Marker>
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
                            <div className="text-xs text-gray-700">lat: {marker.lat}, lon: {marker.lon}</div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                {tileBounds && osmData && osmData.length > 0 && (
                  <Rectangle bounds={tileBounds} pathOptions={{ color: "red", weight: 2 }} />
                )}
              </>
            )}
          </MapContainer>
        </div>
      </div>
    </>
  );
}
