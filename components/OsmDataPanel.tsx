import React from "react";
import { getTagGroup } from "../utils/allowedTags";
import type { OsmElement } from "../types/osm";

interface OsmDataPanelProps {
  open: boolean;
  osmData: OsmElement[] | null;
  loadingSummary: boolean;
  onClose: () => void;
  onSummarize: () => void;
}

const OsmDataPanel: React.FC<OsmDataPanelProps> = ({ open, osmData, loadingSummary, onClose, onSummarize }) => {
  // Group elements by their tag categories
  const groupedElements = React.useMemo(() => {
    if (!osmData) return {};
    
    const groups: Record<string, OsmElement[]> = {};
    
    osmData.forEach((element) => {
      let assignedToGroup = false;
      
      if (element.tags) {
        // Check each tag to see which group it belongs to
        for (const [key, value] of Object.entries(element.tags)) {
          const tagString = `${key}:${value}`;
          const group = getTagGroup(tagString) || getTagGroup(key);
          
          if (group) {
            if (!groups[group]) {
              groups[group] = [];
            }
            groups[group].push(element);
            assignedToGroup = true;
            break; // Only assign to first matching group
          }
        }
      }
      
      // If no group found, add to "Other"
      if (!assignedToGroup) {
        if (!groups['Other']) {
          groups['Other'] = [];
        }
        groups['Other'].push(element);
      }
    });
    
    return groups;
  }, [osmData]);

  const totalElements = osmData?.length || 0;
  const groupNames = Object.keys(groupedElements).sort();

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: open ? 0 : -400,
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
          onClick={onClose}
        >Close</button>
      </div>
      <div className="p-4">
        <button
          className="mb-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors w-full"
          onClick={onSummarize}
          disabled={loadingSummary}
        >
          {loadingSummary ? "Summarizing..." : "Summarize"}
        </button>
        <div style={{ marginBottom: 12, textAlign: 'center', color: '#2563eb', fontWeight: 500, fontSize: '0.95rem' }}>
          {osmData === null 
            ? 'Loading...' 
            : totalElements 
              ? `${totalElements} element${totalElements === 1 ? '' : 's'} found` 
              : 'Nothing found.'
          }
        </div>
        
        {osmData ? (
          <div className="text-xs">
            {groupNames.map((groupName) => (
              <div key={groupName} className="mb-4">
                <h3 className="font-bold text-sm mb-2 text-blue-800 border-b border-blue-200 pb-1">
                  {groupName} ({groupedElements[groupName].length})
                </h3>
                <div className="ml-2">
                  {groupedElements[groupName].map((el, idx) => (
                    <div key={`${groupName}-${idx}`} className="mb-3 border-b border-gray-100 pb-2">
                      <div className="font-semibold text-gray-700">
                        {el.type} #{el.id}
                      </div>
                      <ul className="ml-2 mb-1" style={{ fontSize: '0.7rem' }}>
                        {Object.entries(el.tags ?? {}).map(([key, value]) => (
                          <li key={key} className="text-gray-600">
                            <span className="font-mono text-blue-600">{key}</span>
                            {": "}
                            <span className="font-mono text-green-600">{value}</span>
                          </li>
                        ))}
                      </ul>
                      {el.lat !== undefined && el.lon !== undefined && (
                        <div className="text-xs text-gray-500">
                          lat: {el.lat.toFixed(6)}, lon: {el.lon.toFixed(6)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500">Loading OSM data...</div>
        )}
      </div>
    </div>
  );
};

export default OsmDataPanel;
