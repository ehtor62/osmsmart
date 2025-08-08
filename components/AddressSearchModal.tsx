import React, { useState, useEffect, useRef } from "react";

interface AddressSearchResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

interface AddressSearchModalProps {
  show: boolean;
  onLocationSelect: (lat: number, lon: number, name: string) => void;
  onClose: () => void;
}

const AddressSearchModal: React.FC<AddressSearchModalProps> = ({ show, onLocationSelect, onClose }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (show && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [show]);

  // Clear search when modal closes
  useEffect(() => {
    if (!show) {
      setQuery("");
      setResults([]);
      setError(null);
    }
  }, [show]);

  const searchAddress = async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `format=json&` +
        `q=${encodeURIComponent(searchQuery)}&` +
        `limit=5&` +
        `addressdetails=1&` +
        `extratags=1`,
        {
          headers: {
            'User-Agent': 'OSMSmart/1.0 (https://osmsmart.com)',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data: AddressSearchResult[] = await response.json();
      setResults(data);
    } catch (err) {
      setError('Failed to search addresses. Please try again.');
      console.error('Nominatim search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(() => {
      searchAddress(value);
    }, 300);
  };

  const handleResultClick = (result: AddressSearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    onLocationSelect(lat, lon, result.display_name);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && results.length > 0) {
      handleResultClick(results[0]);
    }
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
        zIndex: 6000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 16,
          boxShadow: '0 4px 32px rgba(0,0,0,0.15)',
          padding: '24px',
          minWidth: 400,
          maxWidth: 500,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#2563eb' }}>
            Search for a Location
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280',
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            placeholder="Enter an address, city, or place name..."
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: 8,
              fontSize: '1rem',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#2563eb';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb';
            }}
          />
          {loading && (
            <div
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 20,
                height: 20,
                border: '2px solid #e5e7eb',
                borderTop: '2px solid #2563eb',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          )}
        </div>

        {error && (
          <div
            style={{
              color: '#dc2626',
              backgroundColor: '#fef2f2',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div
            style={{
              maxHeight: 300,
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
            }}
          >
            {results.map((result) => (
              <div
                key={result.place_id}
                onClick={() => handleResultClick(result)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f3f4f6',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>
                  {result.display_name.split(',')[0]}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>
                  {result.display_name}
                </div>
              </div>
            ))}
          </div>
        )}

        {query.length >= 3 && !loading && results.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '0.875rem',
              padding: '16px',
            }}
          >
            No locations found. Try a different search term.
          </div>
        )}

        <div
          style={{
            fontSize: '0.75rem',
            color: '#9ca3af',
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          Powered by OpenStreetMap Nominatim
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: translateY(-50%) rotate(0deg); }
          100% { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AddressSearchModal;
