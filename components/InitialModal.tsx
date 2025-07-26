import React from "react";

interface InitialModalProps {
  show: boolean;
  cityMode: 'inside' | 'outside';
  onFindLocation: () => void;
  onClose: () => void;
  onToggleCityMode: () => void;
}

const InitialModal: React.FC<InitialModalProps> = ({ show, cityMode, onFindLocation, onClose, onToggleCityMode }) => {
  if (!show) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(30, 41, 59, 0.55)',
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 16,
          boxShadow: '0 4px 32px rgba(0,0,0,0.15)',
          padding: '32px 40px',
          minWidth: 320,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <h1 style={{ fontSize: '1.55rem', fontWeight: 800, marginBottom: 2, color: '#2563eb' }}>Do You Know What&apos;s Around You?</h1>
        <h1
          style={{
            marginBottom: 4,
            fontWeight: 800,
            fontSize: '2rem',
            background: 'linear-gradient(90deg, #2563eb 0%, #a21caf 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            color: 'transparent',
            display: 'inline-block',
          }}
        >
          Discover and Explore
        </h1>
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center' }}>
          <button
            style={{
              padding: '10px 24px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
              transition: 'background 0.2s',
            }}
            onClick={onFindLocation}
          >
            Everything around me
          </button>
          <button
            style={{
              padding: '10px 24px',
              background: '#38bdf8',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
              transition: 'background 0.2s',
            }}
            onClick={onClose}
          >
            I have a specific interest
          </button>
        </div>
        {/* Toggle for inside/outside city */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              userSelect: 'none',
            }}
          >
            <span style={{ color: cityMode === 'inside' ? '#2563eb' : '#64748b', fontWeight: 600, fontSize: '0.98rem', minWidth: 70, textAlign: 'right' }}>inside city</span>
            <div
              role="switch"
              aria-checked={cityMode === 'outside'}
              tabIndex={0}
              onClick={onToggleCityMode}
              onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') onToggleCityMode(); }}
              style={{
                width: 54,
                height: 28,
                borderRadius: 16,
                background: cityMode === 'outside' ? '#2563eb' : '#e5e7eb',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s',
                outline: 'none',
                border: cityMode === 'outside' ? '2px solid #2563eb' : '2px solid #e5e7eb',
                boxShadow: cityMode === 'outside' ? '0 2px 8px rgba(37,99,235,0.10)' : 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 3,
                  left: cityMode === 'inside' ? 3 : 23,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  transition: 'left 0.2s',
                }}
              />
            </div>
            <span style={{ color: cityMode === 'outside' ? '#2563eb' : '#64748b', fontWeight: 600, fontSize: '0.98rem', minWidth: 80, textAlign: 'left' }}>outside city</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InitialModal;
