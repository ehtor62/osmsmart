"use client";
import { useEffect, useState } from "react";
import { marked } from "marked";
import { MapContainer, TileLayer, Marker, Popup, useMap, Rectangle } from "react-leaflet";
// ...existing code...
// Helper to parse Gemini results for markers
function parseGeminiMarkers(summary: string): Array<{ name: string; description: string; lat: number; lon: number }> {
  // Find the markdown table (robustly)
  const tableRegex = /((?:\|[^\n]+\n)+)/g;
  const tables = summary.match(tableRegex);
  if (!tables) return [];
  // Find the table with the expected header
  const table = tables.find(t => t.includes('Name of the Element') && t.includes('Latitude') && t.includes('Longitude'));
  if (!table) return [];
  const lines = table.split('\n').filter(line => line.trim().startsWith('|'));
  // Remove header and separator
  const dataLines = lines.filter((_, i) => i > 1);
  const markers: Array<{ name: string; description: string; lat: number; lon: number }> = [];
  dataLines.forEach(line => {
    // Split and trim, but keep empty cells
    const cells = line.split('|').map(cell => cell.trim());
    // Expect: | Name | Description | ... | ... | Latitude | Longitude |
    if (cells.length >= 7) {
      const name = cells[1];
      const description = cells[2];
      const lat = parseFloat(cells[5]);
      const lon = parseFloat(cells[6]);
      if (!isNaN(lat) && !isNaN(lon)) {
        markers.push({ name, description, lat, lon });
      }
    }
  });
  return markers;
}
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const redMarkerIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function CenterMap({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);
  return null;
}

type OsmElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
  members?: Array<{ type: string; ref: number; role: string }>;
};

