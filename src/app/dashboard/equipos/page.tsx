"use client";
import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, deleteDoc, doc, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { QRCodeSVG } from 'qrcode.react';
import './equipos.css';

interface Equipment {
  id: string;
  assetCode: string;
  serialNumber: string;
  equipmentType: string;
  brandModel: string;
  technicalSpecs?: string;
  procesador?: string;
  board?: string;
  ram?: string;
  discoDuro?: string;
  monitor?: string;
  teclado?: string;
  mouse?: string;
  unidadCD?: boolean;
  parlantes?: boolean;
  tipoImpresora?: string;
  ownership: string;
  photoUrl?: string;
  status: string;
  createdAt?: any;
}

// Client-side image compression to lightweight JPEG Data URL
const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function EquiposPage() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedQR, setSelectedQR] = useState<Equipment | null>(null);
  const [editingEquip, setEditingEquip] = useState<Equipment | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [search, setSearch] = useState('');
  const [activeModule, setActiveModule] = useState('Computadores');
  const [activeAssignments, setActiveAssignments] = useState<Record<string, { personaId: string, personaName: string }>>({});
  const [personas, setPersonas] = useState<any[]>([]);
  
  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState<Equipment | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form State
  const [assetCode, setAssetCode] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [equipmentType, setEquipmentType] = useState('Portátil');
  const [brandModel, setBrandModel] = useState('');
  const [technicalSpecs, setTechnicalSpecs] = useState('');
  const [procesador, setProcesador] = useState('');
  const [board, setBoard] = useState('');
  const [ram, setRam] = useState('');
  const [discoDuro, setDiscoDuro] = useState('');
  const [monitor, setMonitor] = useState('');
  const [teclado, setTeclado] = useState('');
  const [mouse, setMouse] = useState('');
  const [unidadCD, setUnidadCD] = useState(false);
  const [parlantes, setParlantes] = useState(false);
  const [tipoImpresora, setTipoImpresora] = useState('Laserjet');
  const [ownership, setOwnership] = useState('Propio de la empresa');
  const [photoUrl, setPhotoUrl] = useState('');

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
    const q = query(collection(db, 'equipos'), orderBy('assetCode', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const equipData: Equipment[] = [];
      snapshot.forEach((doc) => {
        equipData.push({ id: doc.id, ...doc.data() } as Equipment);
      });
      setEquipments(equipData);
    });

    const qAsig = query(collection(db, 'asignaciones'), where('estado', '==', 'Asignado'));
    const unsubscribeAsig = onSnapshot(qAsig, (snapshot) => {
      const assignmentsMap: Record<string, { personaId: string, personaName: string }> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        assignmentsMap[data.equipoId] = { personaId: data.personaId, personaName: data.personaName };
      });
      setActiveAssignments(assignmentsMap);
    });

    const qPers = query(collection(db, 'personas'));
    const unsubscribePers = onSnapshot(qPers, (snapshot) => {
      const pData: any[] = [];
      snapshot.forEach(doc => pData.push({ id: doc.id, ...doc.data() }));
      setPersonas(pData);
    });

    return () => {
      unsubscribe();
      unsubscribeAsig();
      unsubscribePers();
    };
  }, []);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setPhotoUrl(compressed);
      } catch (err) {
        console.error("Error al procesar la foto:", err);
        alert("No se pudo procesar la foto elegida.");
      }
    }
  };

  const resetForm = () => {
    setAssetCode('');
    setSerialNumber('');
    setEquipmentType('Portátil');
    setBrandModel('');
    setTechnicalSpecs('');
    setProcesador(''); setBoard(''); setRam(''); setDiscoDuro(''); setMonitor(''); setTeclado(''); setMouse(''); setUnidadCD(false); setParlantes(false); setTipoImpresora('Laserjet');
    setOwnership('Propio de la empresa');
    setPhotoUrl('');
  };

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetCode.trim() || !serialNumber.trim() || !brandModel.trim()) {
      alert('Por favor complete los campos obligatorios.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'equipos'), {
        assetCode: assetCode.trim(),
        serialNumber: serialNumber.trim(),
        equipmentType,
        brandModel: brandModel.trim(),
        technicalSpecs: technicalSpecs.trim(),
        procesador: procesador.trim(),
        board: board.trim(),
        ram: ram.trim(),
        discoDuro: discoDuro.trim(),
        monitor: monitor.trim(),
        teclado: teclado.trim(),
        mouse: mouse.trim(),
        unidadCD,
        parlantes,
        tipoImpresora: equipmentType === 'Impresora' ? tipoImpresora : null,
        ownership,
        photoUrl: photoUrl || '',
        status: 'Dentro',
        createdAt: serverTimestamp()
      });
      
      resetForm();
      setShowAddModal(false);
    } catch (error: any) {
      console.error("Error adding equipment: ", error);
      alert("Hubo un error al guardar el equipo: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEquipment = async (id: string, brandModel: string) => {
    if (!confirm(`¿Seguro que deseas eliminar a "${brandModel}" del Inventario?`)) return;
    try {
      await deleteDoc(doc(db, 'equipos', id));
    } catch (error: any) {
      alert("Error al eliminar equipo: " + error.message);
    }
  };

  const handleShowHistory = async (equip: Equipment) => {
    setShowHistoryModal(equip);
    setLoadingHistory(true);
    setHistoryData([]);
    try {
      const qAsig = query(collection(db, 'asignaciones'), where('equipoId', '==', equip.id));
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

  const startEditEquipment = (equip: Equipment) => {
    setEditingEquip(equip);
    setAssetCode(equip.assetCode || '');
    setSerialNumber(equip.serialNumber || '');
    setEquipmentType(equip.equipmentType || 'Portátil');
    setBrandModel(equip.brandModel || '');
    setTechnicalSpecs(equip.technicalSpecs || '');
    setProcesador(equip.procesador || '');
    setBoard(equip.board || '');
    setRam(equip.ram || '');
    setDiscoDuro(equip.discoDuro || '');
    setMonitor(equip.monitor || '');
    setTeclado(equip.teclado || '');
    setMouse(equip.mouse || '');
    setUnidadCD(equip.unidadCD || false);
    setParlantes(equip.parlantes || false);
    setTipoImpresora(equip.tipoImpresora || 'Laserjet');
    setOwnership(equip.ownership || 'Propio de la empresa');
    setPhotoUrl(equip.photoUrl || '');
  };

  const handleUpdateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEquip) return;
    if (!assetCode.trim() || !serialNumber.trim() || !brandModel.trim()) {
      alert('Por favor complete los campos obligatorios.');
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'equipos', editingEquip.id), {
        assetCode: assetCode.trim(),
        serialNumber: serialNumber.trim(),
        equipmentType,
        brandModel: brandModel.trim(),
        technicalSpecs: technicalSpecs.trim(),
        procesador: procesador.trim(),
        board: board.trim(),
        ram: ram.trim(),
        discoDuro: discoDuro.trim(),
        monitor: monitor.trim(),
        teclado: teclado.trim(),
        mouse: mouse.trim(),
        unidadCD,
        parlantes,
        tipoImpresora: equipmentType === 'Impresora' ? tipoImpresora : null,
        ownership,
        photoUrl: photoUrl || ''
      });
      
      setEditingEquip(null);
      resetForm();
    } catch (error: any) {
      console.error("Error updating equipment: ", error);
      alert("Hubo un error al actualizar el equipo: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintQR = () => {
    window.print();
  };

  const filtered = equipments.filter(equip => {
    const isImpresora = (equip.equipmentType || '').toUpperCase().includes('IMPRESORA') || 
                        (equip.brandModel || '').toUpperCase().includes('IMPRESORA');
                        
    if (activeModule === 'Computadores' && isImpresora) return false;
    if (activeModule === 'Impresoras' && !isImpresora) return false;

    return (equip.brandModel || '').toLowerCase().includes(search.toLowerCase()) ||
    (equip.assetCode || '').toLowerCase().includes(search.toLowerCase()) ||
    (equip.serialNumber || '').toLowerCase().includes(search.toLowerCase()) ||
    (equip.equipmentType || '').toLowerCase().includes(search.toLowerCase()) ||
    (equip.ownership || '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="equipos-container">
      <div className="equipos-header-card">
        <h2><i className="fa-solid fa-server"></i> Inventario de Equipos</h2>
        {userRole === 'Admin' && (
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <i className="fa-solid fa-plus"></i> Nuevo Equipo
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button 
          onClick={() => setActiveModule('Computadores')}
          style={{ 
            padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', 
            background: activeModule === 'Computadores' ? '#4f46e5' : '#fff', 
            color: activeModule === 'Computadores' ? '#fff' : '#374151', 
            cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s' 
          }}>
          <i className="fa-solid fa-laptop" style={{ marginRight: '8px' }}></i> Computadores y Otros
        </button>
        <button 
          onClick={() => setActiveModule('Impresoras')}
          style={{ 
            padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', 
            background: activeModule === 'Impresoras' ? '#4f46e5' : '#fff', 
            color: activeModule === 'Impresoras' ? '#fff' : '#374151', 
            cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s' 
          }}>
          <i className="fa-solid fa-print" style={{ marginRight: '8px' }}></i> Impresoras
        </button>
      </div>

      <div className="equipos-list-card">

        <div className="equipos-search-bar">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder="Buscar por código, serial, marca o tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="table-responsive">
          <table className="equipos-table">
            <thead>
              <tr>
                <th>Código Activo</th>
                <th>Foto / Dispositivo</th>
                <th>Estado</th>
                <th>Propiedad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    {search ? 'No se encontraron coincidencias.' : 'No hay equipos registrados en la base de datos.'}
                  </td>
                </tr>
              ) : (
                filtered.map((equip) => {
                  const asigData = activeAssignments[equip.id];
                  let displayAssignedTo = '';
                  if (asigData) {
                    const foundPersona = personas.find(p => p.id === asigData.personaId);
                    displayAssignedTo = foundPersona ? foundPersona.name : (asigData.personaName || 'Asignado').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
                  }

                  return (
                    <tr key={equip.id}>
                      <td>
                        <strong>{equip.assetCode || '-'}</strong>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{equip.equipmentType}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {equip.photoUrl ? (
                            <img 
                              src={equip.photoUrl} 
                              alt={equip.brandModel} 
                              onClick={() => setPreviewImage(equip.photoUrl || null)}
                              style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} 
                              title="Haz clic para ver foto completa"
                            />
                          ) : (
                            <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#f3f4f6', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', border: '1px solid #e5e7eb' }}>
                              <i className="fa-solid fa-laptop"></i>
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: '600', color: '#1f2937' }}>{equip.brandModel}</div>
                            {equip.technicalSpecs && (
                              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={equip.technicalSpecs}>
                                {equip.technicalSpecs}
                              </div>
                            )}
                            <span style={{ fontFamily: 'monospace', fontSize: '12px', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', display: 'inline-block' }}>SN: {equip.serialNumber}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{
                            fontSize: '12px', padding: '4px 8px', borderRadius: '4px', fontWeight: '600', width: 'fit-content',
                            backgroundColor: asigData ? '#dbeafe' : (equip.status === 'Fuera' ? '#fee2e2' : (equip.status === 'Mantenimiento' ? '#fef3c7' : '#d1fae5')),
                            color: asigData ? '#1e40af' : (equip.status === 'Fuera' ? '#991b1b' : (equip.status === 'Mantenimiento' ? '#92400e' : '#065f46'))
                          }}>
                            {asigData ? 'Asignado' : (equip.status || 'Disponible')}
                          </span>
                          {asigData && (
                            <span style={{ fontSize: '11px', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <i className="fa-solid fa-user"></i> {displayAssignedTo}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '12px', padding: '4px 8px', borderRadius: '9999px', fontWeight: '600',
                          backgroundColor: equip.ownership === 'Propio de la empresa' ? '#e0e7ff' : '#f3f4f6',
                          color: equip.ownership === 'Propio de la empresa' ? '#3730a3' : '#4b5563'
                        }}>
                          {equip.ownership || 'No definido'}
                        </span>
                      </td>
                    <td className="actions-cell">
                      <button className="btn-qr" onClick={() => handleShowHistory(equip)} title="Ver Historial" style={{ background: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db', marginRight: '6px' }}>
                        <i className="fa-solid fa-clock-rotate-left"></i>
                      </button>
                      <button className="btn-qr" onClick={() => setSelectedQR(equip)} title="Ver QR">
                        <i className="fa-solid fa-qrcode"></i> Ver QR
                      </button>
                      {userRole === 'Admin' && (
                        <>
                          <button className="btn-edit" onClick={() => startEditEquipment(equip)} title="Editar Equipo">
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button className="btn-delete" onClick={() => handleDeleteEquipment(equip.id, equip.brandModel)} title="Eliminar Equipo">
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Equipment Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Registrar Nuevo Activo <button className="close-btn" onClick={() => setShowAddModal(false)}>&times;</button></h3>
            <form onSubmit={handleAddEquipment}>
              <div className="form-group">
                <label>Código de Activo *</label>
                <input type="text" value={assetCode} onChange={e => setAssetCode(e.target.value)} placeholder="Ej: ACT-00123" required />
              </div>
              <div className="form-group">
                <label>Serial *</label>
                <input type="text" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="Ej: PFXXXXXX" required />
              </div>
              <div className="form-group">
                <label>Tipo de Equipo *</label>
                <select value={equipmentType} onChange={e => setEquipmentType(e.target.value)}>
                  <option value="Portátil">Portátil</option>
                  <option value="PC Escritorio">PC Escritorio</option>
                  <option value="Monitor">Monitor</option>
                  <option value="Tablet">Tablet</option>
                  <option value="Docking Station">Docking Station</option>
                  <option value="Periférico">Periférico</option>
                  <option value="Impresora">Impresora</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Marca y Modelo *</label>
                <input type="text" value={brandModel} onChange={e => setBrandModel(e.target.value)} placeholder="Ej: Lenovo ThinkPad T14" required />
              </div>
              
              {(equipmentType === 'Portátil' || equipmentType === 'PC Escritorio') && (
                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '14px' }}>Componentes de Hardware</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group"><label>Procesador</label><input type="text" value={procesador} onChange={e=>setProcesador(e.target.value)} placeholder="Ej: Core i5" /></div>
                    <div className="form-group"><label>Board</label><input type="text" value={board} onChange={e=>setBoard(e.target.value)} /></div>
                    <div className="form-group"><label>Memoria RAM</label><input type="text" value={ram} onChange={e=>setRam(e.target.value)} placeholder="Ej: 8GB DDR4" /></div>
                    <div className="form-group"><label>Disco Duro</label><input type="text" value={discoDuro} onChange={e=>setDiscoDuro(e.target.value)} placeholder="Ej: 512GB SSD" /></div>
                    <div className="form-group"><label>Monitor (Marca/Serial)</label><input type="text" value={monitor} onChange={e=>setMonitor(e.target.value)} /></div>
                    <div className="form-group"><label>Teclado (Marca/Serial)</label><input type="text" value={teclado} onChange={e=>setTeclado(e.target.value)} /></div>
                    <div className="form-group"><label>Mouse (Marca/Serial)</label><input type="text" value={mouse} onChange={e=>setMouse(e.target.value)} /></div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', margin: 0 }}>
                        <input type="checkbox" checked={unidadCD} onChange={e=>setUnidadCD(e.target.checked)} /> Unidad CD/DVD
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', margin: 0 }}>
                        <input type="checkbox" checked={parlantes} onChange={e=>setParlantes(e.target.checked)} /> Parlantes/Diadema
                      </label>
                    </div>
                  </div>
                </div>
              )}
              {equipmentType === 'Impresora' && (
                <div className="form-group">
                  <label>Tipo de Impresora</label>
                  <select value={tipoImpresora} onChange={e=>setTipoImpresora(e.target.value)}>
                    <option value="Laserjet">Laserjet</option>
                    <option value="Officejet">Officejet</option>
                    <option value="Matricial">Matricial</option>
                    <option value="Ploter / Designjet">Ploter / Designjet</option>
                    <option value="Marquillas">Marquillas</option>
                    <option value="Etiquetas">Etiquetas</option>
                    <option value="Otra">Otra</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Características Técnicas / Observaciones</label>
                <textarea value={technicalSpecs} onChange={e => setTechnicalSpecs(e.target.value)} placeholder="Ej: Intel Core i5 10ma Gen, 16GB RAM, 512GB SSD..." rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontFamily: 'inherit' }} />
              </div>
              <div className="form-group">
                <label>Propiedad *</label>
                <select value={ownership} onChange={e => setOwnership(e.target.value)}>
                  <option value="Propio de la empresa">Propio de la empresa</option>
                  <option value="Personal">Personal</option>
                  <option value="Proveedor">Proveedor</option>
                </select>
              </div>
              <div className="form-group">
                <label><i className="fa-solid fa-camera"></i> Foto del Dispositivo (Opcional)</label>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} />
                {photoUrl && (
                  <div style={{ marginTop: '8px', position: 'relative', width: '90px', height: '90px' }}>
                    <img src={photoUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '2px solid #6366f1' }} />
                    <button type="button" onClick={() => setPhotoUrl('')} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>✕</button>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn-qr" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar Activo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Equipment Modal */}
      {editingEquip && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Editar Activo <button className="close-btn" onClick={() => { setEditingEquip(null); resetForm(); }}>&times;</button></h3>
            <form onSubmit={handleUpdateEquipment}>
              <div className="form-group">
                <label>Código de Activo *</label>
                <input type="text" value={assetCode} onChange={e => setAssetCode(e.target.value)} placeholder="Ej: ACT-00123" required />
              </div>
              <div className="form-group">
                <label>Serial *</label>
                <input type="text" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="Ej: PFXXXXXX" required />
              </div>
              <div className="form-group">
                <label>Tipo de Equipo *</label>
                <select value={equipmentType} onChange={e => setEquipmentType(e.target.value)}>
                  <option value="Portátil">Portátil</option>
                  <option value="PC Escritorio">PC Escritorio</option>
                  <option value="Monitor">Monitor</option>
                  <option value="Tablet">Tablet</option>
                  <option value="Docking Station">Docking Station</option>
                  <option value="Periférico">Periférico</option>
                  <option value="Impresora">Impresora</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Marca y Modelo *</label>
                <input type="text" value={brandModel} onChange={e => setBrandModel(e.target.value)} placeholder="Ej: Lenovo ThinkPad T14" required />
              </div>
              
              {(equipmentType === 'Portátil' || equipmentType === 'PC Escritorio') && (
                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '14px' }}>Componentes de Hardware</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group"><label>Procesador</label><input type="text" value={procesador} onChange={e=>setProcesador(e.target.value)} placeholder="Ej: Core i5" /></div>
                    <div className="form-group"><label>Board</label><input type="text" value={board} onChange={e=>setBoard(e.target.value)} /></div>
                    <div className="form-group"><label>Memoria RAM</label><input type="text" value={ram} onChange={e=>setRam(e.target.value)} placeholder="Ej: 8GB DDR4" /></div>
                    <div className="form-group"><label>Disco Duro</label><input type="text" value={discoDuro} onChange={e=>setDiscoDuro(e.target.value)} placeholder="Ej: 512GB SSD" /></div>
                    <div className="form-group"><label>Monitor (Marca/Serial)</label><input type="text" value={monitor} onChange={e=>setMonitor(e.target.value)} /></div>
                    <div className="form-group"><label>Teclado (Marca/Serial)</label><input type="text" value={teclado} onChange={e=>setTeclado(e.target.value)} /></div>
                    <div className="form-group"><label>Mouse (Marca/Serial)</label><input type="text" value={mouse} onChange={e=>setMouse(e.target.value)} /></div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', margin: 0 }}>
                        <input type="checkbox" checked={unidadCD} onChange={e=>setUnidadCD(e.target.checked)} /> Unidad CD/DVD
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', margin: 0 }}>
                        <input type="checkbox" checked={parlantes} onChange={e=>setParlantes(e.target.checked)} /> Parlantes/Diadema
                      </label>
                    </div>
                  </div>
                </div>
              )}
              {equipmentType === 'Impresora' && (
                <div className="form-group">
                  <label>Tipo de Impresora</label>
                  <select value={tipoImpresora} onChange={e=>setTipoImpresora(e.target.value)}>
                    <option value="Laserjet">Laserjet</option>
                    <option value="Officejet">Officejet</option>
                    <option value="Matricial">Matricial</option>
                    <option value="Ploter / Designjet">Ploter / Designjet</option>
                    <option value="Marquillas">Marquillas</option>
                    <option value="Etiquetas">Etiquetas</option>
                    <option value="Otra">Otra</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Características Técnicas / Observaciones</label>
                <textarea value={technicalSpecs} onChange={e => setTechnicalSpecs(e.target.value)} placeholder="Ej: Intel Core i5 10ma Gen, 16GB RAM, 512GB SSD..." rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontFamily: 'inherit' }} />
              </div>
              <div className="form-group">
                <label>Propiedad *</label>
                <select value={ownership} onChange={e => setOwnership(e.target.value)}>
                  <option value="Propio de la empresa">Propio de la empresa</option>
                  <option value="Personal">Personal</option>
                  <option value="Proveedor">Proveedor</option>
                </select>
              </div>
              <div className="form-group">
                <label><i className="fa-solid fa-camera"></i> Foto del Dispositivo (Opcional)</label>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} />
                {photoUrl && (
                  <div style={{ marginTop: '8px', position: 'relative', width: '90px', height: '90px' }}>
                    <img src={photoUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '2px solid #EB0072' }} />
                    <button type="button" onClick={() => setPhotoUrl('')} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>✕</button>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn-qr" onClick={() => { setEditingEquip(null); resetForm(); }}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {selectedQR && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h3>Etiqueta QR <button className="close-btn" onClick={() => setSelectedQR(null)}>&times;</button></h3>
            <div className="qr-container">
              <div className="qr-code">
                <QRCodeSVG value={selectedQR.assetCode || selectedQR.serialNumber} size={200} />
              </div>
              <div className="qr-info">
                <h4>{selectedQR.assetCode}</h4>
              </div>
            </div>
            <div style={{ marginTop: '16px' }}>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handlePrintQR}>
                <i className="fa-solid fa-print"></i> Imprimir Etiqueta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Photo Modal Viewer */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)} style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: '600px', textAlign: 'center', background: 'transparent', boxShadow: 'none', padding: '0' }} onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Foto del Dispositivo" style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '16px', border: '4px solid white', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} />
            <div style={{ marginTop: '16px' }}>
              <button className="btn-primary" style={{ margin: '0 auto' }} onClick={() => setPreviewImage(null)}>Cerrar Foto</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(null)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <button className="btn-close-modal" onClick={() => setShowHistoryModal(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            <h3 style={{ marginBottom: '15px', color: '#1f2937' }}>
              <i className="fa-solid fa-clock-rotate-left"></i> Historial: {showHistoryModal.brandModel}
            </h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>Código: {showHistoryModal.assetCode} | SN: {showHistoryModal.serialNumber}</p>

            {loadingHistory ? (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>Cargando historial...</p>
            ) : historyData.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px', background: '#f9fafb', borderRadius: '8px' }}>No hay historial de asignaciones para este equipo.</p>
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
                        <strong>{asig.personaName}</strong>
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
