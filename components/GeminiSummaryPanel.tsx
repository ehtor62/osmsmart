import React from "react";

interface GeminiSummaryPanelProps {
  summary: string;
  open: boolean;
  minimized: boolean;
  onMinimize: () => void;
  onClose: () => void;
}

const GeminiSummaryPanel: React.FC<GeminiSummaryPanelProps> = ({
  summary,
  open,
  minimized,
  onMinimize,
  onClose,
}) => {
  // Responsive font size for table
  const getTableStyle = () => {
    const style: React.CSSProperties = {
      marginTop: 18,
      fontSize: '0.95rem',
    };
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 600px)').matches) {
      style.fontSize = '0.75rem';
    }
    return style;
  };

  // Render summary/table logic
  const renderSummary = () => {
    const tableRegex = /\|\s*Name\s*\|[\s\S]*?\n\|---[\s\S]*?(?=\n\n|$)/;
    const tableMatch = summary.match(tableRegex);
    const tableStyle = getTableStyle();
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
              if (!label.trim() || /^:?\u0002*$/.test(label.trim()) || label.trim() === ':') {
                return null;
              }
              const rowNumber = idx + 1;
              const numberedLabel = `${rowNumber}. ${label}`;
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <button
                    style={{
                      marginRight: 10,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    }}
                    title="Ask more about this place"
                    onClick={() => {
                      alert('Ask more about this place: ' + label);
                    }}
                  >
                    ?
                  </button>
                  <div
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: tableStyle.fontSize,
                      background: '#f1f5f9',
                      color: '#2563eb',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      textAlign: 'left',
                      cursor: 'default',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                      userSelect: 'text',
                    }}
                  >
                    {numberedLabel}
                  </div>
                </div>
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
  };

  // Panel height
  const panelHeight = 300;

  return (
    <>
      {/* Sliding top panel for Gemini results */}
      <div
        style={{
          position: "fixed",
          top: open && !minimized ? 0 : -panelHeight,
          left: 0,
          width: "100vw",
          height: panelHeight,
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
              onClick={onMinimize}
            >Minimize</button>
            <button
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              onClick={onClose}
            >Close</button>
          </div>
        </div>
        <div className="p-4" style={{ fontSize: '0.85rem', overflowWrap: 'anywhere', color: 'black', position: 'relative', paddingBottom: 64 }}>
          {renderSummary()}
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
              onClick={onMinimize}
            >Minimize</button>
            <button
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              onClick={onClose}
            >Close</button>
          </div>
        </div>
      </div>
      {/* Minimized Gemini summary button at top right */}
      {open && minimized && (
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
          onClick={onMinimize}
        >
          Show Gemini Summary
        </button>
      )}
    </>
  );
};

export default GeminiSummaryPanel;
