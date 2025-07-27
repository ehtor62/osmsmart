import React from "react";

type OsmElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
  members?: Array<{ type: string; ref: number; role: string }>;
};

interface OsmDataPanelProps {
  open: boolean;
  osmData: OsmElement[] | null;
  loadingSummary: boolean;
  onClose: () => void;
  onSummarize: () => void;
}

const OsmDataPanel: React.FC<OsmDataPanelProps> = ({ open, osmData, loadingSummary, onClose, onSummarize }) => (
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
        {osmData ? `${osmData.length} element${osmData.length === 1 ? '' : 's'} found` : 'Loading...'}
      </div>
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
            </li>
          ))
        ) : (
          <li>Loading OSM data...</li>
        )}
      </ul>
    </div>
  </div>
);

export default OsmDataPanel;
