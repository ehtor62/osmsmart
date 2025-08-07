import React, { useState } from "react";

interface InterestSelectionModalProps {
  show: boolean;
  onConfirm: (selectedInterests: string[]) => void;
  onClose: () => void;
}

const InterestSelectionModal: React.FC<InterestSelectionModalProps> = ({ 
  show, 
  onConfirm, 
  onClose 
}) => {
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const interests = [
    { id: 'entertainment', label: 'Entertainment' },
    { id: 'eating', label: 'Eating' },
    { id: 'drinking', label: 'Drinking' },
    { id: 'sport', label: 'Sport' },
    { id: 'culture', label: 'Culture' },
    { id: 'history', label: 'History' },
    { id: 'nature', label: 'Nature' },
    { id: 'cars', label: 'Cars' },
    { id: 'bus', label: 'Bus' },
    { id: 'bikes', label: 'Bikes' },
    { id: 'water_transport', label: 'Water_Transport' },
    { id: 'air_transport', label: 'Air_Transport' },
    { id: 'rail', label: 'Rail' }
    ];

  const handleInterestToggle = (interestId: string) => {
    setSelectedInterests(prev => 
      prev.includes(interestId)
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedInterests);
    setSelectedInterests([]); // Reset for next time
  };

  const handleClose = () => {
    setSelectedInterests([]); // Reset on close
    onClose();
  };

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
        zIndex: 5500, // Higher than InitialModal
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
          minWidth: 600,
          maxWidth: 700,
          maxHeight: '90vh',
          overflowY: 'auto',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 700, 
          marginBottom: 8, 
          color: '#2563eb',
          margin: 0
        }}>
          What are you interested in?
        </h2>
        
        <p style={{ 
          color: '#64748b', 
          fontSize: '0.95rem', 
          margin: 0,
          lineHeight: 1.5
        }}>
          Select the categories you&apos;d like to explore around your location
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          textAlign: 'left',
          margin: '8px 0'
        }}>
          {interests.map((interest) => (
            <label
              key={interest.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: 8,
                background: selectedInterests.includes(interest.id) 
                  ? 'rgba(37, 99, 235, 0.1)' 
                  : 'rgba(248, 250, 252, 0.8)',
                border: selectedInterests.includes(interest.id)
                  ? '2px solid #2563eb'
                  : '2px solid #e2e8f0',
                transition: 'all 0.2s ease',
                fontSize: '0.9rem',
              }}
              onMouseEnter={(e) => {
                if (!selectedInterests.includes(interest.id)) {
                  e.currentTarget.style.background = 'rgba(248, 250, 252, 1)';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }
              }}
              onMouseLeave={(e) => {
                if (!selectedInterests.includes(interest.id)) {
                  e.currentTarget.style.background = 'rgba(248, 250, 252, 0.8)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }
              }}
            >
              <input
                type="checkbox"
                checked={selectedInterests.includes(interest.id)}
                onChange={() => handleInterestToggle(interest.id)}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: '#2563eb',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
              <span style={{
                fontSize: '0.9rem',
                fontWeight: 500,
                color: '#334155',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {interest.label}
              </span>
            </label>
          ))}
        </div>

        <div style={{ 
          display: 'flex', 
          gap: 12, 
          justifyContent: 'center',
          marginTop: 8
        }}>
          <button
            style={{
              padding: '12px 24px',
              background: '#64748b',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
              transition: 'background 0.2s',
              minWidth: 100,
            }}
            onClick={handleClose}
            onMouseEnter={(e) => e.currentTarget.style.background = '#475569'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#64748b'}
          >
            Cancel
          </button>
          <button
            style={{
              padding: '12px 24px',
              background: selectedInterests.length > 0 ? '#2563eb' : '#cbd5e1',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: selectedInterests.length > 0 ? 'pointer' : 'not-allowed',
              boxShadow: selectedInterests.length > 0 ? '0 2px 8px rgba(0,0,0,0.10)' : 'none',
              transition: 'background 0.2s',
              minWidth: 100,
            }}
            onClick={handleConfirm}
            disabled={selectedInterests.length === 0}
            onMouseEnter={(e) => {
              if (selectedInterests.length > 0) {
                e.currentTarget.style.background = '#1d4ed8';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedInterests.length > 0) {
                e.currentTarget.style.background = '#2563eb';
              }
            }}
          >
            Explore ({selectedInterests.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterestSelectionModal;
