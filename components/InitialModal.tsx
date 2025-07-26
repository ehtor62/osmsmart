import React from "react";

interface InitialModalProps {
  show: boolean;
  cityMode: 'city center' | 'suburban' | 'countryside';
  onFindLocation: () => void;
  onClose: () => void;
  onToggleCityMode: (mode: 'city center' | 'suburban' | 'countryside') => void;
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
        {/* Mode selection buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10, gap: 16 }}>
          <button
            style={{
              padding: '8px 20px',
              background: cityMode === 'city center' ? '#2563eb' : '#e5e7eb',
              color: cityMode === 'city center' ? '#fff' : '#2563eb',
              border: cityMode === 'city center' ? '2px solid #2563eb' : '2px solid #e5e7eb',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: cityMode === 'city center' ? '0 2px 8px rgba(37,99,235,0.10)' : 'none',
              transition: 'background 0.2s',
              minWidth: 120,
            }}
            onClick={() => { if (cityMode !== 'city center') onToggleCityMode('city center'); }}
          >
            City Center
          </button>
          <button
            style={{
              padding: '8px 20px',
              background: cityMode === 'suburban' ? '#2563eb' : '#e5e7eb',
              color: cityMode === 'suburban' ? '#fff' : '#2563eb',
              border: cityMode === 'suburban' ? '2px solid #2563eb' : '2px solid #e5e7eb',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: cityMode === 'suburban' ? '0 2px 8px rgba(37,99,235,0.10)' : 'none',
              transition: 'background 0.2s',
              minWidth: 120,
            }}
            onClick={() => { if (cityMode !== 'suburban') onToggleCityMode('suburban'); }}
          >
            Suburban
          </button>
          <button
            style={{
              padding: '8px 20px',
              background: cityMode === 'countryside' ? '#2563eb' : '#e5e7eb',
              color: cityMode === 'countryside' ? '#fff' : '#2563eb',
              border: cityMode === 'countryside' ? '2px solid #2563eb' : '2px solid #e5e7eb',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: cityMode === 'countryside' ? '0 2px 8px rgba(37,99,235,0.10)' : 'none',
              transition: 'background 0.2s',
              minWidth: 120,
            }}
            onClick={() => { if (cityMode !== 'countryside') onToggleCityMode('countryside'); }}
          >
            Countryside
          </button>
        </div>
      </div>
    </div>
  );
};

export default InitialModal;
