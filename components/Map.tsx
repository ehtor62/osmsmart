"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Rectangle } from "react-leaflet";
// ...existing code...
// Helper to parse Gemini results for markers
function parseGeminiMarkers(summary: string): Array<{ name: string; description: string; lat: number; lon: number }> {
  // Find the markdown table (robustly)
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
  // City/countryside toggle state
  const [cityMode, setCityMode] = useState<'inside' | 'outside'>('inside');
  // ...existing state declarations...
  // (do not declare showGeminiSpinner here)
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
          // For testing: add 1 to latitude
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
    // Always use a stable dependency array: [shouldFetchOsm, position?.[0], position?.[1], cityMode]
    if (shouldFetchOsm && position) {
      setShowSpinner(false); // Hide spinner when position is set and OSM fetch starts
      // Helper to get tile x/y for given lat/lng/zoom
      function latLngToTile(lat: number, lng: number, zoom: number) {
        const n = Math.pow(2, zoom);
        const xtile = Math.floor(((lng + 180) / 360) * n);
        // FIX: multiply by n inside the parentheses for ytile
        const ytile = Math.floor(
          ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n
        );
        return { xtile, ytile };
      }

      // Helper to get lat/lng for tile x/y/zoom (center of tile)
      function tileToLatLng(xtile: number, ytile: number, zoom: number): [number, number] {
        const n = Math.pow(2, zoom);
        const lon = (xtile + 0.5) / n * 360 - 180;
        const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ytile + 0.5) / n)));
        const lat = latRad * 180 / Math.PI;
        return [lat, lon];
      }

      
      // Debug: log the position used for tile calculation
      console.log('OSM fetch: using position', position);

      // Get tile x/y for current position
      const { xtile, ytile } = latLngToTile(position[0], position[1], zoomLevel);
      console.log('OSM fetch: xtile, ytile', xtile, ytile, 'for position', position, 'at zoom', zoomLevel);

      // Get all tile centers to fetch
      let tiles: Array<{ lat: number; lng: number }> = [];
      if (cityMode === 'inside') {
        // Use the user's actual position, not the tile center
        tiles = [{ lat: position[0], lng: position[1] }];
      } else {
        // 3x3 grid: current + 8 surrounding, use tile centers, but deduplicate
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
              // Debug: log each tile center
              console.log(`OSM fetch: tile center for x=${x}, y=${y}: lat=${lat}, lng=${lng}`);
            }
          }
        }
      }

      // Fetch all tiles in parallel, with debug logging for each fetch
      Promise.all(
        tiles.map(({ lat, lng }, i) =>
          fetch(`/api/tile?lat=${lat}&lng=${lng}`)
            .then(async (res) => {
              if (!res.ok) {
                console.warn(`Tile API call failed for tile #${i} at lat=${lat}, lng=${lng}`);
                return [];
              }
              try {
                const data = await res.json();
                console.log(`Tile API response for tile #${i} at lat=${lat}, lng=${lng}:`, data);
                return data && data.elements ? data.elements : [];
              } catch (e) {
                console.error(`Tile API JSON parse error for tile #${i} at lat=${lat}, lng=${lng}:`, e);
                return [];
              }
            })
        )
      ).then((results) => {
        // Flatten and deduplicate by id
        const allElements: OsmElement[] = ([] as OsmElement[]).concat(...results);
        // Debug: log raw elements before filtering
        console.log('Fetched OSM elements (raw):', allElements);
        // OSM ids are only unique within their type, so use type+id as key
        const seen = new Set<string>();
        const filtered = allElements.filter((el) => {
          // Only deduplicate by type+id, and filter for specific tags
          if (el.id == null || el.type == null) return false;
          const key = `${el.type}:${el.id}`;
          if (seen.has(key)) return false;
          seen.add(key);

          // List of allowed tags and key-value pairs
          const allowedTags = new Set([
            'aerialway',
            'aeroway:aerodrome',
            'aeroway:helipad',
            'aeroway:heliport',
            'aeroway:spaceport',
            'aeroway:terminal',
            'amenity:bar',
            'amenity:biergarten',
            'amenity:café',
            'amenity:fast_food',
            'amenity:food_court',
            'amenity:ice_cream',
            'amenity:pub',
            'amenity:restaurant',
            'amenity:surf_school',
            'amenity:library',
            'amenity:bicycle_rental',
            'amenity:boat_rental',
            'amenity:bus_station',
            'amenity:car_rental',
            'amenity:ferry_terminal',
            'amenity:taxi',
            'amenity:bureau_de_change',
            'amenity:money_transfer',
            'amenity:arts_centre',
            'amenity:casino',
            'amenity:cinema',
            'amenity:community_centre',
            'amenity:events_venue',
            'amenity:exhibition_centre',
            'amenity:fountain',
            'amenity:music_venue',
            'amenity:nightclub',
            'amenity:planetarium',
            'amenity:stage',
            'amenity:social_centre',
            'amenity:theatre',
            'amenity:ranger_station',
            'amenity:bbq',
            'amenity:dive_centre',
            'amenity:internet_cafe',
            'amenity:kneipp_water_cure',
            'amenity:marketplace',
            'amenity:monastery',
            'amenity:place_of_worship',
            'amenity:public_bath',
            'barrier:city_wall',
            'barrier:border_control',
            'boundary:aboriginal_lands',
            'boundary:hazard',
            'boundary:limited_traffic_zone',
            'boundary:low_emission_zone',
            'boundary:national_park',
            'boundary:protected_area',
            'boundary:timezone',
            'building:cathedral',
            'building:church',
            'building:kingdom_hall',
            'building:monastery',
            'building:mosque',
            'building:synagogue',
            'building:temple',
            'building:bridge',
            'building:museum',
            'building:train_station',
            'building:stadium',
            'building:beach_hut',
            'building:castle',
            'building:ship',
            'building:triumphal_arch',
            'craft:winery',
            'geological:volcanic_caldera_rim',
            'geological:volcanic_lava_field',
            'geological:volcanic_vent',
            'geological:columnar_jointing',
            'geological:hoodoo',
            'geological:dyke',
            'geological:tor',
            'geological:inselberg',
            'mountain_pass:yes',
            'highway:hitchhiking',
            'historic:aircraft',
            'historic:aqueduct',
            'historic:archaeological_site',
            'historic:building',
            'historic:castle',
            'historic:castle_wall',
            'historic:church',
            'historic:city_gate',
            'historic:citywalls',
            'historic:district',
            'historic:farm',
            'historic:fort',
            'historic:house',
            'historic:locomotive',
            'historic:manor',
            'historic:monastery',
            'historic:mine',
            'historic:monument',
            'historic:mosque',
            'historic:road',
            'historic:ruins',
            'historic:ship',
            'historic:temple',
            'historic:tomb',
            'historic:tower',
            'historic:wreck',
            'landuse:vineyard',
            'landuse:salt_pond',
            'landuse:winter_sports',
            'leisure:beach_resort',
            'leisure:bird_hide',
            'leisure:garden',
            'leisure:ice_rink',
            'leisure:marina',
            'leisure:miniature_golf',
            'leisure:nature_reserve',
            'leisure:stadium',
            'leisure:water_park',
            'man_made:lighthouse',
            'man_made:observatory',
            'man_made:pier',
            'man_made:watermill',
            'man_made:windmill',
            'natural:beach',
            'natural:blowhole',
            'natural:geyser',
            'natural:glacier',
            'natural:hot_spring',
            'natural:isthmus',
            'natural:arch',
            'natural:cave_entrance',
            'natural:cliff',
            'natural:dune',
            'natural:fumarole',
            'natural:volcano',
            'office:guide',
            'office:harbour_master',
            'railway:funicular',
            'shop:ice_cream',
            'shop:mall',
            'tourism:alpine_hut',
            'tourism:aquarium',
            'tourism:artwork',
            'tourism:attraction',
            'tourism:gallery',
            'tourism:museum',
            'tourism:theme_park',
            'tourism:viewpoint',
            'tourism:zoo',
            'tourism:yes',
            'waterway:waterfall',
          ]);

          if (!el.tags) return false;
          for (const [k, v] of Object.entries(el.tags)) {
            // Check for key-only match (e.g., aerialway)
            if (allowedTags.has(k)) return true;
            // Check for key-value match (e.g., amenity:bar)
            if (allowedTags.has(`${k}:${v}`)) return true;
          }
          return false;
        });
        console.log('Filtered OSM elements (to display):', filtered);
        setOsmData(filtered);
        setPanelOpen(true);
      }).catch(() => {
        setOsmData([]);
        setPanelOpen(true);
      });
      setShouldFetchOsm(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFetchOsm, position ? position[0] : null, position ? position[1] : null, cityMode]);

  // Helper to get tile bounds for a given tile x/y/zoom
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
      // 3x3 grid: find min/max lat/lng from all 9 tile bounds
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

  // Parse Gemini markers from summary
  const geminiMarkers = summary ? parseGeminiMarkers(summary) : [];
  if (geminiMarkers.length > 0) {
    console.log('Gemini markers:', geminiMarkers);
  } else if (summary) {
    console.log('No Gemini markers found. Summary:', summary);
  }

  // Spinner overlay for Gemini summary (must be after state declarations)
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
        {/* Initial modal overlay */}
        {showInitModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(30, 41, 59, 0.55)',
            zIndex: 5000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.95)',
              borderRadius: 16,
              boxShadow: '0 4px 32px rgba(0,0,0,0.15)',
              padding: '32px 40px',
              minWidth: 320,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}
          >
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: 12, color: '#2563eb' }}>Do You Know What&apos;s Around You?</h2>
            <div style={{ marginBottom: 18, color: '#334155', fontSize: '1rem' }}>
              Choose an option to get started:
            </div>
            <div style={{ display: 'flex', gap: 18, justifyContent: 'center' }}>
              <button
                style={{
                  padding: '10px 24px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                  transition: 'background 0.2s',
                }}
                onClick={handleFindLocation}
              >
                Everything around me
              </button>
              <button
                style={{
                  padding: '10px 24px',
                  background: '#38bdf8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                  transition: 'background 0.2s',
                }}
                onClick={() => setShowInitModal(false)}
              >
                I have a specific interest 
              </button>
            </div>
            {/* Toggle for inside/outside city */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  userSelect: 'none',
                }}
              >
                <span style={{ color: cityMode === 'inside' ? '#2563eb' : '#64748b', fontWeight: 600, fontSize: '0.98rem', minWidth: 70, textAlign: 'right' }}>inside city</span>
                <div
                  role="switch"
                  aria-checked={cityMode === 'outside'}
                  tabIndex={0}
                  onClick={() => setCityMode(cityMode === 'inside' ? 'outside' : 'inside')}
                  onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') setCityMode(cityMode === 'inside' ? 'outside' : 'inside'); }}
                  style={{
                    width: 54,
                    height: 28,
                    borderRadius: 16,
                    background: cityMode === 'outside' ? '#2563eb' : '#e5e7eb',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    outline: 'none',
                    border: cityMode === 'outside' ? '2px solid #2563eb' : '2px solid #e5e7eb',
                    boxShadow: cityMode === 'outside' ? '0 2px 8px rgba(37,99,235,0.10)' : 'none',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: cityMode === 'inside' ? 3 : 23,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: '#fff',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
                <span style={{ color: cityMode === 'outside' ? '#2563eb' : '#64748b', fontWeight: 600, fontSize: '0.98rem', minWidth: 80, textAlign: 'left' }}>outside city</span>
              </div>
            </div>
          </div>
        </div>
      )}
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
              setPanelOpen(false); // Hide side panel, keep tile visible
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
                  {/* Omit rendering nodes: [...] */}
                  {/* Omit rendering members: [...] */}
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
              onClick={() => {
                setPosition([47.3769, 8.5417]); // Zurich
                setShowInitModal(true);
                setTopPanelOpen(false);
                setPanelOpen(false);
                setTopPanelMinimized(false);
                setOsmData(null);
                setSummary("");
              }}
            >Close</button>
            
          </div>
        </div>
      <div className="p-4" style={{ fontSize: '0.85rem', overflowWrap: 'anywhere', color: 'black', position: 'relative', paddingBottom: 64 }}>
        {/* Render summary above the table if a markdown table exists */}
        {((): React.ReactNode => {
          // Find markdown table
          const tableRegex = /\|\s*Name\s*\|[\s\S]*?\n\|---[\s\S]*?(?=\n\n|$)/;
          const tableMatch = summary.match(tableRegex);
          // Responsive font size for table
          const tableStyle: React.CSSProperties = {
            marginTop: 18,
            fontSize: '0.95rem',
          };
          if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 600px)').matches) {
            tableStyle.fontSize = '0.75rem';
          }
          if (tableMatch) {
            const tableMd = tableMatch[0];
            let summaryMd = summary.replace(tableMd, '').trim();
            summaryMd = `Summary for Tourists:\n\n${summaryMd}`;
            const lines = tableMd.split('\n').filter(line => line.trim().startsWith('|'));
            const dataLines = lines.filter((_, i) => i > 1);
            return (
              <>
                <div
                  dangerouslySetInnerHTML={{
                    __html:
                      (typeof window !== 'undefined' && (window as Window & { marked?: { parse: (md: string) => string } }).marked)
                        ? (window as Window & { marked?: { parse: (md: string) => string } }).marked!.parse(summaryMd)
                        : summaryMd.replace(/\n/g, '<br/>'),
                  }}
                />
                <div style={tableStyle}>
                  {dataLines.map((line, idx) => {
                    const cells = line.split('|').map(cell => cell.trim());
                    const name = cells[1] || '';
                    const description = cells[2] || '';
                    const bestFor = cells[3] || '';
                    const insiderTips = cells[4] || '';
                    const label = `${name}: ${description}${bestFor ? ' | Best for: ' + bestFor : ''}${insiderTips ? ' | Tip: ' + insiderTips : ''}`;
                    if (!label.trim() || /^:?\s*$/.test(label.trim()) || label.trim() === ':') {
                      return null;
                    }
                    // Add row number to the label
                    const rowNumber = idx + 1;
                    const numberedLabel = `${rowNumber}. ${label}`;
                    return (
                      <button
                        key={idx}
                        style={{
                          display: 'block',
                          width: '100%',
                          marginBottom: 8,
                          padding: '10px 12px',
                          fontSize: tableStyle.fontSize,
                          background: '#f1f5f9',
                          color: '#2563eb',
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          textAlign: 'left',
                          cursor: 'pointer',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        }}
                        onClick={() => {
                          alert(label);
                        }}
                      >
                        {numberedLabel}
                      </button>
                    );
                  })}
                </div>
              </>
            );
          } else if (summary) {
            let summaryMd = summary.trim();
            summaryMd = summaryMd.replace(/^(Here(?:'s| is) a summary of the tourist-relevant OpenStreetMap data:?|Summary:|Tourist summary:?|Gemini summary:?|Gemini result:?|Tourist information:?|For tourists:?|The following is a summary:?|Below is a summary:?|This is a summary:?|Summary for tourists:?)/i, '').trim();
            summaryMd = `Summary for Tourists:\n\n${summaryMd}`;
            return (
              <div
                dangerouslySetInnerHTML={{
                  __html:
                    (typeof window !== 'undefined' && (window as Window & { marked?: { parse: (md: string) => string } }).marked)
                      ? (window as Window & { marked?: { parse: (md: string) => string } }).marked!.parse(summaryMd)
                      : summaryMd.replace(/\n/g, '<br/>'),
                }}
              />
            );
          } else {
            return null;
          }
        })()}
        {/* Bottom action buttons (duplicate of top) */}
        <div style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: '100%',
          background: 'linear-gradient(to top, #fff 90%, rgba(255,255,255,0.0))',
          padding: '16px 24px 12px 24px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
          borderTop: '1px solid #e5e7eb',
        }}>
          <button
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            onClick={() => setTopPanelMinimized(true)}
          >Minimize</button>
          <button
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            onClick={() => {
              setPosition([47.3769, 8.5417]); // Zurich
              setShowInitModal(true);
              setTopPanelOpen(false);
              setPanelOpen(false);
              setTopPanelMinimized(false);
              setOsmData(null);
              setSummary("");
            }}
          >Close</button>
        </div>
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
              {geminiMarkers
                .filter(marker => marker.name?.trim() || marker.description?.trim())
                .map((marker, idx) => {
                  // Create a numbered divIcon for each marker
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
              {/* Show tile rectangle(s) only after OSM data is loaded, regardless of panel state */}
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
