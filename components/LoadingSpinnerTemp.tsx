"use client";

interface LoadingSpinnerProps {
  show: boolean;
  type: 'gemini' | 'modern';
  message?: string;
  zIndex?: number;
  // Props for modern spinner
  fetchError?: string | null;
  currentRadius?: number;
  elementsRetrieved?: number;
  getRadiusAreaSqMeters?: (radius: number) => number;
}

export default function LoadingSpinner({
  show,
  type,
  message,
  zIndex = 6000,
  fetchError,
  currentRadius = 0,
  elementsRetrieved = 0,
  getRadiusAreaSqMeters
}: LoadingSpinnerProps) {
  if (!show) return null;

  if (type === 'modern') {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(30, 41, 59, 0.75)',
          zIndex: zIndex,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ marginBottom: '20px' }}>
            <div className="spinner" />
          </div>
          <div>
            {fetchError ? (
              <span style={{ color: '#dc2626', fontSize: '1.1rem' }}>{fetchError}</span>
            ) : (
              <>
                {currentRadius > 0 && (
                  <div>
                    <span>Searching radius: {currentRadius}m</span>
                    {getRadiusAreaSqMeters && (
                      <div>Area: {Math.round(getRadiusAreaSqMeters(currentRadius)).toLocaleString()} m²</div>
                    )}
                  </div>
                )}
                <span>Found {elementsRetrieved} items</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Gemini spinner fallback
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
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <div style={{ color: 'white', fontSize: '1.2rem' }}>
        {message || 'Loading...'}
      </div>
    </div>
  );
}
