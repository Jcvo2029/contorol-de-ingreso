"use client";
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import './areas.css';

interface Persona {
  id: string;
  name: string;
  area?: string;
  email?: string;
  phone?: string;
}

interface Asignacion {
  id: string;
  personaId: string;
  equipoId: string;
  equipoAssetCode: string;
  equipoBrandModel: string;
  estado: string;
}

export default function AreasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [search, setSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  useEffect(() => {
    // Escuchar personas
    const qPers = query(collection(db, 'personas'));
    const unsubPers = onSnapshot(qPers, (snapshot) => {
      const data: Persona[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Persona);
      });
      setPersonas(data);
    });

    // Escuchar asignaciones
    const qAsig = query(collection(db, 'asignaciones'));
    const unsubAsig = onSnapshot(qAsig, (snapshot) => {
      const data: Asignacion[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Asignacion);
      });
      setAsignaciones(data);
    });

    return () => {
      unsubPers();
      unsubAsig();
    };
  }, []);

  // Agrupar por área
  const areasMap = new Map<string, { personas: Persona[], equiposAsignados: number }>();

  personas.forEach(p => {
    const areaName = (p.area || 'Sin Asignar').trim();
    if (!areasMap.has(areaName)) {
      areasMap.set(areaName, { personas: [], equiposAsignados: 0 });
    }
    const areaData = areasMap.get(areaName)!;
    areaData.personas.push(p);
  });

  // Calcular equipos asignados a cada área
  asignaciones.forEach(a => {
    if (a.estado === 'Asignado') {
      const persona = personas.find(p => p.id === a.personaId);
      if (persona) {
        const areaName = (persona.area || 'Sin Asignar').trim();
        if (areasMap.has(areaName)) {
          areasMap.get(areaName)!.equiposAsignados++;
        }
      }
    }
  });

  const areasList = Array.from(areasMap.entries()).map(([name, data]) => ({
    name,
    personasCount: data.personas.length,
    equiposCount: data.equiposAsignados,
    personas: data.personas
  }));

  const filteredAreas = areasList.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  // Datos para el Modal
  const modalData = selectedArea ? areasList.find(a => a.name === selectedArea) : null;
  const modalPersonasIds = modalData ? modalData.personas.map(p => p.id) : [];
  const modalAsignaciones = selectedArea ? asignaciones.filter(a => a.estado === 'Asignado' && modalPersonasIds.includes(a.personaId)) : [];

  return (
    <div className="areas-container">
      <div className="areas-header-card">
        <div>
          <h2><i className="fa-solid fa-building"></i> Directorio de Áreas y Departamentos</h2>
          <p style={{ color: '#6b7280', margin: '8px 0 0 0', fontSize: '14px' }}>Visualiza los empleados y equipos distribuidos en cada sucursal o área.</p>
        </div>
      </div>

      <div className="areas-list-card">
        <div className="areas-search-bar">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder="Buscar área o departamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="table-responsive">
          <table className="areas-table">
            <thead>
              <tr>
                <th>Área / Departamento</th>
                <th>Total Empleados</th>
                <th>Equipos Asignados</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAreas.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    No se encontraron áreas.
                  </td>
                </tr>
              ) : (
                filteredAreas.map((area, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{area.name}</strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-users" style={{ color: '#6b7280' }}></i> {area.personasCount}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-laptop" style={{ color: '#6b7280' }}></i> {area.equiposCount}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button className="btn-view-area" onClick={() => setSelectedArea(area.name)}>
                          <i className="fa-solid fa-eye"></i> Ver Detalles
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalles del Área */}
      {selectedArea && modalData && (
        <div className="modal-overlay" onClick={() => setSelectedArea(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="btn-close-modal" onClick={() => setSelectedArea(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            <h3 style={{ marginBottom: '10px', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-building"></i> Área: {modalData.name}
            </h3>
            
            <div className="area-stats">
              <div className="stat-box">
                <h4>Total Empleados</h4>
                <p style={{ color: '#2563eb' }}>{modalData.personasCount}</p>
              </div>
              <div className="stat-box">
                <h4>Equipos Asignados</h4>
                <p style={{ color: '#10b981' }}>{modalData.equiposCount}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
              {/* Columna Empleados */}
              <div style={{ flex: 1 }}>
                <h4 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '8px', marginBottom: '12px', color: '#374151' }}>
                  Empleados ({modalData.personas.length})
                </h4>
                <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                  {modalData.personas.map(p => (
                    <div key={p.id} style={{ padding: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 'bold', color: '#1f2937' }}>{p.name}</div>
                      {(p.email || p.phone) && (
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                          {p.email} {p.email && p.phone && '|'} {p.phone}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Columna Equipos */}
              <div style={{ flex: 1 }}>
                <h4 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '8px', marginBottom: '12px', color: '#374151' }}>
                  Inventario Activo ({modalAsignaciones.length})
                </h4>
                <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                  {modalAsignaciones.map(a => {
                    const p = modalData.personas.find(x => x.id === a.personaId);
                    return (
                      <div key={a.id} style={{ padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{a.equipoAssetCode}</div>
                        <div style={{ fontSize: '12px', color: '#3b82f6', marginBottom: '4px' }}>{a.equipoBrandModel}</div>
                        <div style={{ fontSize: '12px', color: '#4b5563', background: 'white', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                          <i className="fa-solid fa-user" style={{ marginRight: '5px' }}></i>
                          {p?.name}
                        </div>
                      </div>
                    );
                  })}
                  {modalAsignaciones.length === 0 && (
                    <div style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
                      No hay equipos asignados en esta área.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
