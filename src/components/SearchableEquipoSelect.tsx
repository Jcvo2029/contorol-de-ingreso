"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface EquipoOption {
  id: string;
  assetCode: string;
  brandModel: string;
  serialNumber?: string;
  equipmentType?: string;
  [key: string]: any;
}

interface SearchableEquipoSelectProps {
  value: string;
  onChange: (value: string) => void;
  equipos: EquipoOption[];
  placeholder?: string;
  disabled?: boolean;
}

export default function SearchableEquipoSelect({
  value,
  onChange,
  equipos = [],
  placeholder = '-- Seleccionar Equipo --',
  disabled = false,
}: SearchableEquipoSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const selectedEquipo = useMemo(() => {
    return equipos.find((e) => e.id === value);
  }, [equipos, value]);

  const filteredEquipos = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return equipos;
    return equipos.filter((e) => {
      const code = (e.assetCode || '').toLowerCase();
      const brand = (e.brandModel || '').toLowerCase();
      const serial = (e.serialNumber || '').toLowerCase();
      const type = (e.equipmentType || '').toLowerCase();
      return code.includes(q) || brand.includes(q) || serial.includes(q) || type.includes(q);
    });
  }, [equipos, searchTerm]);

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
      {/* Trigger Box */}
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
          background: disabled ? '#f3f4f6' : isOpen ? '#ffffff' : '#f9fafb',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          minHeight: '44px',
          boxSizing: 'border-box',
          transition: 'all 0.2s ease',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
          {selectedEquipo ? (
            <>
              <span
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: '#fef3c7',
                  color: '#b45309',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  flexShrink: 0,
                }}
              >
                <i className="fa-solid fa-laptop"></i>
              </span>
              <span
                style={{
                  color: '#111827',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {selectedEquipo.assetCode}
              </span>
              <span
                style={{
                  color: '#4b5563',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                — {selectedEquipo.brandModel}
              </span>
            </>
          ) : (
            <span style={{ color: '#9ca3af' }}>{placeholder}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {selectedEquipo && !disabled && (
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
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Search Bar */}
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
              placeholder="Buscar por código, serial, marca, modelo o tipo..."
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
          <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '4px 0' }}>
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
            >
              <i className="fa-solid fa-ban" style={{ fontSize: '11px', color: '#9ca3af' }} />
              <span>{placeholder}</span>
            </div>

            {filteredEquipos.length === 0 ? (
              <div style={{ padding: '16px 14px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
                No se encontraron equipos para &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredEquipos.map((eq) => {
                const isSelected = eq.id === value;
                return (
                  <div
                    key={eq.id}
                    onClick={() => handleSelect(eq.id)}
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
                      <span
                        style={{
                          fontWeight: isSelected ? 700 : 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {eq.assetCode} — {eq.brandModel}
                      </span>
                      {(eq.equipmentType || eq.serialNumber) && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: isSelected ? '#6366f1' : '#6b7280',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {eq.equipmentType || ''}
                          {eq.equipmentType && eq.serialNumber ? ' • ' : ''}
                          {eq.serialNumber ? `S/N: ${eq.serialNumber}` : ''}
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

