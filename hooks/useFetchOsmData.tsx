import { useEffect, useState, useRef } from "react";
import { allowedTags } from "../utils/allowedTags";
import type { OsmElement } from "../types/osm";

export interface UseFetchOsmDataProps {
  shouldFetchOsm: boolean;
  position: [number, number] | null;
  radius?: number; // Optional radius in meters (defaults to 200m)
  filteredTags?: Set<string>; // Optional filtered tags for specific interests
  onDataFetched: (data: OsmElement[]) => void;
  onSpinnerToggle: (show: boolean) => void;
  onPanelOpen: () => void;
  onRadiusUpdate: (radius: number) => void; // Updated from onGridSizeUpdate
  onFetchComplete: () => void;
  onRadiusCheckedUpdate?: (radius: number) => void; // Updated from onTilesCheckedUpdate
  onElementsRetrievedUpdate?: (count: number) => void;
  onFetchErrorUpdate?: (error: string | null) => void;
}

export interface UseFetchOsmDataReturn {
  currentRadius: number; // Updated from tilesChecked
  elementsRetrieved: number;
  fetchError: string | null;
}

export function useFetchOsmData({
  shouldFetchOsm,
  position,
  radius = 25, // Start even smaller for faster initial results
  filteredTags,
  onDataFetched,
  onSpinnerToggle,
  onPanelOpen,
  onRadiusUpdate,
  onFetchComplete,
  onRadiusCheckedUpdate,
  onElementsRetrievedUpdate,
  onFetchErrorUpdate
}: UseFetchOsmDataProps): UseFetchOsmDataReturn {
  const [currentRadius, setCurrentRadius] = useState<number>(radius);
  const [elementsRetrieved, setElementsRetrieved] = useState<number>(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Global rate limiting - track last request time
  const lastRequestTimeRef = useRef<number>(0);
  const minRequestInterval = 1500; // Minimum 1.5 seconds between requests

  useEffect(() => {
    // Enhanced fetch function that can search ring areas (incremental)
    const fetchOsmWithRing = async (outerRadius: number, innerRadius: number = 0): Promise<{ elements: OsmElement[], error?: string }> => {
      if (!position) return { elements: [] };
      setFetchError(null); // Clear any previous errors
      
      setCurrentRadius(outerRadius);
      onRadiusCheckedUpdate?.(outerRadius);
      
      // Add retry logic for fetch requests
      let res;
      let attempts = 0;
      const maxAttempts = 3;
      
      // Global rate limiting - ensure minimum interval between requests
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTimeRef.current;
      if (timeSinceLastRequest < minRequestInterval) {
        const additionalDelay = minRequestInterval - timeSinceLastRequest;
        console.log(`Global rate limiting: waiting additional ${additionalDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, additionalDelay));
      }
      lastRequestTimeRef.current = Date.now();

      // Add delay to prevent rate limiting (especially important for incremental search)
      if (innerRadius > 0) {
        // For ring queries, add a 2-second delay to be respectful to Overpass API
        console.log(`Adding 2-second delay before ring query (${innerRadius}m-${outerRadius}m)...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else if (outerRadius > 25) {
        // For subsequent radius queries, add a 1-second delay
        console.log(`Adding 1-second delay before radius query (${outerRadius}m)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      while (attempts < maxAttempts) {
        try {
          // Create timeout controller manually for better compatibility
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          // Build API URL with ring parameters for true incremental search
          let apiUrl = `/api/tile?lat=${position[0]}&lng=${position[1]}&radius=${outerRadius}`;
          if (innerRadius > 0) {
            apiUrl += `&innerRadius=${innerRadius}`;
          }
          
          res = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (res.ok) break; // Success, exit retry loop
          
          if (res.status === 408) {
            // Timeout error, don't retry - area might be too large
            console.error('Request timeout - radius too large or server overloaded');
            setFetchError('Request timeout - try a smaller area or wait and try again');
            onFetchErrorUpdate?.('Request timeout - try a smaller area or wait and try again');
            return { elements: [], error: 'TIMEOUT' };
          }
          
          if (res.status === 413) {
            // Payload too large error, don't retry - area contains too much data
            console.error('Data too large - radius contains too much data');
            setFetchError('Area too large - contains too much data. Please try a smaller area or use specific interests.');
            onFetchErrorUpdate?.('Area too large - contains too much data. Please try a smaller area or use specific interests.');
            return { elements: [], error: 'PAYLOAD_TOO_LARGE' };
          }
          
          if (res.status === 429) {
            // Rate limit error - retry with exponential backoff
            attempts++;
            if (attempts < maxAttempts) {
              const delay = Math.pow(2, attempts) * 2000; // 4s, 8s, 16s
              console.warn(`Rate limit exceeded, waiting ${delay}ms before retry (${attempts}/${maxAttempts})`);
              setFetchError(`Rate limit exceeded - waiting ${delay/1000}s before retry...`);
              onFetchErrorUpdate?.(`Rate limit exceeded - waiting ${delay/1000}s before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            } else {
              console.error('Rate limit exceeded - max retries reached');
              setFetchError('Rate limit exceeded - please wait a moment and try again');
              onFetchErrorUpdate?.('Rate limit exceeded - please wait a moment and try again');
              return { elements: [], error: 'RATE_LIMIT' };
            }
          }
          
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
            return { elements: [], error: 'CLIENT_ERROR' };
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
            return { elements: [], error: 'FETCH_FAILED' };
          }
        }
      }
      
      if (!res || !res.ok) {
        console.error('Failed to fetch OSM data after all attempts');
        setFetchError('Server error. Please try again later.');
        onFetchErrorUpdate?.('Server error. Please try again later.');
        return { elements: [], error: 'SERVER_ERROR' };
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
          const tagsToUse = filteredTags && filteredTags.size > 0 ? filteredTags : allowedTags;
          console.log('Using tags for filtering:', tagsToUse.size, 'tags');
          if (filteredTags && filteredTags.size > 0) {
            console.log('Filtered tags being used:', Array.from(filteredTags));
          }
          
          const filtered = data.elements.filter((el: OsmElement) => {
            if (!el.tags) return false;
            // Check if any tag matches our allowed tags
            const hasMatchingTag = Object.entries(el.tags).some(([key, value]) => {
              const fullTag = `${key}:${value}`;
              const keyOnlyMatch = tagsToUse.has(key);
              const fullTagMatch = tagsToUse.has(fullTag);
              
              if (filteredTags && filteredTags.size > 0) {
                // When using filtered tags, be more strict - prefer full tag matches
                return fullTagMatch || keyOnlyMatch;
              } else {
                // Original behavior for general exploration
                return fullTagMatch || keyOnlyMatch;
              }
            });
            
            if (hasMatchingTag && filteredTags && filteredTags.size > 0) {
              console.log('Element passed filter:', el.id, Object.entries(el.tags).map(([k,v]) => `${k}:${v}`));
            }
            
            return hasMatchingTag;
          });
          
          // Note: Way centroids are now provided directly by the API (lat/lon fields)
          // No need for manual coordinate resolution
          
          console.log(`Filtered ${filtered.length} elements from ${data.elements.length} total elements`);
          if (filteredTags && filteredTags.size > 0) {
            console.log('Filter summary: Found', filtered.length, 'matching elements for filtered tags');
          }
          
          setElementsRetrieved(filtered.length);
          onElementsRetrievedUpdate?.(filtered.length);
          return { elements: filtered };
        }
        setElementsRetrieved(0);
        onElementsRetrievedUpdate?.(0);
        return { elements: [] };
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        setFetchError('Invalid response from server. Please try again.');
        onFetchErrorUpdate?.('Invalid response from server. Please try again.');
        setElementsRetrieved(0);
        onElementsRetrievedUpdate?.(0);
        return { elements: [], error: 'JSON_PARSE_ERROR' };
      }
    };

    const runFetch = async () => {
      if (shouldFetchOsm && position) {
        setFetchError(null); // Clear any previous errors
        onFetchErrorUpdate?.(null);
        let searchRadius = radius; // Start with the provided radius
        let result: { elements: OsmElement[], error?: string } = { elements: [] };
        let allElements: OsmElement[] = []; // Accumulate elements from all searches
        let bestResult: { elements: OsmElement[], error?: string } = { elements: [] };
        let previousRadius = 0; // Track previous radius for true incremental search
        let rateLimitDetected = false; // Track if we hit rate limits
        setCurrentRadius(searchRadius);
        onRadiusCheckedUpdate?.(searchRadius);
        setElementsRetrieved(0);
        onElementsRetrievedUpdate?.(0);
        
        do {
          // True incremental search: only search the ring between previousRadius and searchRadius
          result = await fetchOsmWithRing(searchRadius, previousRadius);
          
          // Handle rate limiting by switching to less aggressive strategy
          if (result.error === 'RATE_LIMIT') {
            console.log('Rate limit detected - switching to less aggressive search strategy');
            rateLimitDetected = true;
            break;
          }
          
          // Stop radius expansion if we encounter certain errors
          if (result.error && ['PAYLOAD_TOO_LARGE', 'TIMEOUT'].includes(result.error)) {
            console.log(`Stopping radius expansion due to error: ${result.error}`);
            break;
          }
          
          // Add new elements from this ring search
          allElements = [...allElements, ...result.elements];
          
          console.log(`Ring ${previousRadius}m-${searchRadius}m: Found ${result.elements.length} new elements. Total accumulated: ${allElements.length}`);
          
          // Update progress with total accumulated elements
          setElementsRetrieved(allElements.length);
          onElementsRetrievedUpdate?.(allElements.length);
          
          // Update best result with accumulated elements
          bestResult = { elements: allElements };
          
          // Early termination based on accumulated elements
          if (allElements.length >= 20) {
            console.log(`Found sufficient elements (${allElements.length}), stopping search at radius ${searchRadius}m`);
            break;
          }
          
          // Prepare for next iteration
          previousRadius = searchRadius;
          
          // Intelligent increment strategy
          if (allElements.length === 0 && searchRadius < 100) {
            // If nothing found in small radius, jump further
            searchRadius += 75; 
          } else if (allElements.length < 20) {
            // Otherwise use smaller increments
            searchRadius += 50; 
          }
        } while (allElements.length < 20 && searchRadius <= 2000);

        // Fallback strategy if rate limiting was detected and we have insufficient results
        if (rateLimitDetected && allElements.length < 5) {
          console.log('Rate limit fallback: trying single larger radius query');
          try {
            // Wait longer before fallback attempt
            await new Promise(resolve => setTimeout(resolve, 5000));
            // Try a single, larger radius query without incremental search
            const fallbackResult = await fetchOsmWithRing(200, 0); // Single 200m radius
            if (fallbackResult.elements.length > allElements.length) {
              allElements = fallbackResult.elements;
              bestResult = { elements: allElements };
              console.log(`Fallback successful: Found ${allElements.length} elements`);
            }
          } catch {
            console.log('Fallback also failed, using best result found');
          }
        }

        // Use the accumulated result
        onDataFetched(bestResult.elements);
        onSpinnerToggle(false); // Hide spinner only after OSM data is fetched
        onPanelOpen();
        onRadiusUpdate(searchRadius); // Update radius to match the final radius used for fetching
        onFetchComplete();
      }
    };
    runFetch();
  }, [shouldFetchOsm, position, radius, filteredTags, onDataFetched, onSpinnerToggle, onPanelOpen, onRadiusUpdate, onFetchComplete, onRadiusCheckedUpdate, onElementsRetrievedUpdate, onFetchErrorUpdate]);

  return {
    currentRadius,
    elementsRetrieved,
    fetchError
  };
}
