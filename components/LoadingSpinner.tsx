"use client";

interface LoadingSpinnerProps {
  show: boolean;
  type: 'gemini' | 'modern';
  message?: string;
  zIndex?: number;
  // Props for modern spinner
  fetchError?: string | null;
  tilesChecked?: number;
  elementsRetrieved?: number;
  position?: [number, number] | null;
  getTileAreaSqMeters?: (zoom: number, lat: number) => number;
  zoomLevel?: number;
}

export default function LoadingSpinner({
  show,
  type,
  message,
  zIndex = 6000,
  fetchError,
  tilesChecked = 0,
  elementsRetrieved = 0,
  position,
  getTileAreaSqMeters,
  zoomLevel = 17
}: LoadingSpinnerProps) {
  if (!show) return null;

  // Gemini spinner (simple CSS animation)
  if (type === 'gemini') {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(30, 41, 59, 0.25)',
          zIndex: zIndex,
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
        <div style={{ 
          color: '#2563eb', 
          fontWeight: 600, 
          fontSize: '1.15rem', 
          letterSpacing: 0.5 
        }}>
          {message || 'asking local guides…'}
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Modern spinner (SVG with progress information)
  if (type === 'modern') {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(30, 41, 59, 0.25)',
          zIndex: zIndex,
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
        <div style={{ 
          color: '#2563eb', 
          fontWeight: 700, 
          fontSize: '1.35rem', 
          marginTop: 32, 
          letterSpacing: 0.5 
        }}>
          {message || 'Finding places around you…'}
        </div>
        <div style={{ 
          color: '#2563eb', 
          fontWeight: 700, 
          fontSize: '1.35rem', 
          marginTop: 18, 
          letterSpacing: 0.2 
        }}>
          {fetchError ? (
            <span style={{ color: '#dc2626', fontSize: '1.1rem' }}>{fetchError}</span>
          ) : (
            <>
              {tilesChecked > 0 && position && getTileAreaSqMeters && (
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
    );
  }

  return null;
}
