/**
 * OpenStreetMap (OSM) element type definitions
 * These types represent the structure of OSM data elements returned from the Overpass API
 */

/**
 * Represents an OSM element (node, way, or relation)
 */
export type OsmElement = {
  /** Unique identifier for the OSM element */
  id: number;
  /** Type of OSM element: 'node', 'way', or 'relation' */
  type: string;
  /** Latitude coordinate (for nodes, or calculated center for ways) */
  lat?: number;
  /** Longitude coordinate (for nodes, or calculated center for ways) */
  lon?: number;
  /** Key-value tags containing metadata about the element */
  tags?: Record<string, string>;
  /** Array of node IDs that make up a way (only for way elements) */
  nodes?: number[];
  /** Array of members for relations (only for relation elements) */
  members?: Array<{ type: string; ref: number; role: string }>;
  /** Precomputed coordinates for way nodes (populated by backend) */
  nodeCoords?: Array<{ lat: number; lon: number }>;
};

/**
 * Represents the response structure from the Overpass API
 */
export interface OverpassResponse {
  /** API version */
  version: number;
  /** Generator information */
  generator: string;
  /** Array of OSM elements returned by the query */
  elements: OsmElement[];
}

/**
 * Represents a coordinate pair
 */
export interface Coordinate {
  lat: number;
  lon: number;
}

/**
 * Represents the bounds of a geographic area
 */
export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Type guard to check if an element is a node
 */
export function isNode(element: OsmElement): element is OsmElement & { lat: number; lon: number } {
  return element.type === 'node' && element.lat !== undefined && element.lon !== undefined;
}

/**
 * Type guard to check if an element is a way
 */
export function isWay(element: OsmElement): element is OsmElement & { nodes: number[] } {
  return element.type === 'way' && Array.isArray(element.nodes);
}

/**
 * Type guard to check if an element is a relation
 */
export function isRelation(element: OsmElement): element is OsmElement & { members: Array<{ type: string; ref: number; role: string }> } {
  return element.type === 'relation' && Array.isArray(element.members);
}

/**
 * Type guard to check if an element has coordinates
 */
export function hasCoordinates(element: OsmElement): element is OsmElement & { lat: number; lon: number } {
  return element.lat !== undefined && element.lon !== undefined;
}

/**
 * Type guard to check if an element has a name tag
 */
export function hasName(element: OsmElement): element is OsmElement & { tags: Record<string, string> & { name: string } } {
  return element.tags?.name !== undefined && element.tags.name.trim() !== '';
}
