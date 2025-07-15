import React from "react";

interface GeminiResultProps {
  result: string;
  loading: boolean;
}

const GeminiResult: React.FC<GeminiResultProps> = ({ result, loading }) => {
  if (loading) {
    // Show huge spinner overlay
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(255,255,255,0.85)",
        zIndex: 3000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{
          width: 120,
          height: 120,
          border: "16px solid #e0e7ef",
          borderTop: "16px solid #2563eb",
          borderRadius: "50%",
          animation: "spin 1.2s linear infinite"
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Extract markdown table and summary from result
  const tableMatch = result.match(/<table[\s\S]*?<\/table>/i);
  const tableHtml = tableMatch ? tableMatch[0] : "";
  const summaryHtml = tableMatch
    ? result.replace(tableMatch[0], "")
    : result;

  return (
    <>
      {(tableHtml || summaryHtml) && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          zIndex: 2000,
          background: "#fff",
          boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
          padding: "2rem 4vw 2rem 4vw",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          maxHeight: "80vh",
          overflowY: "auto",
          fontSize: "0.65rem"
        }}>
          {tableHtml && (
            <div style={{ width: "100%", maxWidth: 900, fontSize: "0.65rem" }} dangerouslySetInnerHTML={{ __html: tableHtml }} />
          )}
          {summaryHtml && (
            <div style={{ width: "100%", maxWidth: 900, marginTop: "1.5rem", fontSize: "0.65rem" }} dangerouslySetInnerHTML={{ __html: summaryHtml }} />
          )}
        </div>
      )}
    </>
  );
};

export default GeminiResult;
