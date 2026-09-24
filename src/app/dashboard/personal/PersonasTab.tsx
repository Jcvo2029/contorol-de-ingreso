"use client";
import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import './personas.css';

interface Persona {
  id: string;
  idNumber: string;
  name: string;
  area: string;
  visitorType: 'Empleado' | 'Proveedor/Cliente';
  company?: string;
  phone?: string;
  email?: string;
  office365Email?: string;
  office365License?: string;
  office365Key?: string;
  domainUser?: string;
  siesaUser?: string;
  status?: 'Activo' | 'Inactivo';
  fechaRetiro?: any;
  createdAt: any;
}

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeMasterId, setMergeMasterId] = useState('');

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState<Persona | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form state
  const [idNumber, setIdNumber] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [visitorType, setVisitorType] = useState<'Empleado' | 'Proveedor/Cliente'>('Empleado');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [office365Email, setOffice365Email] = useState('');
  const [office365License, setOffice365License] = useState('');
  const [office365Key, setOffice365Key] = useState('');
  const [domainUser, setDomainUser] = useState('');
  const [siesaUser, setSiesaUser] = useState('');

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
    const q = query(collection(db, 'personas'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data: Persona[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Persona);
      });
      setPersonas(data);
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!idNumber.trim() || !name.trim()) {
      alert('El número de identificación y el nombre son obligatorios.');
      return;
    }

    setLoading(true);
    try {
      if (editingPersona) {
        // Update existing persona
        await updateDoc(doc(db, 'personas', editingPersona.id), {
          idNumber: idNumber.trim(),
          name: name.trim(),
          area: area.trim(),
          visitorType,
          company: company.trim(),
          phone: phone.trim(),
          email: email.trim(),
          office365Email: office365Email.trim(),
          office365License: office365License.trim(),
          office365Key: office365Key.trim(),
          domainUser: domainUser.trim(),
          siesaUser: siesaUser.trim(),
        });
        setEditingPersona(null);
      } else {
        // Check for duplicate ID (only for new registrations)
        const exists = personas.find(p => p.idNumber === idNumber.trim());
        if (exists) {
          alert(`Ya existe una persona registrada con el ID: ${idNumber}`);
          setLoading(false);
          return;
        }

        await addDoc(collection(db, 'personas'), {
          idNumber: idNumber.trim(),
          name: name.trim(),
          area: area.trim(),
          visitorType,
          company: company.trim(),
          phone: phone.trim(),
          email: email.trim(),
          office365Email: office365Email.trim(),
          office365License: office365License.trim(),
          office365Key: office365Key.trim(),
          domainUser: domainUser.trim(),
          siesaUser: siesaUser.trim(),
          createdAt: serverTimestamp(),
        });
      }
      resetForm();
      setShowForm(false);
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Seguro que deseas eliminar a "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'personas', id));
    } catch (error: any) {
      alert('Error al eliminar: ' + error.message);
    }
  };

  const handleRetire = async (persona: Persona) => {
    if (!confirm(`¿Seguro que deseas retirar a "${persona.name}"? Esto cambiará su estado a Inactivo y liberará todas sus herramientas asignadas automáticamente.`)) return;
    
    setLoading(true);
    try {
      // 1. Marcar como inactivo y agregar etiqueta al correo
      const updatedEmail = persona.email && !persona.email.includes('[Inactivo]') 
        ? `${persona.email} [Inactivo]` 
        : persona.email;

      await updateDoc(doc(db, 'personas', persona.id), {
        status: 'Inactivo',
        email: updatedEmail || '',
        fechaRetiro: serverTimestamp()
      });

      // 2. Liberar todas las asignaciones activas
      const qAsig = query(
        collection(db, 'asignaciones'), 
        where('personaId', '==', persona.id),
        where('estado', '==', 'Asignado')
      );
      
      const snapshot = await getDocs(qAsig);
      
      // Update each active assignment to returned
      const updatePromises = snapshot.docs.map(assignmentDoc => 
        updateDoc(doc(db, 'asignaciones', assignmentDoc.id), {
          estado: 'Devuelto',
          fechaDevolucion: serverTimestamp()
        })
      );
      
      await Promise.all(updatePromises);
      
      alert(`"${persona.name}" ha sido retirado exitosamente. Se liberaron ${snapshot.docs.length} equipos.`);
    } catch (error: any) {
      console.error(error);
      alert('Error al retirar persona: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditPersona = (persona: Persona) => {
    setEditingPersona(persona);
    setIdNumber(persona.idNumber || '');
    setName(persona.name || '');
    setArea(persona.area || '');
    setVisitorType(persona.visitorType || 'Empleado');
    setCompany(persona.company || '');
    setPhone(persona.phone || '');
    setEmail(persona.email || '');
    setOffice365Email(persona.office365Email || '');
    setOffice365License(persona.office365License || '');
    setOffice365Key(persona.office365Key || '');
    setDomainUser(persona.domainUser || '');
    setSiesaUser(persona.siesaUser || '');
    setShowForm(true);
  };

  const resetForm = () => {
    setIdNumber(''); setName(''); setArea('');
    setVisitorType('Empleado'); setCompany('');
    setPhone(''); setEmail(''); setOffice365Email(''); setOffice365License(''); setOffice365Key('');
    setDomainUser(''); setSiesaUser('');
    setEditingPersona(null);
  };

  const filtered = personas.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.idNumber.includes(search) ||
    (p.area || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleShowHistory = async (persona: Persona) => {
    setShowHistoryModal(persona);
    setLoadingHistory(true);
    setHistoryData([]);
    try {
      const qAsig = query(collection(db, 'asignaciones'), where('personaId', '==', persona.id));
      const asigSnapshot = await getDocs(qAsig);
      const data = asigSnapshot.docs.map(d => ({ id: d.id, ...d.data() }) as any);
      // Sort by fechaAsignacion descending
      data.sort((a, b) => {
        const timeA = a.fechaAsignacion?.toMillis ? a.fechaAsignacion.toMillis() : 0;
        const timeB = b.fechaAsignacion?.toMillis ? b.fechaAsignacion.toMillis() : 0;
        return timeB - timeA;
      });
      setHistoryData(data);
    } catch (error) {
      console.error(error);
      alert("Error al cargar el historial.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleSelectPersona = (id: string) => {
    setSelectedPersonas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleMerge = async () => {
    if (!mergeMasterId || selectedPersonas.length < 2) return;
    setLoading(true);
    try {
      const master = personas.find(p => p.id === mergeMasterId);
      if (!master) throw new Error("Perfil principal no encontrado");

      const duplicates = personas.filter(p => selectedPersonas.includes(p.id) && p.id !== mergeMasterId);

      // Collect emails & phones
      const allEmails = new Set<string>();
      if (master.email) master.email.split(',').map(e => e.trim()).forEach(e => allEmails.add(e));
      duplicates.forEach(d => {
        if (d.email) d.email.split(',').map(e => e.trim()).forEach(e => allEmails.add(e));
      });
      
      const allPhones = new Set<string>();
      if (master.phone) master.phone.split(',').map(e => e.trim()).forEach(e => allPhones.add(e));
      duplicates.forEach(d => {
        if (d.phone) d.phone.split(',').map(e => e.trim()).forEach(e => allPhones.add(e));
      });

      await updateDoc(doc(db, 'personas', master.id), {
        email: Array.from(allEmails).filter(e => e).join(', '),
        phone: Array.from(allPhones).filter(e => e).join(', ')
      });

      for (const d of duplicates) {
        const qAsig = query(collection(db, 'asignaciones'), where('personaId', '==', d.id));
        const asigSnapshot = await getDocs(qAsig);
        for (const asigDoc of asigSnapshot.docs) {
          await updateDoc(doc(db, 'asignaciones', asigDoc.id), {
            personaId: master.id,
            personaName: master.name
          });
        }
        await deleteDoc(doc(db, 'personas', d.id));
      }

      setShowMergeModal(false);
      setSelectedPersonas([]);
      setMergeMasterId('');
      alert("Unificación completada exitosamente.");
    } catch (err: any) {
      alert("Error al unificar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="personas-container">
      <div className="personas-header-card">
        <h2><i className="fa-solid fa-address-book"></i> Directorio de Personas</h2>
        <button className="btn-add-persona" onClick={() => setShowForm(!showForm)}>
          <i className={`fa-solid ${showForm ? 'fa-xmark' : 'fa-plus'}`}></i>
          {showForm ? 'Cancelar' : 'Nueva Persona'}
        </button>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { resetForm(); setShowForm(false); }}>
          <div className="persona-form-card" style={{ width: '90%', maxWidth: '800px', margin: 0, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>{editingPersona ? 'Editar Persona' : 'Registrar Persona'}</h3>
              <button onClick={() => { resetForm(); setShowForm(false); }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9ca3af' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: '0.8' }}>
                <label>Tipo *</label>
                <select value={visitorType} onChange={(e) => setVisitorType(e.target.value as any)}
                  style={{ padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit', width: '100%' }}>
                  <option value="Empleado">Empleado</option>
                  <option value="Proveedor/Cliente">Proveedor / Cliente</option>
                </select>
              </div>
              <div className="form-group">
                <label>N° Identificación (CC/ID) *</label>
                <input type="text" placeholder="Ej: 123456789" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: '2' }}>
                <label>Nombre Completo *</label>
                <input type="text" placeholder="Ej: Juan Carlos Pérez" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{visitorType === 'Empleado' ? 'Área / Departamento' : 'Empresa / Organización'}</label>
                <input 
                  type="text" 
                  list="areas-list"
                  placeholder={visitorType === 'Empleado' ? "Ej: Tecnología" : "Ej: Microsoft"} 
                  value={area} 
                  onChange={(e) => setArea(e.target.value)} 
                />
                <datalist id="areas-list">
                  {Array.from(new Set(personas.map(p => p.area).filter(a => a))).sort().map(a => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </div>
              {visitorType === 'Proveedor/Cliente' && (
                <div className="form-group">
                  <label>Empresa</label>
                  <input type="text" placeholder="Ej: Cisco Systems" value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
              )}
              <div className="form-group">
                <label>Teléfono</label>
                <input type="text" placeholder="Ej: +57 300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Correo Corporativo (Principal)</label>
                    <input type="email" placeholder="ejemplo@contexsas.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Correo Office 365 (onmicrosoft)</label>
                    <input type="email" placeholder="ejemplo@contexsas1.onmicrosoft.com" value={office365Email} onChange={(e) => setOffice365Email(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Licencia Office 365</label>
                    <select value={office365License} onChange={(e) => setOffice365License(e.target.value)}>
                      <option value="">Ninguna / No aplica</option>
                      <option value="OFFICE 365 BASIC">Office 365 Basic</option>
                      <option value="OFFICE 365 STANDARD">Office 365 Standard</option>
                      <option value="OFFICE 365 PREMIUM">Office 365 Premium</option>
                      <option value="BASIC 2007">Basic 2007</option>
                      <option value="OFFICE 365 BASIC + BASIC 2007">Office 365 Basic + Basic 2007</option>
                      <option value="OFFICE 2021">Office 2021</option>
                      <option value="OTRA">Otra (Especificar)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Llave de Activación (Opcional)</label>
                    <input type="text" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" value={office365Key} onChange={(e) => setOffice365Key(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Usuario de Dominio</label>
                    <input type="text" placeholder="Ej: admin.usuario" value={domainUser} onChange={(e) => setDomainUser(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Usuario SIESA</label>
                    <input type="text" placeholder="Ej: USUARIO_SIESA" value={siesaUser} onChange={(e) => setSiesaUser(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '20px' }}>
              <button onClick={() => { resetForm(); setShowForm(false); }}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#374151' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={loading}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'var(--bg-dark)', fontWeight: '600', cursor: 'pointer' }}>
                <i className="fa-solid fa-floppy-disk"></i> {editingPersona ? 'Actualizar Persona' : 'Guardar Persona'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="personas-list-card">
        <div className="personas-search-bar" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '15px', top: '12px', color: '#9ca3af' }}></i>
            <input
              type="text"
              placeholder="Buscar por nombre, cédula o área..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '8px', border: '1px solid #d1d5db' }}
            />
          </div>
          {selectedPersonas.length >= 2 && (
            <button 
              onClick={() => { setMergeMasterId(selectedPersonas[0]); setShowMergeModal(true); }}
              style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}
            >
              <i className="fa-solid fa-object-group"></i> Unificar ({selectedPersonas.length})
            </button>
          )}
        </div>

        <div className="table-responsive">
          <table className="personas-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    onChange={(e) => setSelectedPersonas(e.target.checked ? filtered.map(p => p.id) : [])}
                    checked={filtered.length > 0 && selectedPersonas.length === filtered.length}
                  />
                </th>
                <th>ID</th>
                <th>Nombre</th>
                <th>Área / Empresa</th>
                <th>Contacto</th>
                <th>Licencias</th>
                <th>Sistemas / Red</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    {search ? 'No se encontraron coincidencias.' : 'No hay personas registradas aún. Haz clic en "Nueva Persona" para agregar.'}
                  </td>
                </tr>
              ) : (
                filtered.map((persona) => (
                  <tr key={persona.id} style={{ background: selectedPersonas.includes(persona.id) ? '#eff6ff' : 'transparent' }}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={selectedPersonas.includes(persona.id)} onChange={() => toggleSelectPersona(persona.id)} />
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '3px 8px', borderRadius: '6px', fontSize: '13px' }}>
                        {persona.idNumber?.replace(/^S\/N\s*/i, '') || 'N/A'}
                      </span>
                    </td>
                    <td><strong>{persona.name}</strong></td>
                    <td>{persona.area || persona.company || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {persona.phone && <div style={{ fontSize: '13px', color: '#4b5563' }}><i className="fa-solid fa-phone" style={{ width: '16px' }}></i> {persona.phone}</div>}
                        {persona.email && <div style={{ fontSize: '13px', color: '#4b5563' }}><i className="fa-solid fa-envelope" style={{ width: '16px' }}></i> {persona.email}</div>}

                        {!persona.phone && !persona.email && (
                          <span style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>Sin contacto</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        {(persona.office365License || persona.office365Email || persona.office365Key) ? (
                          <>
                            {persona.office365License && (
                               <span style={{ fontSize: '12px', color: '#0369a1', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                 <i className="fa-brands fa-microsoft" style={{ marginRight: '4px' }}></i>{persona.office365License.toLowerCase()}
                               </span>
                            )}

                            {persona.office365Email && (
                               <span title={persona.office365Email} style={{ fontSize: '12px', color: '#0284c7', fontFamily: 'monospace', background: '#f0f9ff', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap', cursor: 'help' }}>
                                 <i className="fa-solid fa-at" style={{ marginRight: '4px' }}></i>{persona.office365Email.split('@')[0]}
                               </span>
                            )}
                            
                            {persona.office365Key && (
                              <button 
                                onClick={() => navigator.clipboard.writeText(persona.office365Key!)}
                                title="Copiar Key"
                                style={{ background: 'transparent', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: '12px', padding: '0', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <i className="fa-solid fa-key"></i> <span style={{ textDecoration: 'underline' }}>•••••-•••••-{persona.office365Key.slice(-5)}</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <span style={{ color: '#d1d5db', fontSize: '12px', fontStyle: 'italic' }}>Sin licencias</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        {(persona.domainUser || persona.siesaUser) ? (
                          <>
                            {persona.domainUser && (
                               <span style={{ fontSize: '12px', color: '#374151', fontFamily: 'monospace', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                 <i className="fa-solid fa-network-wired" style={{ marginRight: '4px', color: '#16a34a' }}></i>{persona.domainUser.toLowerCase()}
                               </span>
                            )}

                            {persona.siesaUser && (
                               <span style={{ fontSize: '12px', color: '#374151', fontFamily: 'monospace', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                 <i className="fa-solid fa-database" style={{ marginRight: '4px', color: '#ea580c' }}></i>{persona.siesaUser.toLowerCase()}
                               </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: '#d1d5db', fontSize: '12px', fontStyle: 'italic' }}>Sin sistemas</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '12px', padding: '4px 8px', borderRadius: '4px', fontWeight: '600',
                        backgroundColor: persona.status === 'Inactivo' ? '#fee2e2' : '#d1fae5',
                        color: persona.status === 'Inactivo' ? '#991b1b' : '#065f46'
                      }}>
                        {persona.status || 'Activo'}
                      </span>
                      {persona.status === 'Inactivo' && persona.fechaRetiro && (
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                          Devuelto: {persona.fechaRetiro?.toDate ? persona.fechaRetiro.toDate().toLocaleDateString() : ''}
                        </div>
                      )}
                    </td>
                    <td className="actions-cell">
                      <button className="btn-qr" onClick={() => handleShowHistory(persona)} title="Ver Historial" style={{ background: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db', marginRight: '6px' }}>
                        <i className="fa-solid fa-clock-rotate-left"></i>
                      </button>
                      {userRole === 'Admin' && (
                        <>
                          <button className="btn-edit" onClick={() => startEditPersona(persona)} title="Editar persona">
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          {(!persona.status || persona.status === 'Activo') && (
                            <button className="btn-qr" onClick={() => handleRetire(persona)} title="Retirar Empleado" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d', marginLeft: '6px' }}>
                              <i className="fa-solid fa-user-slash"></i>
                            </button>
                          )}
                          <button className="btn-delete" onClick={() => handleDelete(persona.id, persona.name)} title="Eliminar persona" style={{ marginLeft: '6px' }}>
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showMergeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '15px' }}><i className="fa-solid fa-code-merge"></i> Unificar Personas</h3>
            <p style={{ color: '#4b5563', marginBottom: '20px', fontSize: '0.9rem' }}>
              Has seleccionado <strong>{selectedPersonas.length}</strong> perfiles. Elige el nombre correcto que deseas conservar. Los correos se combinarán y los equipos se reasignarán a este perfil principal.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Perfil Principal (Master):</label>
              <select 
                value={mergeMasterId} 
                onChange={(e) => setMergeMasterId(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }}
              >
                {personas.filter(p => selectedPersonas.includes(p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.name} (ID: {p.idNumber})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowMergeModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleMerge} disabled={loading} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                {loading ? 'Unificando...' : 'Confirmar Unificación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowHistoryModal(null)}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#1f2937' }}>
                <i className="fa-solid fa-clock-rotate-left"></i> Historial de Equipos
              </h3>
              <button onClick={() => setShowHistoryModal(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#9ca3af' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px', fontWeight: 'bold' }}>{showHistoryModal.name}</p>

            {loadingHistory ? (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>Cargando historial...</p>
            ) : historyData.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px', background: '#f9fafb', borderRadius: '8px' }}>Esta persona no tiene historial de asignaciones.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                {historyData.map(asig => {
                  const formatDate = (timestamp: any) => {
                    if (!timestamp) return '---';
                    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                    return date.toLocaleString();
                  };
                  return (
                    <div key={asig.id} style={{ padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb', background: asig.estado === 'Asignado' ? '#eff6ff' : '#f9fafb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <strong>{asig.equipoAssetCode} <span style={{ fontWeight: 'normal', color: '#6b7280', fontSize: '12px' }}>({asig.equipoBrandModel})</span></strong>
                        <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '20px', background: asig.estado === 'Asignado' ? '#bfdbfe' : '#e5e7eb', color: asig.estado === 'Asignado' ? '#1d4ed8' : '#4b5563', fontWeight: 'bold' }}>
                          {asig.estado}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div><i className="fa-solid fa-calendar-check" style={{ width: '20px', color: '#10b981' }}></i> Entregado: {formatDate(asig.fechaAsignacion)}</div>
                        <div><i className="fa-solid fa-calendar-xmark" style={{ width: '20px', color: '#ef4444' }}></i> Devuelto: {asig.estado === 'Devuelto' ? formatDate(asig.fechaDevolucion) : '---'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
