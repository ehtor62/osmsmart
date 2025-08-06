import React from "react";

interface InitialModalProps {
  show: boolean;
  onFindLocation: () => void;
  onSpecificInterest: () => void;
  onClose: () => void;
}

const InitialModal: React.FC<InitialModalProps> = ({ show, onFindLocation, onSpecificInterest, onClose }) => {
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
            onClick={onSpecificInterest}
          >
            I have a specific interest
          </button>
        </div>
        {/* Mode selection buttons removed for new workflow */}
      </div>
    </div>
  );
};

export default InitialModal;
