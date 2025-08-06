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
  nodeCoords?: Array<{ lat: number; lon: number }>;
};

// Helper to compute center of a way element
function getWayCenter(nodeCoords: Array<{ lat: number; lon: number }>): { lat: number; lon: number } | null {
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
import { useEffect, useState } from "react";
import { allowedTags } from "../utils/allowedTags";
import InitialModal from "./InitialModal";
import { MapContainer, TileLayer, Marker, Popup, useMap, Rectangle } from "react-leaflet";
import OsmDataPanel from "./OsmDataPanel";
import GeminiSummaryPanel from "./GeminiSummaryPanel";
import FactReportPanel, { useFactReportLogic } from "./FactReportPanel";
import GeminiMarkers from "./GeminiMarkers";
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

  // State declarations
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
  const [gridSize, setGridSize] = useState<number>(3); // start with 3x3
  // Feedback states
  const [tilesChecked, setTilesChecked] = useState<number>(0);
  const [elementsRetrieved, setElementsRetrieved] = useState<number>(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Helper to estimate area covered by tiles (in m^2)
  function getTileAreaSqMeters(zoom: number, lat: number): number {
    // OSM tile size is 256x256 pixels, but we want area in meters
    // At zoom 17, tile width in degrees: 360 / 2^17
    // Use approximate formula for area at latitude
    // const earthRadius = 6378137; // meters (unused)
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
  // Always use zoom 17 for tile calculations as per user request
  const zoomLevel = 17;

  // Hide spinner when side panel opens and zoom out to fit highlighted area
  useEffect(() => {
    if (panelOpen) {
      setShowSpinner(false);
      // Zoom out to fit highlighted area if tileBounds is available
      if (tileBounds && position) {
        // Use leaflet's fitBounds via a custom event
        const event = new CustomEvent('fitTileBounds', { detail: tileBounds });
        window.dispatchEvent(event);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [panelOpen, position]); // tileBounds intentionally omitted: recomputed each render

  // On load, center on Zurich only, do not open panel
  useEffect(() => {
    setPosition([47.3769, 8.5417]);
    setPanelOpen(false);
  }, []);

  // Function to trigger geolocation search and OSM fetch
  const handleFindLocation = () => {
    setShowInitModal(false);
    setShowSpinner(true);
    setGridSize(3); // always start with 3x3
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude+0.68, pos.coords.longitude+2.77]);
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

  // tileBounds must be declared before useEffect
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
    tileBounds = [
      [minLat, minLng],
      [maxLat, maxLng],
    ];
  }

  useEffect(() => {
    const fetchOsmWithGrid = async (grid: number): Promise<OsmElement[]> => {
      if (!position) return [];
      setFetchError(null); // Clear any previous errors
      
      function latLngToTile(lat: number, lng: number, zoom: number) {
        const n = Math.pow(2, zoom);
        const xtile = Math.floor(((lng + 180) / 360) * n);
        const ytile = Math.floor(
          ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n
        );
        return { xtile, ytile };
      }
      const { xtile, ytile } = latLngToTile(position[0], position[1], zoomLevel);
      const range = Math.floor(grid / 2);
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      let tileCount = 0;
      for (let dx = -range; dx <= range; dx++) {
        for (let dy = -range; dy <= range; dy++) {
          const x = xtile + dx;
          const y = ytile + dy;
          const [[lat1, lng1], [lat2, lng2]] = getTileBoundsXY(x, y, zoomLevel);
          minLat = Math.min(minLat, lat1, lat2);
          maxLat = Math.max(maxLat, lat1, lat2);
          minLng = Math.min(minLng, lng1, lng2);
          maxLng = Math.max(maxLng, lng1, lng2);
          tileCount++;
        }
      }
      setTilesChecked(tileCount);
      
      // Add retry logic for fetch requests
      let res;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          res = await fetch(`/api/tile?minLat=${minLat}&minLng=${minLng}&maxLat=${maxLat}&maxLng=${maxLng}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            // Add timeout
            signal: AbortSignal.timeout(45000), // 45 seconds timeout
          });
          
          if (res.ok) break; // Success, exit retry loop
          
          if (res.status >= 500) {
            // Server error, retry
            attempts++;
            if (attempts < maxAttempts) {
              console.warn(`Server error (${res.status}), retrying... (${attempts}/${maxAttempts})`);
              await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
              continue;
            }
          } else {
            // Client error, don't retry
            console.error(`Client error: ${res.status} ${res.statusText}`);
            return [];
          }
        } catch (fetchError) {
          attempts++;
          console.error(`Fetch attempt ${attempts} failed:`, fetchError);
          if (attempts < maxAttempts) {
            console.warn(`Retrying fetch... (${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
          } else {
            console.error('All fetch attempts failed');
            setFetchError('Failed to fetch data from server. Please try again.');
            return [];
          }
        }
      }
      
      if (!res || !res.ok) {
        console.error('Failed to fetch OSM data after all attempts');
        setFetchError('Server error. Please try again later.');
        return [];
      }
      
      try {
        const data = await res.json();
        console.log('OSM API Response sample:', data?.elements?.slice(0, 3)); // Debug log
        // Filter elements by allowedTags
        if (data && data.elements) {
          const wayElements = data.elements.filter((el: OsmElement) => el.type === 'way');
          console.log(`Found ${wayElements.length} way elements in OSM data`);
          if (wayElements.length > 0) {
            console.log('Sample way element:', wayElements[0]);
            console.log('Sample way element keys:', Object.keys(wayElements[0]));
            // Check if it has nodeCoords field (should be populated by backend now)
            if (wayElements[0].nodeCoords) {
              console.log('Way has nodeCoords field:', wayElements[0].nodeCoords.length, 'coordinates');
            }
          }
          
          // Filter and process elements (backend now provides nodeCoords for ways)
          const filtered = data.elements.filter((el: OsmElement) => {
            if (!el.tags) return false;
            return Object.entries(el.tags).some(([key, value]) => allowedTags.has(`${key}:${value}`) || allowedTags.has(key));
          }).map((el: OsmElement) => {
            if (el.type === 'way' && el.nodeCoords && el.nodeCoords.length > 0) {
              const center = getWayCenter(el.nodeCoords);
              if (center) {
                el.lat = center.lat;
                el.lon = center.lon;
                console.log(`Way ${el.id} center set to:`, center);
              }
            }
            return el;
          });
          setElementsRetrieved(filtered.length);
          return filtered;
        }
        setElementsRetrieved(0);
        return [];
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        setFetchError('Invalid response from server. Please try again.');
        setElementsRetrieved(0);
        return [];
      }
    }

    const runFetch = async () => {
      if (shouldFetchOsm && position) {
        setFetchError(null); // Clear any previous errors
        let grid = gridSize;
        let elements: OsmElement[] = [];
        setTilesChecked(0);
        setElementsRetrieved(0);
        do {
          elements = await fetchOsmWithGrid(grid);
          if (elements.length < 20) {
            grid += 2;
          }
        } while (elements.length < 20 && grid <= 29); // 21x21 max safeguard
        setOsmData(elements);
        setShowSpinner(false); // Hide spinner only after OSM data is fetched
        setPanelOpen(true);
        setGridSize(grid); // Update gridSize to match the final grid used for fetching
        setShouldFetchOsm(false);
      }
    };
    runFetch();
  }, [shouldFetchOsm, position, gridSize]);

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

  function FitBoundsListener() {
    const map = useMap();
    useEffect(() => {
      const handler = (e: CustomEvent<[[number, number], [number, number]]>) => {
        if (e.detail) {
          map.fitBounds(e.detail, { animate: true, padding: [40, 40] });
        }
      };
      window.addEventListener('fitTileBounds', handler as EventListener);
      return () => window.removeEventListener('fitTileBounds', handler as EventListener);
    }, [map]);
    return null;
  }

  const showGeminiSpinner = loadingSummary && !topPanelOpen;

  // State for left-side Gemini fact report panel
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [leftPanelContent, setLeftPanelContent] = useState("");
  const [leftPanelLoading, setLeftPanelLoading] = useState(false);

  // Use the fact report logic hook
  const { handleFactReport } = useFactReportLogic();

  // Handler for Gemini fact report (left panel) - wrapper to pass osmData
  const handleAskFactReport = async (label: string) => {
    await handleFactReport(label, osmData, setLeftPanelContent, setLeftPanelLoading, setLeftPanelOpen);
  };

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
      {/* Modern large spinner overlay, visible until side panel opens */}
      {showSpinner && !panelOpen && (
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
            flexDirection: 'column',
          }}
        >
          <div style={{
            width: 120,
            height: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="60" cy="60" r="52" stroke="#e5e7eb" strokeWidth="12" />
              <circle cx="60" cy="60" r="52" stroke="#2563eb" strokeWidth="12" strokeDasharray="120 120" strokeDashoffset="60" style={{
                transformOrigin: 'center',
                animation: 'spin-modern 1.2s linear infinite',
              }} />
              <style>{`
                @keyframes spin-modern {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </svg>
          </div>
          <div style={{ color: '#2563eb', fontWeight: 700, fontSize: '1.35rem', marginTop: 32, letterSpacing: 0.5 }}>Finding places around you…</div>
          <div style={{ color: '#2563eb', fontWeight: 700, fontSize: '1.35rem', marginTop: 18, letterSpacing: 0.2 }}>
            {fetchError ? (
              <span style={{ color: '#dc2626', fontSize: '1.1rem' }}>{fetchError}</span>
            ) : (
              <>
                {tilesChecked > 0 && position && (
                  (() => {
                    const areaSqMeters = getTileAreaSqMeters(zoomLevel, position[0]);
                    let areaText = '';
                    if (areaSqMeters > 1000000) {
                      areaText = `${(areaSqMeters / 1000000).toFixed(2)} km²`;
                    } else if (areaSqMeters > 10000) {
                      areaText = `${(areaSqMeters / 10000).toFixed(1)} ha`;
                    } else {
                      areaText = `${Math.round(areaSqMeters).toLocaleString()} m²`;
                    }
                    return <span>Area covered: {areaText}</span>;
                  })()
                )}
                {elementsRetrieved > 0 && (
                  <span> &middot; {elementsRetrieved} element{elementsRetrieved > 1 ? 's' : ''} retrieved</span>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <div className="w-screen h-screen flex flex-row" style={{ position: 'relative' }}>
        <InitialModal
          show={showInitModal}
          onFindLocation={handleFindLocation}
          onClose={() => setShowInitModal(false)}
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
                  prompt:
                    "You are a strict markdown table generator. You must always output a markdown table with exactly these columns, in this order: Name, Description, Popularity, Insider Tips, Latitude, Longitude. Never omit or reorder columns, even if data is missing—leave the cell empty if needed. Output only the table, nothing else. The column header must be 'Popularity' (not 'Best for'). Do not use any other column headers.\nSummarize the most relevant tourist information from these OpenStreetMap elements."
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
          onAskFactReport={handleAskFactReport}
        />
        {/* Fact Report Panel */}
        <FactReportPanel
          open={leftPanelOpen}
          content={leftPanelContent}
          loading={leftPanelLoading}
          onClose={() => setLeftPanelOpen(false)}
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
            <FitBoundsListener />
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
                {/* Gemini Markers Component */}
                <GeminiMarkers summary={summary} />
                {/* Markers for OSM way elements (center) */}
                {osmData && osmData.length > 0 && (() => {
                  const wayElements = osmData.filter(el => 
                    el.type === 'way' && 
                    el.lat !== undefined && 
                    el.lon !== undefined &&
                    el.tags?.name && // Only show markers for named ways
                    el.tags.name.trim() !== '' // Ensure name is not empty
                  );
                  console.log('Total way elements with coordinates and names:', wayElements.length);
                  return wayElements.map((el) => {
                    // Way elements already have lat/lon set by getWayCenter during data processing
                    if (el.lat === undefined || el.lon === undefined) return null;
                    const wayIcon = L.divIcon({
                      className: 'way-marker',
                      html: `<div style="background:#059669;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.10);">W</div>`,
                      iconSize: [28, 28],
                      iconAnchor: [14, 28],
                      popupAnchor: [0, -28],
                    });
                    return (
                      <Marker key={`way-${el.id}`} position={[el.lat, el.lon]} icon={wayIcon}>
                        <Popup>
                          <div style={{ maxWidth: 300 }}>
                            <div className="font-bold mb-1">Way #{el.id}</div>
                            <div>{el.tags?.name || 'Unnamed way'}</div>
                            <div className="text-xs text-gray-700">center: lat: {el.lat.toFixed(6)}, lon: {el.lon.toFixed(6)}</div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  });
                })()}
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
