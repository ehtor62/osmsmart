import { useEffect, useState } from "react";
import { allowedTags } from "../utils/allowedTags";
import { 
  getWayCenter, 
  latLngToTile, 
  getTileBoundsXY 
} from "../components/MapHelpers";
import type { OsmElement } from "../types/osm";

export interface UseFetchOsmDataProps {
  shouldFetchOsm: boolean;
  position: [number, number] | null;
  gridSize: number;
  zoomLevel: number;
  onDataFetched: (data: OsmElement[]) => void;
  onSpinnerToggle: (show: boolean) => void;
  onPanelOpen: () => void;
  onGridSizeUpdate: (size: number) => void;
  onFetchComplete: () => void;
  onTilesCheckedUpdate?: (count: number) => void;
  onElementsRetrievedUpdate?: (count: number) => void;
  onFetchErrorUpdate?: (error: string | null) => void;
}

export interface UseFetchOsmDataReturn {
  tilesChecked: number;
  elementsRetrieved: number;
  fetchError: string | null;
}

export function useFetchOsmData({
  shouldFetchOsm,
  position,
  gridSize,
  zoomLevel,
  onDataFetched,
  onSpinnerToggle,
  onPanelOpen,
  onGridSizeUpdate,
  onFetchComplete,
  onTilesCheckedUpdate,
  onElementsRetrievedUpdate,
  onFetchErrorUpdate
}: UseFetchOsmDataProps): UseFetchOsmDataReturn {
  const [tilesChecked, setTilesChecked] = useState<number>(0);
  const [elementsRetrieved, setElementsRetrieved] = useState<number>(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOsmWithGrid = async (grid: number): Promise<OsmElement[]> => {
      if (!position) return [];
      setFetchError(null); // Clear any previous errors
      
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
      onTilesCheckedUpdate?.(tileCount);
      
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
            onFetchErrorUpdate?.('Failed to fetch data from server. Please try again.');
            return [];
          }
        }
      }
      
      if (!res || !res.ok) {
        console.error('Failed to fetch OSM data after all attempts');
        setFetchError('Server error. Please try again later.');
        onFetchErrorUpdate?.('Server error. Please try again later.');
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
          onElementsRetrievedUpdate?.(filtered.length);
          return filtered;
        }
        setElementsRetrieved(0);
        onElementsRetrievedUpdate?.(0);
        return [];
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        setFetchError('Invalid response from server. Please try again.');
        onFetchErrorUpdate?.('Invalid response from server. Please try again.');
        setElementsRetrieved(0);
        onElementsRetrievedUpdate?.(0);
        return [];
      }
    };

    const runFetch = async () => {
      if (shouldFetchOsm && position) {
        setFetchError(null); // Clear any previous errors
        onFetchErrorUpdate?.(null);
        let grid = gridSize;
        let elements: OsmElement[] = [];
        setTilesChecked(0);
        onTilesCheckedUpdate?.(0);
        setElementsRetrieved(0);
        onElementsRetrievedUpdate?.(0);
        do {
          elements = await fetchOsmWithGrid(grid);
          if (elements.length < 20) {
            grid += 2;
          }
        } while (elements.length < 20 && grid <= 29); // 21x21 max safeguard
        onDataFetched(elements);
        onSpinnerToggle(false); // Hide spinner only after OSM data is fetched
        onPanelOpen();
        onGridSizeUpdate(grid); // Update gridSize to match the final grid used for fetching
        onFetchComplete();
      }
    };
    runFetch();
  }, [shouldFetchOsm, position, gridSize, zoomLevel, onDataFetched, onSpinnerToggle, onPanelOpen, onGridSizeUpdate, onFetchComplete, onTilesCheckedUpdate, onElementsRetrievedUpdate, onFetchErrorUpdate]);

  return {
    tilesChecked,
    elementsRetrieved,
    fetchError
  };
}
