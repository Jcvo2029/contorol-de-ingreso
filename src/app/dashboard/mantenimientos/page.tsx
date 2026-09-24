"use client";
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import './mantenimientos.css';

interface Equipment {
  id: string;
  assetCode: string;
  brandModel: string;
  equipmentType: string;
}

interface Maintenance {
  id: string;
  equipoId: string;
  equipoName: string;
  fecha: string; // YYYY-MM-DD
  estado: 'Programado' | 'Realizado' | 'Cancelado';
  tecnico: string;
  observaciones: string;
}

interface Asignacion {
  equipoId: string;
  personaName: string;
  estado: string;
}

export default function MantenimientosPage() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [selectedDate, setSelectedDate] = useState('');
  const [equipoId, setEquipoId] = useState('');
  const [estado, setEstado] = useState<'Programado' | 'Realizado' | 'Cancelado'>('Programado');
  const [tecnico, setTecnico] = useState('');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    // Fetch PC/Laptops
    const qEq = query(collection(db, 'equipos'), orderBy('assetCode', 'asc'));
    const unsubEq = onSnapshot(qEq, (snapshot) => {
      const eqData: Equipment[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const type = (data.equipmentType || '').toLowerCase();
        const isComputer = type.includes('portátil') || type.includes('portatil') || 
                           type.includes('escritorio') || type.includes('pc') || 
                           type.includes('computador') || type.includes('servidor') || type.includes('all in one');
        
        if (isComputer) {
          eqData.push({
            id: doc.id,
            assetCode: data.assetCode,
            brandModel: data.brandModel,
            equipmentType: data.equipmentType
          });
        }
      });
      setEquipments(eqData);
    });

    // Fetch maintenances
    const qMant = query(collection(db, 'mantenimientos'));
    const unsubMant = onSnapshot(qMant, (snapshot) => {
      const mData: Maintenance[] = [];
      snapshot.forEach(doc => {
        mData.push({ id: doc.id, ...doc.data() } as Maintenance);
      });
      setMaintenances(mData);
    });

    // Fetch Asignaciones for priority sorting
    const qAsig = query(collection(db, 'asignaciones'));
    const unsubAsig = onSnapshot(qAsig, (snapshot) => {
      const aData: Asignacion[] = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.estado === 'Asignado') {
          aData.push({ equipoId: d.equipoId, personaName: d.personaName, estado: d.estado });
        }
      });
      setAsignaciones(aData);
    });

    return () => {
      unsubEq();
      unsubMant();
      unsubAsig();
    };
  }, []);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay(); // 0 is Sunday
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleDayClick = (day: number) => {
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    const dateStr = `${currentDate.getFullYear()}-${month}-${d}`;
    
    resetForm();
    setSelectedDate(dateStr);
    setShowModal(true);
  };

  const handleEditMaintenance = (e: React.MouseEvent, m: Maintenance) => {
    e.stopPropagation();
    setEditingId(m.id);
    setEquipoId(m.equipoId);
    setSelectedDate(m.fecha);
    setEstado(m.estado);
    setTecnico(m.tecnico || '');
    setObservaciones(m.observaciones || '');
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setEquipoId('');
    setSelectedDate('');
    setEstado('Programado');
    setTecnico('');
    setObservaciones('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipoId || !selectedDate) return;

    const eq = equipments.find(e => e.id === equipoId);
    if (!eq) return;

    const payload = {
      equipoId,
      equipoName: `${eq.assetCode} - ${eq.brandModel}`,
      fecha: selectedDate,
      estado,
      tecnico,
      observaciones,
      updatedAt: serverTimestamp()
    };

    if (editingId) {
      await updateDoc(doc(db, 'mantenimientos', editingId), payload);
    } else {
      await addDoc(collection(db, 'mantenimientos'), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    setShowModal(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (editingId && window.confirm('¿Seguro que deseas eliminar este mantenimiento?')) {
      await deleteDoc(doc(db, 'mantenimientos', editingId));
      setShowModal(false);
      resetForm();
    }
  };

  const handleAutoGenerate = async () => {
    if (!window.confirm('¿Deseas generar el cronograma automáticamente? (2 equipos diarios, omitiendo fines de semana, programado para todo el año)')) return;

    // Prioritize Milais Yee and Yeison Muñoz
    const priorityNames = ['milais yee', 'yeison muñoz', 'yeison munoz'];
    
    let sortedEquipments = [...equipments].sort((a, b) => {
      const asigA = asignaciones.find(as => as.equipoId === a.id);
      const asigB = asignaciones.find(as => as.equipoId === b.id);
      
      const aIsPriority = asigA && priorityNames.some(p => asigA.personaName.toLowerCase().includes(p));
      const bIsPriority = asigB && priorityNames.some(p => asigB.personaName.toLowerCase().includes(p));
      
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      return 0;
    });

    let currentScheduleDate = new Date();
    currentScheduleDate.setDate(currentScheduleDate.getDate() + 1); // Start tomorrow
    
    // Skip weekend for start date
    if (currentScheduleDate.getDay() === 6) currentScheduleDate.setDate(currentScheduleDate.getDate() + 2); // Sat -> Mon
    if (currentScheduleDate.getDay() === 0) currentScheduleDate.setDate(currentScheduleDate.getDate() + 1); // Sun -> Mon

    let scheduledTodayCount = 0;

    for (const eq of sortedEquipments) {
      // Create 3 schedules for the year (every 4 months)
      for (let cycle = 0; cycle < 3; cycle++) {
        const cycleDate = new Date(currentScheduleDate);
        cycleDate.setMonth(cycleDate.getMonth() + (cycle * 4));
        
        // Adjust if the future date lands on weekend
        if (cycleDate.getDay() === 6) cycleDate.setDate(cycleDate.getDate() + 2);
        if (cycleDate.getDay() === 0) cycleDate.setDate(cycleDate.getDate() + 1);

        const m = (cycleDate.getMonth() + 1).toString().padStart(2, '0');
        const d = cycleDate.getDate().toString().padStart(2, '0');
        const dateStr = `${cycleDate.getFullYear()}-${m}-${d}`;

        await addDoc(collection(db, 'mantenimientos'), {
          equipoId: eq.id,
          equipoName: `${eq.assetCode} - ${eq.brandModel}`,
          fecha: dateStr,
          estado: 'Programado',
          tecnico: 'Automático',
          observaciones: 'Mantenimiento preventivo generado automáticamente.',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      scheduledTodayCount++;
      if (scheduledTodayCount >= 2) {
        scheduledTodayCount = 0;
        currentScheduleDate.setDate(currentScheduleDate.getDate() + 1);
        if (currentScheduleDate.getDay() === 6) currentScheduleDate.setDate(currentScheduleDate.getDate() + 2);
        if (currentScheduleDate.getDay() === 0) currentScheduleDate.setDate(currentScheduleDate.getDate() + 1);
      }
    }
    
    alert('Cronograma generado con éxito.');
  };

  const handleDeleteAutoGenerated = async () => {
    if (!window.confirm('¿Seguro que deseas ELIMINAR TODOS los mantenimientos auto-generados? Esto no se puede deshacer.')) return;
    
    let deletedCount = 0;
    for (const m of maintenances) {
      if (m.tecnico === 'Automático') {
        await deleteDoc(doc(db, 'mantenimientos', m.id));
        deletedCount++;
      }
    }
    alert(`Se eliminaron ${deletedCount} mantenimientos auto-generados.`);
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return (
      <div className="calendar-wrapper">
        <div className="header-container">
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>
            <i className="fa-solid fa-screwdriver-wrench" style={{ color: '#eb0072', marginRight: '8px' }}></i> 
            Cronograma de Mantenimientos
          </h1>
          <div className="calendar-header">
            <button onClick={prevMonth}><i className="fa-solid fa-chevron-left"></i></button>
            <h2>{monthNames[month]} {year}</h2>
            <button onClick={nextMonth}><i className="fa-solid fa-chevron-right"></i></button>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-qr" onClick={handleAutoGenerate}>
              <i className="fa-solid fa-robot"></i> Auto-Generar
            </button>
            <button className="btn-qr" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={handleDeleteAutoGenerated}>
              <i className="fa-solid fa-trash-can"></i> Borrar Auto
            </button>
            <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
              <i className="fa-solid fa-plus"></i> Agendar
            </button>
          </div>
        </div>

        <div className="calendar-grid">
          {dayNames.map(name => (
            <div key={name} className="calendar-day-header">{name}</div>
          ))}
          
          {blanks.map((_, i) => (
            <div key={`blank-${i}`} className="calendar-day empty-day"></div>
          ))}

          {days.map(day => {
            const isToday = isCurrentMonth && today.getDate() === day;
            const m = (month + 1).toString().padStart(2, '0');
            const d = day.toString().padStart(2, '0');
            const dateStr = `${year}-${m}-${d}`;
            
            const dayMaintenances = maintenances.filter(m => m.fecha === dateStr);

            return (
              <div 
                key={day} 
                className={`calendar-day ${isToday ? 'today' : ''}`}
                onClick={() => handleDayClick(day)}
              >
                <span className="day-number">{day}</span>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {dayMaintenances.map(mant => {
                    const asig = asignaciones.find(a => a.equipoId === mant.equipoId);
                    const personaName = asig ? asig.personaName : 'Sin asignar';
                    const label = `${mant.equipoName.split(' - ')[0]} (${personaName})`;

                    return (
                      <div 
                        key={mant.id} 
                        className={`maintenance-item status-${mant.estado}`}
                        onClick={(e) => handleEditMaintenance(e, mant)}
                        title={`${mant.equipoName} - ${personaName} - ${mant.estado}`}
                      >
                        <strong>{label}</strong>
                        {mant.estado === 'Realizado' && <i className="fa-solid fa-check" style={{ marginLeft: '4px' }}></i>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="mantenimientos-container">
      {renderCalendar()}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1f2937' }}>
              <i className="fa-solid fa-calendar-plus" style={{ marginRight: '8px' }}></i>
              {editingId ? 'Editar Mantenimiento' : 'Agendar Mantenimiento'}
            </h3>
            
            <form onSubmit={handleSave}>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Fecha del Mantenimiento</label>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={e => setSelectedDate(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Equipo (Solo PC/Portátil)</label>
                <select 
                  value={equipoId} 
                  onChange={e => setEquipoId(e.target.value)} 
                  required
                >
                  <option value="">Seleccione un equipo...</option>
                  {equipments.map(eq => (
                    <option key={eq.id} value={eq.id}>
                      {eq.assetCode} - {eq.brandModel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Técnico a cargo</label>
                <input 
                  type="text" 
                  value={tecnico} 
                  onChange={e => setTecnico(e.target.value)} 
                  placeholder="Nombre del técnico" 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Estado</label>
                <select value={estado} onChange={e => setEstado(e.target.value as any)}>
                  <option value="Programado">Programado</option>
                  <option value="Realizado">Realizado</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Observaciones</label>
                <textarea 
                  value={observaciones} 
                  onChange={e => setObservaciones(e.target.value)} 
                  placeholder="Detalles del mantenimiento..." 
                  rows={3} 
                  style={{ fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                {editingId ? (
                  <button type="button" onClick={handleDelete} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                    <i className="fa-solid fa-trash"></i> Eliminar
                  </button>
                ) : <div></div>}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn-qr" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary">Guardar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
