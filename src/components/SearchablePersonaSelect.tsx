"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface PersonaOption {
  id: string;
  name: string;
  idNumber?: string;
  area?: string;
  cargo?: string;
  [key: string]: any;
}

interface SearchablePersonaSelectProps {
  value: string;
  onChange: (value: string) => void;
  personas: PersonaOption[];
  placeholder?: string;
  disabled?: boolean;
}

export default function SearchablePersonaSelect({
  value,
  onChange,
  personas = [],
  placeholder = '-- Sin asignar --',
  disabled = false,
}: SearchablePersonaSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Find currently selected persona
  const selectedPersona = useMemo(() => {
    return personas.find((p) => p.id === value);
  }, [personas, value]);

  // Filter personas based on search term
  const filteredPersonas = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return personas;
    return personas.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const idNum = (p.idNumber || '').toLowerCase();
      const area = (p.area || '').toLowerCase();
      const cargo = (p.cargo || '').toLowerCase();
      return name.includes(q) || idNum.includes(q) || area.includes(q) || cargo.includes(q);
    });
  }, [personas, searchTerm]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger / Display Box */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderRadius: '8px',
          border: isOpen ? '1px solid #6366f1' : '1px solid #e5e7eb',
          boxShadow: isOpen ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
          background: disabled ? '#f3f4f6' : (isOpen ? '#ffffff' : '#f9fafb'),
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          minHeight: '44px',
          boxSizing: 'border-box',
          transition: 'all 0.2s ease',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
          {selectedPersona ? (
            <>
              <span
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#e0e7ff',
                  color: '#4338ca',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {selectedPersona.name.charAt(0).toUpperCase()}
              </span>
              <span
                style={{
                  color: '#111827',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedPersona.name}
              </span>
              {selectedPersona.area && (
                <span
                  style={{
                    color: '#6b7280',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  ({selectedPersona.area})
                </span>
              )}
            </>
          ) : (
            <span style={{ color: '#9ca3af' }}>{placeholder}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {selectedPersona && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '11px',
                padding: 0,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e5e7eb';
                e.currentTarget.style.color = '#1f2937';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
                e.currentTarget.style.color = '#6b7280';
              }}
              title="Quitar selección"
            >
              ✕
            </button>
          )}
          <i
            className="fa-solid fa-chevron-down"
            style={{
              fontSize: '12px',
              color: '#9ca3af',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Search Input Bar */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#f9fafb',
            }}
          >
            <i className="fa-solid fa-magnifying-glass" style={{ color: '#9ca3af', fontSize: '12px' }} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Escribe para buscar por nombre, cédula o área..."
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                color: '#111827',
                padding: '4px 0',
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '2px 4px',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Options List */}
          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              padding: '4px 0',
            }}
          >
            {/* Clear / Unassigned Option */}
            <div
              onClick={() => handleSelect('')}
              style={{
                padding: '8px 14px',
                fontSize: '13px',
                color: '#6b7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: !value ? '#f3f4f6' : 'transparent',
                borderBottom: '1px solid #f3f4f6',
              }}
              onMouseEnter={(e) => {
                if (value) e.currentTarget.style.background = '#f9fafb';
              }}
              onMouseLeave={(e) => {
                if (value) e.currentTarget.style.background = 'transparent';
              }}
            >
              <i className="fa-solid fa-ban" style={{ fontSize: '11px', color: '#9ca3af' }} />
              <span>{placeholder}</span>
            </div>

            {filteredPersonas.length === 0 ? (
              <div
                style={{
                  padding: '16px 14px',
                  fontSize: '13px',
                  color: '#9ca3af',
                  textAlign: 'center',
                }}
              >
                No se encontraron coincidencias para &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredPersonas.map((p) => {
                const isSelected = p.id === value;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p.id)}
                    style={{
                      padding: '8px 14px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isSelected ? '#eef2ff' : 'transparent',
                      color: isSelected ? '#4338ca' : '#1f2937',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                      <span style={{ fontWeight: isSelected ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </span>
                      {(p.area || p.idNumber) && (
                        <span style={{ fontSize: '11px', color: isSelected ? '#6366f1' : '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.area ? p.area : ''}
                          {p.area && p.idNumber ? ' • ' : ''}
                          {p.idNumber ? `CC: ${p.idNumber}` : ''}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <i className="fa-solid fa-check" style={{ color: '#4338ca', fontSize: '12px', marginLeft: '8px' }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

