"use client";
import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import './asignaciones.css';

interface Persona {
  id: string;
  name: string;
  idNumber: string;
}

interface Equipo {
  id: string;
  assetCode: string;
  brandModel: string;
}

interface Asignacion {
  id: string;
  personaId: string;
  personaName: string;
  equipoId: string;
  equipoAssetCode: string;
  equipoBrandModel: string;
  fechaAsignacion: any;
  fechaDevolucion: any;
  estado: 'Asignado' | 'Devuelto';
  observaciones?: string;
}

export default function AsignacionesPage() {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [userRole, setUserRole] = useState<string>('');

  // Form state
  const [selectedPersona, setSelectedPersona] = useState('');
  const [selectedEquipo, setSelectedEquipo] = useState('');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserRole(parsed.role || 'Empleado');
      } catch (err) {
        console.error("Error parsing user from localStorage:", err);
      }
    }
  }, []);

  useEffect(() => {
    // Escuchar asignaciones
    const qAsig = query(collection(db, 'asignaciones'), orderBy('fechaAsignacion', 'desc'));
    const unsubAsig = onSnapshot(qAsig, (snapshot) => {
      const data: Asignacion[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Asignacion);
      });
      setAsignaciones(data);
    });

    // Escuchar personas para el select
    const qPers = query(collection(db, 'personas'), orderBy('name', 'asc'));
    const unsubPers = onSnapshot(qPers, (snapshot) => {
      const data: Persona[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, name: doc.data().name, idNumber: doc.data().idNumber });
      });
      setPersonas(data);
    });

    // Escuchar equipos para el select
    const qEqui = query(collection(db, 'equipos'), orderBy('assetCode', 'asc'));
    const unsubEqui = onSnapshot(qEqui, (snapshot) => {
      const data: Equipo[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, assetCode: doc.data().assetCode, brandModel: doc.data().brandModel });
      });
      setEquipos(data);
    });

    return () => {
      unsubAsig();
      unsubPers();
      unsubEqui();
    };
  }, []);

  const handleSave = async () => {
    if (!selectedPersona || !selectedEquipo) {
      alert('Por favor selecciona una persona y un equipo.');
      return;
    }

    // Comprobar si el equipo ya está asignado y no devuelto
    const isAlreadyAssigned = asignaciones.some(a => a.equipoId === selectedEquipo && a.estado === 'Asignado');
    if (isAlreadyAssigned) {
      alert('Este equipo ya se encuentra asignado a otra persona.');
      return;
    }

    const p = personas.find(x => x.id === selectedPersona);
    const e = equipos.find(x => x.id === selectedEquipo);

    if (!p || !e) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'asignaciones'), {
        personaId: p.id,
        personaName: p.name,
        equipoId: e.id,
        equipoAssetCode: e.assetCode,
        equipoBrandModel: e.brandModel,
        fechaAsignacion: serverTimestamp(),
        fechaDevolucion: null,
        estado: 'Asignado',
        observaciones: observaciones.trim()
      });
      
      resetForm();
      setShowForm(false);
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDevolver = async (id: string, equipo: string) => {
    if (!confirm(`¿Confirmar la devolución del equipo ${equipo}?`)) return;
    try {
      await updateDoc(doc(db, 'asignaciones', id), {
        estado: 'Devuelto',
        fechaDevolucion: serverTimestamp()
      });
    } catch (error: any) {
      alert('Error al devolver: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`¿Estás seguro de eliminar este registro de asignación por completo? Esto borrará el registro del historial.`)) return;
    try {
      await deleteDoc(doc(db, 'asignaciones', id));
    } catch (error: any) {
      alert('Error al eliminar: ' + error.message);
    }
  };

  const resetForm = () => {
    setSelectedPersona('');
    setSelectedEquipo('');
    setObservaciones('');
  };

  const filtered = asignaciones.filter(a => {
    const p = personas.find(x => x.id === a.personaId);
    const liveName = p ? p.name : a.personaName;
    
    const e = equipos.find(x => x.id === a.equipoId);
    const liveAssetCode = e ? e.assetCode : a.equipoAssetCode;
    const liveBrandModel = e ? e.brandModel : a.equipoBrandModel;

    return (liveName || '').toLowerCase().includes(search.toLowerCase()) ||
           (liveAssetCode || '').toLowerCase().includes(search.toLowerCase()) ||
           (liveBrandModel || '').toLowerCase().includes(search.toLowerCase());
  });

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '---';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  if (userRole !== 'Admin' && userRole !== 'Recepción') {
    return (
      <div className="asignaciones-container">
        <div className="asignaciones-header-card">
          <h2>Acceso Denegado</h2>
          <p>No tienes permisos para ver esta sección.</p>
        </div>
      </div>
    );
  }

  // Equipos disponibles (los que no están "Asignados" actualmente)
  const equiposDisponibles = equipos.filter(e => 
    !asignaciones.some(a => a.equipoId === e.id && a.estado === 'Asignado')
  );

  return (
    <div className="asignaciones-container">
      <div className="asignaciones-header-card">
        <div>
          <h2><i className="fa-solid fa-people-carry-box"></i> Asignación de Equipos</h2>
          <p>Controla a quién se le ha entregado cada equipo y gestiona las devoluciones.</p>
        </div>
        <button className="btn-add-asignacion" onClick={() => setShowForm(!showForm)}>
          <i className={`fa-solid ${showForm ? 'fa-xmark' : 'fa-plus'}`}></i>
          {showForm ? 'Cancelar' : 'Nueva Asignación'}
        </button>
      </div>

      {showForm && (
        <div className="asignacion-form-card">
          <h3>Registrar Nueva Asignación</h3>
          
          <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div className="form-group" style={{ flex: '1' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>Persona *</label>
              <select value={selectedPersona} onChange={(e) => setSelectedPersona(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', outline: 'none' }}>
                <option value="">-- Seleccionar Persona --</option>
                {personas.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (ID: {p.idNumber})</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: '1' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>Equipo Disponible *</label>
              <select value={selectedEquipo} onChange={(e) => setSelectedEquipo(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', outline: 'none' }}>
                <option value="">-- Seleccionar Equipo --</option>
                {equiposDisponibles.map(e => (
                  <option key={e.id} value={e.id}>{e.assetCode} - {e.brandModel}</option>
                ))}
              </select>
              {equiposDisponibles.length === 0 && (
                <small style={{color: '#b91c1c', display: 'block', marginTop: '4px'}}>No hay equipos disponibles en este momento.</small>
              )}
            </div>
          </div>

          <div className="form-row" style={{ marginBottom: '24px' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>Observaciones (Opcional)</label>
              <textarea placeholder="Ej: Se entrega con cargador y mouse, presenta rayón leve." value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}></textarea>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={() => { resetForm(); setShowForm(false); }}
              style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#374151' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={loading || equiposDisponibles.length === 0}
              style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
              {loading ? 'Guardando...' : 'Asignar Equipo'}
            </button>
          </div>
        </div>
      )}

      <div className="asignaciones-list-card">
        <div className="asignaciones-search-bar">
          <i className="fa-solid fa-search"></i>
          <input type="text" placeholder="Buscar por persona, modelo o código de equipo..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="asignaciones-table-container">
          <table className="asignaciones-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Equipo</th>
                <th>Fecha Asignación</th>
                <th>Fecha Devolución</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map(asig => {
                  const linkedPersona = personas.find(p => p.id === asig.personaId);
                  const displayName = linkedPersona ? linkedPersona.name : asig.personaName;

                  const linkedEquipo = equipos.find(e => e.id === asig.equipoId);
                  const displayAssetCode = linkedEquipo ? linkedEquipo.assetCode : asig.equipoAssetCode;
                  const displayBrandModel = linkedEquipo ? linkedEquipo.brandModel : asig.equipoBrandModel;

                  return (
                    <tr key={asig.id}>
                      <td><strong>{displayName}</strong></td>
                      <td>{displayAssetCode} <br/><small style={{color: '#6b7280'}}>{displayBrandModel}</small></td>
                      <td>{formatDate(asig.fechaAsignacion)}</td>
                      <td>{asig.estado === 'Devuelto' ? formatDate(asig.fechaDevolucion) : '---'}</td>
                      <td>
                        <span className={`badge-estado estado-${asig.estado.toLowerCase()}`}>
                          {asig.estado}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns" style={{ justifyContent: 'center' }}>
                          <a href={`/dashboard/asignaciones/acta/${asig.id}`} target="_blank" rel="noopener noreferrer" className="btn-devolver" style={{ textDecoration: 'none', background: '#f3f4f6' }} title="Imprimir Acta de Compromiso">
                            <i className="fa-solid fa-file-contract"></i> Acta
                          </a>
                          {asig.estado === 'Asignado' ? (
                            <button className="btn-devolver" onClick={() => handleDevolver(asig.id, displayAssetCode)}>
                              <i className="fa-solid fa-arrow-rotate-left"></i> Devolver
                            </button>
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}><i className="fa-solid fa-check"></i> Finalizado</span>
                          )}
                          {userRole === 'Admin' && (
                            <button className="btn-devolver" onClick={() => handleDelete(asig.id)} style={{ color: '#dc2626', background: '#fee2e2' }} title="Eliminar Registro (Solo Administradores)">
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>
                    No se encontraron asignaciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
