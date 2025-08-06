"use client";
import { useEffect, useState, useCallback } from "react";
import { useFetchOsmData } from "../hooks/useFetchOsmData";
import type { OsmElement } from "../types/osm";
import { tagGroups } from "../utils/allowedTags";
import InitialModal from "./InitialModal";
import InterestSelectionModal from "./InterestSelectionModal";
import { MapContainer, TileLayer, Marker, Popup, Rectangle } from "react-leaflet";
import OsmDataPanel from "./OsmDataPanel";
import GeminiSummaryPanel from "./GeminiSummaryPanel";
import FactReportPanel, { useFactReportLogic } from "./FactReportPanel";
import GeminiMarkers from "./GeminiMarkers";
import LoadingSpinner from "./LoadingSpinner";
import { 
  getTileAreaSqMeters, 
  calculateTileBounds,
  CenterMap, 
  FitBoundsListener,
  type TileBounds 
} from "./MapHelpers";

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
  const [showInterestModal, setShowInterestModal] = useState<boolean>(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [shouldFetchOsm, setShouldFetchOsm] = useState<boolean>(false);
  const [showSpinner, setShowSpinner] = useState<boolean>(false);
  const [spinnerMode, setSpinnerMode] = useState<'fetching' | 'centering'>('fetching');
  const [gridSize, setGridSize] = useState<number>(3); // start with 3x3
  const [filteredTags, setFilteredTags] = useState<Set<string> | undefined>(undefined);
  const [mapMode, setMapMode] = useState<'explore' | 'interest'>('explore'); // Track map mode
  
  // Real-time fetch progress states
  const [tilesChecked, setTilesChecked] = useState<number>(0);
  const [elementsRetrieved, setElementsRetrieved] = useState<number>(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Always use zoom 17 for tile calculations as per user request
  const zoomLevel = 17;

  // Callback functions wrapped with useCallback to prevent unnecessary re-renders
  const handleDataFetched = useCallback((data: OsmElement[]) => setOsmData(data), []);
  const handleSpinnerToggle = useCallback((show: boolean) => setShowSpinner(show), []);
  const handlePanelOpen = useCallback(() => setPanelOpen(true), []);
  const handleGridSizeUpdate = useCallback((size: number) => setGridSize(size), []);
  const handleFetchComplete = useCallback(() => setShouldFetchOsm(false), []);
  const handleTilesCheckedUpdate = useCallback((count: number) => setTilesChecked(count), []);
  const handleElementsRetrievedUpdate = useCallback((count: number) => setElementsRetrieved(count), []);
  const handleFetchErrorUpdate = useCallback((error: string | null) => setFetchError(error), []);

  // Use the fetch OSM data hook
  const { } = useFetchOsmData({
    shouldFetchOsm,
    position,
    gridSize,
    zoomLevel,
    filteredTags,
    onDataFetched: handleDataFetched,
    onSpinnerToggle: handleSpinnerToggle,
    onPanelOpen: handlePanelOpen,
    onGridSizeUpdate: handleGridSizeUpdate,
    onFetchComplete: handleFetchComplete,
    onTilesCheckedUpdate: handleTilesCheckedUpdate,
    onElementsRetrievedUpdate: handleElementsRetrievedUpdate,
    onFetchErrorUpdate: handleFetchErrorUpdate
  });

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
    setSpinnerMode('fetching');
    setMapMode('explore');
    setGridSize(3); // always start with 3x3
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude+0.69, pos.coords.longitude+2.82]);
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

  // Function to handle "I have a specific interest" - center map on current location without fetching OSM data
  const handleSpecificInterest = () => {
    setShowInitModal(false);
    // Show a brief spinner to indicate location detection
    setShowSpinner(true);
    setSpinnerMode('centering');
    setMapMode('interest');
    // Clear any existing OSM data to show a clean map
    setOsmData(null);
    setPanelOpen(false);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude+0.68, pos.coords.longitude+2.9]);
          // Hide spinner and show interest selection modal
          setTimeout(() => {
            setShowSpinner(false);
            setShowInterestModal(true);
          }, 800);
        },
        () => {
          setPosition([47.3769, 8.5417]); // fallback: Zurich
          setTimeout(() => {
            setShowSpinner(false);
            setShowInterestModal(true);
          }, 800);
        }
      );
    } else {
      setPosition([47.3769, 8.5417]); // fallback: Zurich
      setTimeout(() => {
        setShowSpinner(false);
        setShowInterestModal(true);
      }, 800);
    }
  };

  // Function to handle interest selection confirmation
  const handleInterestConfirm = (interests: string[]) => {
    setShowInterestModal(false);
    setSelectedInterests(interests);
    console.log('Selected interests:', interests);
    
    // Create filtered tags based on selected interests
    if (interests.length > 0) {
      const filteredTagsSet = new Set<string>();
      
      // Add tags from each selected interest category
      interests.forEach(interest => {
        // Capitalize first letter to match tagGroups keys (Transport, Sport, Health, Food)
        const capitalizedInterest = interest.charAt(0).toUpperCase() + interest.slice(1);
        const categoryTags = tagGroups[capitalizedInterest as keyof typeof tagGroups];
        if (categoryTags) {
          categoryTags.forEach((tag: string) => filteredTagsSet.add(tag));
        } else {
          console.warn(`No tags found for interest category: ${capitalizedInterest}`);
        }
      });
      
      console.log(`Created filtered tags for ${interests.join(', ')}:`, filteredTagsSet.size, 'tags');
      console.log('Sample filtered tags:', Array.from(filteredTagsSet).slice(0, 10));
      
      // Clear previous OSM data and close panels before starting filtered fetch
      setOsmData(null);
      setPanelOpen(false);
      setTopPanelOpen(false);
      
      // Show spinner with fetching mode to display progress indicators
      setShowSpinner(true);
      setSpinnerMode('fetching');
      
      // Set the filtered tags and trigger OSM fetching
      setFilteredTags(filteredTagsSet);
      setShouldFetchOsm(true);
    }
  };

  // Function to handle interest selection cancellation
  const handleInterestCancel = () => {
    setShowInterestModal(false);
    setSelectedInterests([]); // Clear any selected interests
    // Optionally return to initial modal or just show the map
    setShowInitModal(true);
  };

  // tileBounds must be declared before useEffect
  let tileBounds: TileBounds | null = null;
  if (position) {
    tileBounds = calculateTileBounds(position, gridSize, zoomLevel);
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
      {/* Gemini Loading Spinner */}
      <LoadingSpinner
        show={showGeminiSpinner}
        type="gemini"
        message="asking local guides…"
        zIndex={7000}
      />
      {/* Modern Loading Spinner */}
      <LoadingSpinner
        show={showSpinner && !panelOpen}
        type="modern"
        message={spinnerMode === 'centering' ? "Finding your location…" : "Finding places around you…"}
        zIndex={6000}
        fetchError={spinnerMode === 'centering' ? null : fetchError}
        tilesChecked={spinnerMode === 'centering' ? 0 : tilesChecked}
        elementsRetrieved={spinnerMode === 'centering' ? 0 : elementsRetrieved}
        position={position}
        getTileAreaSqMeters={spinnerMode === 'centering' ? undefined : (zoom: number, lat: number) => 
          getTileAreaSqMeters(zoom, lat, tilesChecked, position)
        }
        zoomLevel={zoomLevel}
      />
      <div className="w-screen h-screen flex flex-row" style={{ position: 'relative' }}>
        <InitialModal
          show={showInitModal}
          onFindLocation={handleFindLocation}
          onSpecificInterest={handleSpecificInterest}
        />
        <InterestSelectionModal
          show={showInterestModal}
          onConfirm={handleInterestConfirm}
          onClose={handleInterestCancel}
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
            setMapMode('explore'); // Reset to explore mode
            setSelectedInterests([]); // Clear selected interests
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
            zoom={mapMode === 'interest' ? 18 : zoomLevel} // Higher zoom for specific interest mode
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
                      {selectedInterests.length > 0 && (
                        <div style={{ marginTop: 8, marginBottom: 8 }}>
                          <div className="text-sm font-medium text-blue-600">Interested in:</div>
                          <div className="text-sm text-gray-600">
                            {selectedInterests.map(interest => 
                              interest.charAt(0).toUpperCase() + interest.slice(1)
                            ).join(', ')}
                          </div>
                        </div>
                      )}
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