export default function Map() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [osmData, setOsmData] = useState<OsmElement[] | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);
  const [panelOpen, setPanelOpen] = useState<boolean>(false);
  const [topPanelOpen, setTopPanelOpen] = useState<boolean>(false);
  const [topPanelMinimized, setTopPanelMinimized] = useState<boolean>(false);
  const zoomLevel = 16;

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude, pos.coords.longitude]);
          setPanelOpen(true);
        },
        () => {
          setPosition([47.3769, 8.5417]); // fallback: Zurich
          setPanelOpen(true);
        }
      );
    } else {
      setPosition([47.3769, 8.5417]); // fallback: Zurich
      setPanelOpen(true);
    }
  }, []);

  useEffect(() => {
    if (position) {
      // Fetch OSM data from API
      fetch(`/api/tile?lat=${position[0]}&lng=${position[1]}`)
        .then(async (res) => {
          if (!res.ok) {
            setOsmData([]);
            return;
          }
          try {
            const data = await res.json();
            if (data && data.elements) {
              // Only keep elements with tags, not of type 'way', and not natural: tree
              setOsmData(
                data.elements
                  .filter((el: OsmElement) =>
                    el.tags &&
                    Object.keys(el.tags).length > 0 &&
                    el.type !== 'way' &&
                    el.type !== 'route' &&
                    !(el.tags["natural"] === "tree")
                  )
                  // Remove any element with type 'route' just in case
                  .filter((el: OsmElement) => el.type !== 'route')
              );
            } else {
              setOsmData([]);
            }
          } catch {
            setOsmData([]);
          }
        });
    }
  }, [position]);

  // Helper to get tile bounds for zoom 16
  function getTileBounds(lat: number, lng: number, zoom: number): [[number, number], [number, number]] {
    const n = Math.pow(2, zoom);
    const xtile = Math.floor(((lng + 180) / 360) * n);
    const ytile = Math.floor(
      (
        (1 -
          Math.log(
            Math.tan((lat * Math.PI) / 180) +
              1 / Math.cos((lat * Math.PI) / 180)
          ) /
            Math.PI) /
        2
      ) * n
    );
    // Convert tile x/y back to bounds
    const lon1 = (xtile / n) * 360 - 180;
    const lat1 =
      (180 / Math.PI) *
      Math.atan(
        Math.sinh(
          Math.PI * (1 - (2 * ytile) / n)
        )
      );
    const lon2 = ((xtile + 1) / n) * 360 - 180;
    const lat2 =
      (180 / Math.PI) *
      Math.atan(
        Math.sinh(
          Math.PI * (1 - (2 * (ytile + 1)) / n)
        )
      );
    return [
      [lat1, lon1],
      [lat2, lon2],
    ];
  }

  let tileBounds: [[number, number], [number, number]] | null = null;
  if (position) {
    tileBounds = getTileBounds(position[0], position[1], zoomLevel);
  }

  // Parse Gemini markers from summary
  const geminiMarkers = summary ? parseGeminiMarkers(summary) : [];
  if (geminiMarkers.length > 0) {
    console.log('Gemini markers:', geminiMarkers);
  } else if (summary) {
    console.log('No Gemini markers found. Summary:', summary);
  }

  return (
    <div className="w-screen h-screen flex flex-row">
      {/* Sliding left panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: panelOpen ? 0 : -400,
          width: 400,
          height: "100vh",
          background: "#fff",
          boxShadow: "2px 0 8px rgba(0,0,0,0.08)",
          transition: "left 0.3s cubic-bezier(.4,0,.2,1)",
          zIndex: 3000,
          overflowY: "auto",
        }}
      >
        <div className="p-4 border-b border-gray-300 flex justify-between items-center">
          <h2 className="font-bold mb-2">OSM Data Elements</h2>
          <button
            className="ml-2 px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => setPanelOpen(false)}
          >Close</button>
        </div>
        <div className="p-4">
          <button
            className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors w-full"
            onClick={async () => {
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
            disabled={loadingSummary}
          >
            {loadingSummary ? "Summarizing..." : "Summarize"}
          </button>
          <ul className="text-xs" style={{ fontSize: '0.75rem' }}>
            {osmData ? (
              osmData.map((el, idx) => (
                <li key={idx} className="mb-3 border-b pb-2">
                  <div className="font-semibold">Element {el.type} #{el.id}</div>
                  <ul className="ml-2 mb-1">
                    {Object.entries(el.tags ?? {}).map(([key, value]) => (
                      <li key={key}>
                        <span className="font-mono text-blue-700">{key}</span>
                        {": "}
                        <span className="font-mono text-green-700">{value}</span>
                      </li>
                    ))}
                  </ul>
                  {el.lat !== undefined && el.lon !== undefined && (
                    <div className="text-xs text-gray-700">lat: {el.lat}, lon: {el.lon}</div>
                  )}
                  {el.nodes && el.nodes.length > 0 && (
                    <div className="text-xs text-gray-700">nodes: [{el.nodes.join(", ")}]</div>
                  )}
                  {el.members && el.members.length > 0 && (
                    <div className="text-xs text-gray-700">members: [{el.members.map(m => `${m.type}#${m.ref} (${m.role})`).join(", ")}]</div>
                  )}
                </li>
              ))
            ) : (
              <li>Loading OSM data...</li>
            )}
          </ul>
        </div>
      </div>
      {/* Sliding top panel for Gemini results */}
      {/* Gemini summary top panel */}
      <div
        style={{
          position: "fixed",
          top: topPanelOpen && !topPanelMinimized ? 0 : -300,
          left: 0,
          width: "100vw",
          height: 300,
          background: "#fff",
          boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
          transition: "top 0.3s cubic-bezier(.4,0,.2,1)",
          zIndex: 4000,
          overflowY: "auto",
        }}
      >
        <div className="p-4 border-b border-gray-300 flex justify-between items-center">
          <h2 className="font-bold mb-2">Gemini Results</h2>
          <div className="flex gap-2">
            <button
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              onClick={() => setTopPanelMinimized(true)}
            >Minimize</button>
            <button
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              onClick={() => setTopPanelOpen(false)}
            >Close</button>
            
          </div>
        </div>
        <div className="p-4" style={{ fontSize: '0.85rem', overflowWrap: 'anywhere', color: 'black' }}>
          <div dangerouslySetInnerHTML={{ __html: marked.parse(summary) }} />
        </div>
      </div>

      {/* Minimized Gemini summary button at top right */}
      {topPanelOpen && topPanelMinimized && (
        <button
          style={{
            position: "fixed",
            top: 16,
            right: 24,
            zIndex: 4100,
            padding: "8px 16px",
            background: "#2563eb",
            color: "#fff",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
            fontSize: "0.95rem",
            border: "none",
            cursor: "pointer"
          }}
          onClick={() => setTopPanelMinimized(false)}
        >
          Show Gemini Summary
        </button>
      )}
      {/* Main map area */}
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
                      (() => {
                        // ...existing code...
                        return <span className="italic text-gray-500">No address data found nearby.</span>;
                      })()
                    ) : (
                      <span className="italic text-gray-500">No OSM data for this tile.</span>
                    )}
                  </div>
                </Popup>
              </Marker>
              {geminiMarkers.map((marker, idx) => (
                <Marker key={idx} position={[marker.lat, marker.lon]} icon={markerIcon}>
                  <Popup>
                    <div style={{ maxWidth: 300 }}>
                      <div className="font-bold mb-1">{marker.name}</div>
                      <div>{marker.description}</div>
                      <div className="text-xs text-gray-700">lat: {marker.lat}, lon: {marker.lon}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {tileBounds && (
                <>
                  {/* Highlight the tile bounds with a rectangle */}
                  <Rectangle bounds={tileBounds} pathOptions={{ color: "red", weight: 2 }} />
                </>
              )}
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
