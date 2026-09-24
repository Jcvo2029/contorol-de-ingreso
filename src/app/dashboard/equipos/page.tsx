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
  ipAddress?: string;
  osVersion?: string;
  windowsLicense?: string;
  officeLicense?: string;
  accessControlList?: { nombre: string; rol: string }[];
  cctvChannels?: { numero: string; descripcion: string }[];
  ownership: string;
  photoUrl?: string;
  status: string;
  createdAt?: any;
  tonerHistory?: { date?: any; installationDate?: any; removalDate?: any; initialPages: number; finalPages: number; totalPages: number; reference?: string }[];
}

// Helper to determine Toner Status Color
const getTonerColor = (reference: string, totalPages: number) => {
  const ref = (reference || '').toUpperCase().trim();
  let limit = 0;
  if (ref === 'CF226X') limit = 3500;
  else if (ref === 'CE278A') limit = 1800;
  else if (ref === 'CF283A') limit = 1800;
  else if (ref === 'CE505A') limit = 1800;
  else if (ref === 'CE505X') limit = 3000;
  
  if (limit === 0) return '#047857'; // Default Green
  if (totalPages >= limit) return '#dc2626'; // Red
  if (totalPages >= limit * 0.8) return '#d97706'; // Yellow
  return '#047857'; // Green
};

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
  const [tonerInstallationDate, setTonerInstallationDate] = useState('');
  const [tonerRemovalDate, setTonerRemovalDate] = useState('');
  const [tonerInitial, setTonerInitial] = useState('');
  const [tonerFinal, setTonerFinal] = useState('');
  const [tonerReference, setTonerReference] = useState('');
  const [addingToner, setAddingToner] = useState(false);
  const [editingTonerIndex, setEditingTonerIndex] = useState<number | null>(null);

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
  const [hasMonitor, setHasMonitor] = useState(false);
  const [teclado, setTeclado] = useState('');
  const [hasTeclado, setHasTeclado] = useState(false);
  const [mouse, setMouse] = useState('');
  const [hasMouse, setHasMouse] = useState(false);
  const [unidadCD, setUnidadCD] = useState(false);
  const [parlantes, setParlantes] = useState(false);
  const [osVersion, setOsVersion] = useState('');
  const [windowsLicense, setWindowsLicense] = useState('');
  const [officeLicense, setOfficeLicense] = useState('');
  const [tipoImpresora, setTipoImpresora] = useState('Laserjet');
  const [ipAddress, setIpAddress] = useState('');
  const [ownership, setOwnership] = useState('Propio de la empresa');
  const [photoUrl, setPhotoUrl] = useState('');
  const [assignedPrinterUser, setAssignedPrinterUser] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [accessControlList, setAccessControlList] = useState<{ nombre: string; rol: string }[]>([]);
  const [newAccessPerson, setNewAccessPerson] = useState('');
  const [newAccessRole, setNewAccessRole] = useState('');
  const [cctvChannels, setCctvChannels] = useState<{ numero: string; descripcion: string }[]>([]);
  const [newCctvChannelNumber, setNewCctvChannelNumber] = useState('');
  const [newCctvChannelDesc, setNewCctvChannelDesc] = useState('');

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
    setProcesador(''); setBoard(''); setRam(''); setDiscoDuro(''); 
    setMonitor(''); setHasMonitor(false);
    setTeclado(''); setHasTeclado(false);
    setMouse(''); setHasMouse(false);
    setUnidadCD(false); setParlantes(false); 
    setOsVersion(''); setWindowsLicense(''); setOfficeLicense('');
    setTipoImpresora('Laserjet');
    setIpAddress('');
    setOwnership('Propio de la empresa');
    setPhotoUrl('');
    setAssignedPrinterUser('');
    setUbicacion('');
    setAccessControlList([]);
    setNewAccessPerson('');
    setNewAccessRole('');
    setCctvChannels([]);
    setNewCctvChannelNumber('');
    setNewCctvChannelDesc('');
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
        monitor: hasMonitor ? monitor.trim() : '',
        teclado: hasTeclado ? teclado.trim() : '',
        mouse: hasMouse ? mouse.trim() : '',
        unidadCD,
        parlantes,
        tipoImpresora: equipmentType === 'Impresora' ? tipoImpresora : null,
        ipAddress: (equipmentType === 'Impresora' || equipmentType === 'Control de Acceso') ? ipAddress.trim() : null,
        ubicacion: (equipmentType === 'Control de Acceso' || equipmentType === 'CCTV') ? ubicacion.trim() : null,
        accessControlList: equipmentType === 'Control de Acceso' ? accessControlList : null,
        cctvChannels: equipmentType === 'CCTV' ? cctvChannels : null,
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

  const handleAddToner = async () => {
    if (!showHistoryModal || !tonerInstallationDate || !tonerRemovalDate || !tonerInitial || !tonerFinal) return;
    
    const initial = parseInt(tonerInitial);
    const final = parseInt(tonerFinal);
    const total = final - initial;
    
    if (isNaN(initial) || isNaN(final) || total < 0) {
      alert("Las páginas deben ser números válidos y las finales deben ser mayores a las iniciales.");
      return;
    }

    try {
      const newEntry = { 
        installationDate: tonerInstallationDate, 
        removalDate: tonerRemovalDate, 
        initialPages: initial, 
        finalPages: final, 
        totalPages: total, 
        reference: tonerReference 
      };
      
      let updatedHistory = [...(showHistoryModal.tonerHistory || [])];
      
      if (editingTonerIndex !== null) {
        updatedHistory[editingTonerIndex] = newEntry;
      } else {
        updatedHistory.push(newEntry);
      }
      
      await updateDoc(doc(db, 'equipos', showHistoryModal.id), {
        tonerHistory: updatedHistory
      });
      
      setShowHistoryModal({ ...showHistoryModal, tonerHistory: updatedHistory });
      setTonerInstallationDate('');
      setTonerRemovalDate('');
      setTonerInitial('');
      setTonerFinal('');
      setTonerReference('');
      setEditingTonerIndex(null);
      setAddingToner(false);
      
    } catch (error: any) {
      alert("Error al guardar tóner: " + error.message);
    }
  };

  const handleEditToner = (index: number) => {
    if (!showHistoryModal || !showHistoryModal.tonerHistory) return;
    const item = showHistoryModal.tonerHistory[index];
    setTonerInstallationDate(item.installationDate || item.date || '');
    setTonerRemovalDate(item.removalDate || '');
    setTonerInitial(item.initialPages.toString());
    setTonerFinal(item.finalPages.toString());
    setTonerReference(item.reference || '');
    setEditingTonerIndex(index);
    setAddingToner(true);
  };

  const handleToggleAddToner = () => {
    if (addingToner) {
      setAddingToner(false);
      setEditingTonerIndex(null);
      setTonerInstallationDate('');
      setTonerRemovalDate('');
      setTonerInitial('');
      setTonerFinal('');
      setTonerReference('');
    } else {
      if (showHistoryModal && showHistoryModal.tonerHistory && showHistoryModal.tonerHistory.length > 0) {
        // Sort history by date/removalDate or just take the last element
        const lastEntry = showHistoryModal.tonerHistory[showHistoryModal.tonerHistory.length - 1];
        setTonerInstallationDate(lastEntry.removalDate || '');
        setTonerInitial(lastEntry.finalPages.toString());
        setTonerReference(lastEntry.reference || '');
      } else {
        setTonerInstallationDate('');
        setTonerInitial('');
        setTonerReference('');
      }
      setTonerRemovalDate('');
      setTonerFinal('');
      setEditingTonerIndex(null);
      setAddingToner(true);
    }
  };

  const handleDeleteToner = async (index: number) => {
    if (!showHistoryModal || !showHistoryModal.tonerHistory) return;
    if (!confirm("¿Seguro que deseas eliminar este registro de tóner?")) return;
    
    try {
      const updatedHistory = showHistoryModal.tonerHistory.filter((_, i) => i !== index);
      await updateDoc(doc(db, 'equipos', showHistoryModal.id), {
        tonerHistory: updatedHistory
      });
      setShowHistoryModal({ ...showHistoryModal, tonerHistory: updatedHistory });
    } catch (error: any) {
      alert("Error al eliminar tóner: " + error.message);
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
    
    let et = equip.equipmentType || 'Portátil';
    if (et.toUpperCase() === 'PC DE ESCRITORIO' || et.toUpperCase() === 'PC ESCRITORIO') et = 'PC Escritorio';
    if (et.toUpperCase() === 'PORTATIL' || et.toUpperCase() === 'PORTÁTIL' || et.toUpperCase() === 'PC PORTATIL' || et.toUpperCase() === 'PC PORTÁTIL') et = 'Portátil';
    if (et.toUpperCase() === 'IMPRESORA') et = 'Impresora';
    
    setEquipmentType(et);
    setBrandModel(equip.brandModel || '');
    setTechnicalSpecs(equip.technicalSpecs || '');
    setProcesador(equip.procesador || '');
    setBoard(equip.board || '');
    setRam(equip.ram || '');
    setDiscoDuro(equip.discoDuro || '');
    setMonitor(equip.monitor || '');
    setHasMonitor(!!(equip.monitor && equip.monitor.trim() !== ''));
    setTeclado(equip.teclado || '');
    setHasTeclado(!!(equip.teclado && equip.teclado.trim() !== ''));
    setMouse(equip.mouse || '');
    setHasMouse(!!(equip.mouse && equip.mouse.trim() !== ''));
    setUnidadCD(equip.unidadCD || false);
    setParlantes(equip.parlantes || false);
    setOsVersion(equip.osVersion || '');
    setWindowsLicense(equip.windowsLicense || '');
    setOfficeLicense(equip.officeLicense || '');
    setTipoImpresora(equip.tipoImpresora || 'Laserjet');
    setIpAddress(equip.ipAddress || '');
    setUbicacion(equip.ubicacion || '');
    setAccessControlList(equip.accessControlList || []);
    setNewAccessPerson('');
    setNewAccessRole('');
    setCctvChannels(equip.cctvChannels || []);
    setNewCctvChannelNumber('');
    setNewCctvChannelDesc('');
    setOwnership(equip.ownership || 'Propio de la empresa');
    setPhotoUrl(equip.photoUrl || '');

    let initialPrinterUser = '';
    if (et === 'Impresora' && equip.serialNumber) {
      const toolPersona = personas.find(p => 
        p.printerSerial?.trim().toLowerCase() === equip.serialNumber.trim().toLowerCase() ||
        (p.assignedPrinters && p.assignedPrinters.some((ap:any) => ap.serial?.trim().toLowerCase() === equip.serialNumber.trim().toLowerCase()))
      );
      if (toolPersona) initialPrinterUser = toolPersona.id;
    }
    setAssignedPrinterUser(initialPrinterUser);
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
        monitor: hasMonitor ? monitor.trim() : '',
        teclado: hasTeclado ? teclado.trim() : '',
        mouse: hasMouse ? mouse.trim() : '',
        unidadCD,
        parlantes,
        osVersion: osVersion.trim(),
        windowsLicense: windowsLicense.trim(),
        officeLicense: officeLicense.trim(),
        tipoImpresora: equipmentType === 'Impresora' ? tipoImpresora : null,
        ipAddress: (equipmentType === 'Impresora' || equipmentType === 'Control de Acceso') ? ipAddress.trim() : null,
        ubicacion: (equipmentType === 'Control de Acceso' || equipmentType === 'CCTV') ? ubicacion.trim() : null,
        accessControlList: equipmentType === 'Control de Acceso' ? accessControlList : null,
        cctvChannels: equipmentType === 'CCTV' ? cctvChannels : null,
        ownership,
        photoUrl: photoUrl || ''
      });
      
      if (equipmentType === 'Impresora') {
        const oldPersona = personas.find(p => 
          p.printerSerial?.trim().toLowerCase() === editingEquip.serialNumber?.trim().toLowerCase() ||
          (p.assignedPrinters && p.assignedPrinters.some((ap:any) => ap.serial?.trim().toLowerCase() === editingEquip.serialNumber?.trim().toLowerCase()))
        );
        
        if (oldPersona && oldPersona.id !== assignedPrinterUser) {
          if (oldPersona.printerSerial?.trim().toLowerCase() === editingEquip.serialNumber?.trim().toLowerCase()) {
            await updateDoc(doc(db, 'personas', oldPersona.id), {
              printerSerial: '',
              printerBrandModel: ''
            });
          } else {
            const updatedPrinters = oldPersona.assignedPrinters.filter((ap:any) => ap.serial?.trim().toLowerCase() !== editingEquip.serialNumber?.trim().toLowerCase());
            await updateDoc(doc(db, 'personas', oldPersona.id), {
              assignedPrinters: updatedPrinters
            });
          }
        }
        
        if (assignedPrinterUser) {
          const newPersona = personas.find(p => p.id === assignedPrinterUser);
          if (newPersona) {
            const hasInPrimary = newPersona.printerSerial?.trim().toLowerCase() === serialNumber.trim().toLowerCase();
            const hasInAssigned = newPersona.assignedPrinters?.some((ap:any) => ap.serial?.trim().toLowerCase() === serialNumber.trim().toLowerCase());
            
            if (!hasInPrimary && !hasInAssigned) {
              if (!newPersona.printerSerial) {
                await updateDoc(doc(db, 'personas', assignedPrinterUser), {
                  printerSerial: serialNumber.trim(),
                  printerBrandModel: brandModel.trim()
                });
              } else {
                const newPrinters = [...(newPersona.assignedPrinters || []), { serial: serialNumber.trim(), brandModel: brandModel.trim() }];
                await updateDoc(doc(db, 'personas', assignedPrinterUser), {
                  assignedPrinters: newPrinters
                });
              }
            }
          }
        }
      }
      
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
    const et = (equip.equipmentType || '').toUpperCase();
    const bm = (equip.brandModel || '').toUpperCase();
    
    const isImpresora = et.includes('IMPRESORA') || bm.includes('IMPRESORA');
    const isTelefono = et.includes('TELÉFONO') || et.includes('TELEFONO') || bm.includes('TELÉFONO');
    const isAcceso = et.includes('CONTROL DE ACCESO') || et.includes('ACCESO') || bm.includes('CONTROL DE ACCESO');
    const isCCTV = et.includes('CCTV') || et.includes('CÁMARA') || et.includes('CAMARA') || et.includes('DVR') || et.includes('NVR') || bm.includes('CCTV') || bm.includes('DVR') || bm.includes('NVR');
    const isRedes = et.includes('RED') || et.includes('SWITCH') || et.includes('ROUTER') || et.includes('PATCH PANEL') || bm.includes('SWITCH') || et.includes('ACCESS POINT');

    if (activeModule === 'Computadores' && (isImpresora || isTelefono || isAcceso || isCCTV || isRedes)) return false;
    if (activeModule === 'Impresoras' && !isImpresora) return false;
    if (activeModule === 'Teléfonos' && !isTelefono) return false;
    if (activeModule === 'Control de Accesos' && !isAcceso) return false;
    if (activeModule === 'CCTV' && !isCCTV) return false;
    if (activeModule === 'Redes' && !isRedes) return false;

    return (equip.brandModel || '').toLowerCase().includes(search.toLowerCase()) ||
    (equip.assetCode || '').toLowerCase().includes(search.toLowerCase()) ||
    (equip.serialNumber || '').toLowerCase().includes(search.toLowerCase()) ||
    (equip.equipmentType || '').toLowerCase().includes(search.toLowerCase()) ||
    (equip.ownership || '').toLowerCase().includes(search.toLowerCase()) ||
    (equip.ipAddress || '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="equipos-container">
      <div style={{ display: 'flex', gap: '10px', background: 'white', padding: '15px 20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', marginBottom: '15px', flexWrap: 'wrap' }}>
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
        <button 
          onClick={() => setActiveModule('Teléfonos')}
          style={{ 
            padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', 
            background: activeModule === 'Teléfonos' ? '#4f46e5' : '#fff', 
            color: activeModule === 'Teléfonos' ? '#fff' : '#374151', 
            cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s' 
          }}>
          <i className="fa-solid fa-phone" style={{ marginRight: '8px' }}></i> Teléfonos
        </button>
        <button 
          onClick={() => setActiveModule('Control de Accesos')}
          style={{ 
            padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', 
            background: activeModule === 'Control de Accesos' ? '#4f46e5' : '#fff', 
            color: activeModule === 'Control de Accesos' ? '#fff' : '#374151', 
            cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s' 
          }}>
          <i className="fa-solid fa-id-badge" style={{ marginRight: '8px' }}></i> Control de Accesos
        </button>
        <button 
          onClick={() => setActiveModule('CCTV')}
          style={{ 
            padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', 
            background: activeModule === 'CCTV' ? '#4f46e5' : '#fff', 
            color: activeModule === 'CCTV' ? '#fff' : '#374151', 
            cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s' 
          }}>
          <i className="fa-solid fa-video" style={{ marginRight: '8px' }}></i> CCTV
        </button>
        <button 
          onClick={() => setActiveModule('Redes')}
          style={{ 
            padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', 
            background: activeModule === 'Redes' ? '#4f46e5' : '#fff', 
            color: activeModule === 'Redes' ? '#fff' : '#374151', 
            cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s' 
          }}>
          <i className="fa-solid fa-network-wired" style={{ marginRight: '8px' }}></i> Redes
        </button>
      </div>

      <div className="equipos-header-card">
        <h2><i className="fa-solid fa-server"></i> Inventario de Equipos</h2>
        {userRole === 'Admin' && (
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <i className="fa-solid fa-plus"></i> Nuevo Equipo
          </button>
        )}
      </div>

      <div className="equipos-list-card">

        <div className="equipos-search-bar">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder="Buscar por código, serial, marca, tipo o IP..."
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
                <th>Usuario Asignado</th>
                <th>Propiedad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    {search ? 'No se encontraron coincidencias.' : 'No hay equipos registrados en la base de datos.'}
                  </td>
                </tr>
              ) : (
                filtered.map((equip) => {
                  let asigData = activeAssignments[equip.id];
                  let displayAssignedTo = '';
                  let isAssignedViaTools = false;

                  if (!asigData && equip.serialNumber) {
                    const toolAssignedPersona = personas.find(p => 
                      p.printerSerial?.trim().toLowerCase() === equip.serialNumber.trim().toLowerCase() ||
                      (p.assignedPrinters && p.assignedPrinters.some((ap:any) => ap.serial?.trim().toLowerCase() === equip.serialNumber.trim().toLowerCase()))
                    );
                    if (toolAssignedPersona) {
                      asigData = { personaId: toolAssignedPersona.id, personaName: toolAssignedPersona.name };
                      isAssignedViaTools = true;
                    }
                  }

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
                            <span style={{ fontFamily: 'monospace', fontSize: '12px', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', display: 'inline-block', marginRight: '6px' }}>SN: {equip.serialNumber}</span>
                            {((equip.equipmentType || '').toLowerCase().includes('impresora') && equip.tonerHistory && equip.tonerHistory.length > 0) && (
                              (() => {
                                const lastToner = equip.tonerHistory[equip.tonerHistory.length - 1];
                                const color = getTonerColor(lastToner.reference || '', lastToner.totalPages);
                                return (
                                  <span style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f8fafc', border: `1px solid ${color}`, color, padding: '2px 6px', borderRadius: '12px' }} title={`Tóner actual: ${lastToner.totalPages} págs`}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }}></span>
                                    Tóner: {lastToner.totalPages}
                                  </span>
                                );
                              })()
                            )}
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
                            {asigData ? (isAssignedViaTools ? 'Asignado (Herramienta)' : 'Asignado') : (equip.status || 'Disponible')}
                          </span>
                        </div>
                      </td>
                      <td>
                        {asigData ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#374151', fontSize: '13px' }}>
                            <i className="fa-solid fa-user-check" style={{ color: '#4f46e5' }}></i> 
                            <span style={{ fontWeight: '500' }}>{displayAssignedTo}</span>
                          </div>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '12px', fontStyle: 'italic' }}>Sin asignar</span>
                        )}
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
                      <button className="btn-qr" onClick={() => handleShowHistory(equip)} title="Hoja de Vida" style={{ background: '#fef08a', color: '#854d0e', border: '1px solid #eab308', marginRight: '6px' }}>
                        <i className="fa-solid fa-file-lines"></i> Hoja de Vida
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
              <div className="form-grid">
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
                    <option value="Teléfono">Teléfono</option>
                    <option value="Control de Acceso">Control de Acceso</option>
                    <option value="CCTV">CCTV (Cámara/NVR/DVR)</option>
                    <option value="Equipo de Red">Equipo de Red (Switch/Router)</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Marca y Modelo *</label>
                  <input type="text" value={brandModel} onChange={e => setBrandModel(e.target.value)} placeholder="Ej: Lenovo ThinkPad T14" required />
                </div>
              </div>
              
              {((equipmentType || '').toLowerCase().includes('portátil') || (equipmentType || '').toLowerCase().includes('portatil') || (equipmentType || '').toLowerCase().includes('escritorio') || (equipmentType || '').toLowerCase().includes('servidor') || (equipmentType || '').toLowerCase().includes('computador') || (equipmentType || '').toLowerCase().includes('pc')) && (
                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '14px' }}>Componentes de Hardware</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    <div className="form-group"><label>Procesador</label><input type="text" value={procesador} onChange={e=>setProcesador(e.target.value)} placeholder="Ej: Core i5" /></div>
                    <div className="form-group"><label>Board</label><input type="text" value={board} onChange={e=>setBoard(e.target.value)} /></div>
                    <div className="form-group"><label>Memoria RAM</label><input type="text" value={ram} onChange={e=>setRam(e.target.value)} placeholder="Ej: 8GB DDR4" /></div>
                    <div className="form-group"><label>Disco Duro</label><input type="text" value={discoDuro} onChange={e=>setDiscoDuro(e.target.value)} placeholder="Ej: 512GB SSD" /></div>
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={hasMonitor} onChange={e=>setHasMonitor(e.target.checked)} />
                        Monitor (Marca/Serial)
                      </label>
                      {hasMonitor && <input type="text" value={monitor} onChange={e=>setMonitor(e.target.value)} />}
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={hasTeclado} onChange={e=>setHasTeclado(e.target.checked)} />
                        Teclado (Marca/Serial)
                      </label>
                      {hasTeclado && <input type="text" value={teclado} onChange={e=>setTeclado(e.target.value)} />}
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={hasMouse} onChange={e=>setHasMouse(e.target.checked)} />
                        Mouse (Marca/Serial)
                      </label>
                      {hasMouse && <input type="text" value={mouse} onChange={e=>setMouse(e.target.value)} />}
                    </div>
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
              {((equipmentType || '').toLowerCase().includes('portátil') || (equipmentType || '').toLowerCase().includes('portatil') || (equipmentType || '').toLowerCase().includes('escritorio') || (equipmentType || '').toLowerCase().includes('servidor') || (equipmentType || '').toLowerCase().includes('computador') || (equipmentType || '').toLowerCase().includes('pc')) && (
                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '14px' }}>Software y Licencias</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    <div className="form-group"><label>Versión de Sistema Operativo</label><input type="text" value={osVersion} onChange={e=>setOsVersion(e.target.value)} placeholder="Ej: Windows 10 Pro" /></div>
                    <div className="form-group"><label>Licencia de Windows</label><input type="text" value={windowsLicense} onChange={e=>setWindowsLicense(e.target.value)} placeholder="Clave de producto o tipo" /></div>
                    <div className="form-group">
                      <label>Licencia de Office (Usuario)</label>
                      <div style={{ padding: '10px', background: '#f3f4f6', borderRadius: '8px', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: '13px' }}>
                        Se vinculará automáticamente al asignar este equipo a un usuario.
                      </div>
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
              {equipmentType === 'Control de Acceso' && (
                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '14px' }}>Datos de Control de Acceso</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                    <div className="form-group"><label>Ubicación</label><input type="text" value={ubicacion} onChange={e=>setUbicacion(e.target.value)} placeholder="Ej: Puerta Principal" /></div>
                    <div className="form-group"><label>Dirección IP</label><input type="text" value={ipAddress} onChange={e=>setIpAddress(e.target.value)} placeholder="Ej: 192.168.1.100" /></div>
                  </div>
                  
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '14px' }}>Personal con Acceso</h4>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <input type="text" value={newAccessPerson} onChange={e=>setNewAccessPerson(e.target.value)} placeholder="Nombre del empleado" />
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <input type="text" value={newAccessRole} onChange={e=>setNewAccessRole(e.target.value)} placeholder="Rol (Ej: Administrador, Usuario)" />
                    </div>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      style={{ padding: '8px 16px', height: '42px', marginTop: '0' }}
                      onClick={() => {
                        if (newAccessPerson.trim() && newAccessRole.trim()) {
                          setAccessControlList([...accessControlList, { nombre: newAccessPerson.trim(), rol: newAccessRole.trim() }]);
                          setNewAccessPerson('');
                          setNewAccessRole('');
                        }
                      }}
                    >
                      <i className="fa-solid fa-plus"></i>
                    </button>
                  </div>
                  
                  {accessControlList.length > 0 && (
                    <div style={{ overflowX: 'auto', border: '1px solid #d1d5db', borderRadius: '6px' }}>
                      <table className="equipos-table" style={{ margin: 0, width: '100%' }}>
                        <thead style={{ background: '#f3f4f6' }}>
                          <tr>
                            <th style={{ padding: '8px', fontSize: '12px', textAlign: 'left' }}>Nombre</th>
                            <th style={{ padding: '8px', fontSize: '12px', textAlign: 'left' }}>Rol</th>
                            <th style={{ padding: '8px', fontSize: '12px', textAlign: 'center', width: '60px' }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accessControlList.map((item, idx) => (
                            <tr key={idx} style={{ borderTop: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '8px', fontSize: '13px' }}>{item.nombre}</td>
                              <td style={{ padding: '8px', fontSize: '13px' }}>{item.rol}</td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>
                                <button type="button" onClick={() => {
                                  const newList = [...accessControlList];
                                  newList.splice(idx, 1);
                                  setAccessControlList(newList);
                                }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              {equipmentType === 'CCTV' && (
                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '14px' }}>Datos de CCTV</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                    <div className="form-group"><label>Ubicación del Equipo</label><input type="text" value={ubicacion} onChange={e=>setUbicacion(e.target.value)} placeholder="Ej: Cuarto de Racks" /></div>
                    <div className="form-group"><label>Dirección IP</label><input type="text" value={ipAddress} onChange={e=>setIpAddress(e.target.value)} placeholder="Ej: 192.168.1.200" /></div>
                  </div>
                  
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '14px' }}>Canales de Grabación</h4>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <div className="form-group" style={{ width: '80px', marginBottom: 0 }}>
                      <input type="number" value={newCctvChannelNumber} onChange={e=>setNewCctvChannelNumber(e.target.value)} placeholder="N°" />
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <input type="text" value={newCctvChannelDesc} onChange={e=>setNewCctvChannelDesc(e.target.value)} placeholder="Ubicación que graba o descripción" />
                    </div>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      style={{ padding: '8px 16px', height: '42px', marginTop: '0' }}
                      onClick={() => {
                        if (newCctvChannelNumber.trim() && newCctvChannelDesc.trim()) {
                          setCctvChannels([...cctvChannels, { numero: newCctvChannelNumber.trim(), descripcion: newCctvChannelDesc.trim() }]);
                          setNewCctvChannelNumber('');
                          setNewCctvChannelDesc('');
                        }
                      }}
                    >
                      <i className="fa-solid fa-plus"></i>
                    </button>
                  </div>
                  
                  {cctvChannels.length > 0 && (
                    <div style={{ overflowX: 'auto', border: '1px solid #d1d5db', borderRadius: '6px' }}>
                      <table className="equipos-table" style={{ margin: 0, width: '100%' }}>
                        <thead style={{ background: '#f3f4f6' }}>
                          <tr>
                            <th style={{ padding: '8px', fontSize: '12px', textAlign: 'center', width: '60px' }}>Canal</th>
                            <th style={{ padding: '8px', fontSize: '12px', textAlign: 'left' }}>Descripción / Ubicación</th>
                            <th style={{ padding: '8px', fontSize: '12px', textAlign: 'center', width: '60px' }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cctvChannels.map((item, idx) => (
                            <tr key={idx} style={{ borderTop: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '8px', fontSize: '13px', textAlign: 'center', fontWeight: 'bold' }}>{item.numero}</td>
                              <td style={{ padding: '8px', fontSize: '13px' }}>{item.descripcion}</td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>
                                <button type="button" onClick={() => {
                                  const newList = [...cctvChannels];
                                  newList.splice(idx, 1);
                                  setCctvChannels(newList);
                                }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
              <div className="form-grid">
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
                    <option value="Teléfono">Teléfono</option>
                    <option value="Control de Acceso">Control de Acceso</option>
                    <option value="CCTV">CCTV (Cámara/NVR/DVR)</option>
                    <option value="Equipo de Red">Equipo de Red (Switch/Router)</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Marca y Modelo *</label>
                  <input type="text" value={brandModel} onChange={e => setBrandModel(e.target.value)} placeholder="Ej: Lenovo ThinkPad T14" required />
                </div>
              </div>
              
              {((equipmentType || '').toLowerCase().includes('portátil') || (equipmentType || '').toLowerCase().includes('portatil') || (equipmentType || '').toLowerCase().includes('escritorio') || (equipmentType || '').toLowerCase().includes('servidor') || (equipmentType || '').toLowerCase().includes('computador') || (equipmentType || '').toLowerCase().includes('pc')) && (
                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '14px' }}>Componentes de Hardware</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    <div className="form-group"><label>Procesador</label><input type="text" value={procesador} onChange={e=>setProcesador(e.target.value)} placeholder="Ej: Core i5" /></div>
                    <div className="form-group"><label>Board</label><input type="text" value={board} onChange={e=>setBoard(e.target.value)} /></div>
                    <div className="form-group"><label>Memoria RAM</label><input type="text" value={ram} onChange={e=>setRam(e.target.value)} placeholder="Ej: 8GB DDR4" /></div>
                    <div className="form-group"><label>Disco Duro</label><input type="text" value={discoDuro} onChange={e=>setDiscoDuro(e.target.value)} placeholder="Ej: 512GB SSD" /></div>
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={hasMonitor} onChange={e=>setHasMonitor(e.target.checked)} />
                        Monitor (Marca/Serial)
                      </label>
                      {hasMonitor && <input type="text" value={monitor} onChange={e=>setMonitor(e.target.value)} />}
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={hasTeclado} onChange={e=>setHasTeclado(e.target.checked)} />
                        Teclado (Marca/Serial)
                      </label>
                      {hasTeclado && <input type="text" value={teclado} onChange={e=>setTeclado(e.target.value)} />}
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={hasMouse} onChange={e=>setHasMouse(e.target.checked)} />
                        Mouse (Marca/Serial)
                      </label>
                      {hasMouse && <input type="text" value={mouse} onChange={e=>setMouse(e.target.value)} />}
                    </div>
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
              {((equipmentType || '').toLowerCase().includes('portátil') || (equipmentType || '').toLowerCase().includes('portatil') || (equipmentType || '').toLowerCase().includes('escritorio') || (equipmentType || '').toLowerCase().includes('servidor') || (equipmentType || '').toLowerCase().includes('computador') || (equipmentType || '').toLowerCase().includes('pc')) && (
                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '14px' }}>Software y Licencias</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    <div className="form-group"><label>Versión de Sistema Operativo</label><input type="text" value={osVersion} onChange={e=>setOsVersion(e.target.value)} placeholder="Ej: Windows 10 Pro" /></div>
                    <div className="form-group"><label>Licencia de Windows</label><input type="text" value={windowsLicense} onChange={e=>setWindowsLicense(e.target.value)} placeholder="Clave de producto o tipo" /></div>
                    <div className="form-group">
                      <label>Licencia de Office (Usuario)</label>
                      <div style={{ padding: '10px', background: '#f3f4f6', borderRadius: '8px', border: '1px solid #e5e7eb', color: '#374151', fontSize: '13px' }}>
                        {(() => {
                          if (editingEquip && activeAssignments[editingEquip.id]) {
                            const p = personas.find(pers => pers.id === activeAssignments[editingEquip.id].personaId);
                            if (p && p.office365License) {
                              let disp = `${p.office365License} (${p.office365Email || p.name})`;
                              if (p.office365Key) disp += ` - Llave: ${p.office365Key}`;
                              return disp;
                            }
                            return p ? 'Usuario asignado sin licencia registrada.' : 'Se vinculará automáticamente.';
                          }
                          return 'Equipo sin usuario asignado actualmente.';
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {equipmentType === 'Impresora' && (
                <>
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
                  <div className="form-group">
                    <label>Dirección IP (Opcional)</label>
                    <input 
                      type="text" 
                      value={ipAddress} 
                      onChange={(e) => setIpAddress(e.target.value)} 
                      placeholder="Ej: 192.168.1.50" 
                    />
                  </div>
                </>
              )}
              {equipmentType === 'Control de Acceso' && (
                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '14px' }}>Datos de Control de Acceso</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                    <div className="form-group"><label>Ubicación</label><input type="text" value={ubicacion} onChange={e=>setUbicacion(e.target.value)} placeholder="Ej: Puerta Principal" /></div>
                    <div className="form-group"><label>Dirección IP</label><input type="text" value={ipAddress} onChange={e=>setIpAddress(e.target.value)} placeholder="Ej: 192.168.1.100" /></div>
                  </div>
                  
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '14px' }}>Personal con Acceso</h4>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <input type="text" value={newAccessPerson} onChange={e=>setNewAccessPerson(e.target.value)} placeholder="Nombre del empleado" />
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <input type="text" value={newAccessRole} onChange={e=>setNewAccessRole(e.target.value)} placeholder="Rol (Ej: Administrador, Usuario)" />
                    </div>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      style={{ padding: '8px 16px', height: '42px', marginTop: '0' }}
                      onClick={() => {
                        if (newAccessPerson.trim() && newAccessRole.trim()) {
                          setAccessControlList([...accessControlList, { nombre: newAccessPerson.trim(), rol: newAccessRole.trim() }]);
                          setNewAccessPerson('');
                          setNewAccessRole('');
                        }
                      }}
                    >
                      <i className="fa-solid fa-plus"></i>
                    </button>
                  </div>
                  
                  {accessControlList.length > 0 && (
                    <div style={{ overflowX: 'auto', border: '1px solid #d1d5db', borderRadius: '6px' }}>
                      <table className="equipos-table" style={{ margin: 0, width: '100%' }}>
                        <thead style={{ background: '#f3f4f6' }}>
                          <tr>
                            <th style={{ padding: '8px', fontSize: '12px', textAlign: 'left' }}>Nombre</th>
                            <th style={{ padding: '8px', fontSize: '12px', textAlign: 'left' }}>Rol</th>
                            <th style={{ padding: '8px', fontSize: '12px', textAlign: 'center', width: '60px' }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accessControlList.map((item, idx) => (
                            <tr key={idx} style={{ borderTop: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '8px', fontSize: '13px' }}>{item.nombre}</td>
                              <td style={{ padding: '8px', fontSize: '13px' }}>{item.rol}</td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>
                                <button type="button" onClick={() => {
                                  const newList = [...accessControlList];
                                  newList.splice(idx, 1);
                                  setAccessControlList(newList);
                                }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              {equipmentType === 'CCTV' && (
                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '14px' }}>Datos de CCTV</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                    <div className="form-group"><label>Ubicación del Equipo</label><input type="text" value={ubicacion} onChange={e=>setUbicacion(e.target.value)} placeholder="Ej: Cuarto de Racks" /></div>
                    <div className="form-group"><label>Dirección IP</label><input type="text" value={ipAddress} onChange={e=>setIpAddress(e.target.value)} placeholder="Ej: 192.168.1.200" /></div>
                  </div>
                  
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '14px' }}>Canales de Grabación</h4>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <div className="form-group" style={{ width: '80px', marginBottom: 0 }}>
                      <input type="number" value={newCctvChannelNumber} onChange={e=>setNewCctvChannelNumber(e.target.value)} placeholder="N°" />
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <input type="text" value={newCctvChannelDesc} onChange={e=>setNewCctvChannelDesc(e.target.value)} placeholder="Ubicación que graba o descripción" />
                    </div>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      style={{ padding: '8px 16px', height: '42px', marginTop: '0' }}
                      onClick={() => {
                        if (newCctvChannelNumber.trim() && newCctvChannelDesc.trim()) {
                          setCctvChannels([...cctvChannels, { numero: newCctvChannelNumber.trim(), descripcion: newCctvChannelDesc.trim() }]);
                          setNewCctvChannelNumber('');
                          setNewCctvChannelDesc('');
                        }
                      }}
                    >
                      <i className="fa-solid fa-plus"></i>
                    </button>
                  </div>
                  
                  {cctvChannels.length > 0 && (
                    <div style={{ overflowX: 'auto', border: '1px solid #d1d5db', borderRadius: '6px' }}>
                      <table className="equipos-table" style={{ margin: 0, width: '100%' }}>
                        <thead style={{ background: '#f3f4f6' }}>
                          <tr>
                            <th style={{ padding: '8px', fontSize: '12px', textAlign: 'center', width: '60px' }}>Canal</th>
                            <th style={{ padding: '8px', fontSize: '12px', textAlign: 'left' }}>Descripción / Ubicación</th>
                            <th style={{ padding: '8px', fontSize: '12px', textAlign: 'center', width: '60px' }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cctvChannels.map((item, idx) => (
                            <tr key={idx} style={{ borderTop: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '8px', fontSize: '13px', textAlign: 'center', fontWeight: 'bold' }}>{item.numero}</td>
                              <td style={{ padding: '8px', fontSize: '13px' }}>{item.descripcion}</td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>
                                <button type="button" onClick={() => {
                                  const newList = [...cctvChannels];
                                  newList.splice(idx, 1);
                                  setCctvChannels(newList);
                                }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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

              {equipmentType === 'Impresora' ? (
                <div className="form-group">
                  <label>Asignar a Usuario Principal (Se refleja en Personas)</label>
                  <select value={assignedPrinterUser} onChange={e => setAssignedPrinterUser(e.target.value)}>
                    <option value="">-- Sin asignar --</option>
                    {personas.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.area || 'Sin área'})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label>Usuario Asignado (Solo Lectura)</label>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f3f4f6', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <span style={{ color: '#4b5563', fontSize: '14px' }}>
                      {(() => {
                        if (!editingEquip) return 'No disponible.';
                        let asigData = activeAssignments[editingEquip.id];
                        let isHerramienta = false;
                        if (!asigData && editingEquip.serialNumber) {
                          const toolPersona = personas.find(p => 
                            p.printerSerial?.trim().toLowerCase() === editingEquip.serialNumber.trim().toLowerCase() ||
                            (p.assignedPrinters && p.assignedPrinters.some((ap:any) => ap.serial?.trim().toLowerCase() === editingEquip.serialNumber.trim().toLowerCase()))
                          );
                          if (toolPersona) { asigData = { personaId: toolPersona.id, personaName: toolPersona.name }; isHerramienta = true; }
                        }
                        if (asigData) {
                          const found = personas.find(p => p.id === asigData.personaId);
                          return (found ? found.name : asigData.personaName) + (isHerramienta ? ' (Vía Herramientas)' : '');
                        }
                        return 'Sin asignar actualmente';
                      })()}
                    </span>
                    <a href="/dashboard/asignaciones" target="_blank" style={{ fontSize: '12px', background: 'white', border: '1px solid #d1d5db', padding: '4px 10px', borderRadius: '6px', textDecoration: 'none', color: '#374151', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-arrow-up-right-from-square"></i> Gestionar Asignación
                    </a>
                  </div>
                </div>
              )}

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

      {/* History Modal (Hoja de Vida) */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(null)}>
          <div className="modal-content hoja-vida-modal" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#1f2937' }}>
                <i className="fa-solid fa-file-lines"></i> Hoja de Vida del Equipo
              </h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                {userRole === 'Admin' && (
                  <button className="btn-edit" onClick={() => { startEditEquipment(showHistoryModal); setShowHistoryModal(null); }} style={{ padding: '8px 16px', fontSize: '0.95rem' }}>
                    <i className="fa-solid fa-pen"></i> Editar
                  </button>
                )}
                <button className="btn-primary" onClick={() => window.print()}><i className="fa-solid fa-print"></i> Imprimir</button>
                <button className="btn-close-modal" style={{ position: 'relative', top: 'auto', right: 'auto' }} onClick={() => setShowHistoryModal(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            <div className="hoja-vida-print-area">
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'flex-start' }}>
                {showHistoryModal.photoUrl ? (
                  <img src={showHistoryModal.photoUrl} alt="Foto Equipo" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                ) : (
                  <div style={{ width: '120px', height: '120px', borderRadius: '8px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: '#9ca3af' }}>
                    <i className="fa-solid fa-laptop"></i>
                  </div>
                )}
                
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: '0 0 5px 0', color: '#111827', fontSize: '1.2rem' }}>{showHistoryModal.brandModel}</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px', color: '#4b5563', marginTop: '10px' }}>
                    <div><strong>Código Activo:</strong> {showHistoryModal.assetCode}</div>
                    <div><strong>Serial:</strong> {showHistoryModal.serialNumber}</div>
                    <div><strong>Tipo:</strong> {showHistoryModal.equipmentType}</div>
                    <div><strong>Propiedad:</strong> {showHistoryModal.ownership}</div>
                    <div><strong>Estado Actual:</strong> {showHistoryModal.status}</div>
                    {showHistoryModal.ipAddress && <div><strong>IP:</strong> {showHistoryModal.ipAddress}</div>}
                    {showHistoryModal.ubicacion && <div><strong>Ubicación:</strong> {showHistoryModal.ubicacion}</div>}
                  </div>
                  
                  {showHistoryModal.accessControlList && showHistoryModal.accessControlList.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151' }}>Personal con Acceso</h4>
                      <table className="equipos-table" style={{ width: '100%', border: '1px solid #e5e7eb' }}>
                        <thead style={{ background: '#f3f4f6' }}>
                          <tr>
                            <th style={{ padding: '6px', fontSize: '12px' }}>Nombre</th>
                            <th style={{ padding: '6px', fontSize: '12px' }}>Rol</th>
                          </tr>
                        </thead>
                        <tbody>
                          {showHistoryModal.accessControlList.map((item, idx) => (
                            <tr key={idx} style={{ borderTop: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '6px', fontSize: '12px' }}>{item.nombre}</td>
                              <td style={{ padding: '6px', fontSize: '12px' }}>{item.rol}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {((showHistoryModal.equipmentType || '').toLowerCase().includes('portátil') || (showHistoryModal.equipmentType || '').toLowerCase().includes('escritorio') || (showHistoryModal.equipmentType || '').toLowerCase().includes('pc')) && (
                    <>
                      <h4 style={{ color: '#4b5563', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px', marginBottom: '12px', marginTop: '24px' }}>Software y Licencias</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9rem' }}>
                        <div><strong>Sistema Operativo:</strong> {showHistoryModal.osVersion || 'N/A'}</div>
                        <div><strong>Licencia Windows:</strong> {showHistoryModal.windowsLicense || 'N/A'}</div>
                        <div><strong>Licencia Office:</strong> {
                          (() => {
                            if (showHistoryModal && activeAssignments[showHistoryModal.id]) {
                              const p = personas.find(pers => pers.id === activeAssignments[showHistoryModal.id].personaId);
                              if (p && p.office365License) {
                                let disp = `${p.office365License} (${p.office365Email || p.name})`;
                                if (p.office365Key) disp += ` - Llave: ${p.office365Key}`;
                                return disp;
                              }
                              return p ? 'Sin licencia registrada' : 'Usuario no encontrado';
                            }
                            return 'No asignado a un usuario';
                          })()
                        }</div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {(showHistoryModal.equipmentType || '').toLowerCase().includes('impresora') ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e5e7eb', paddingBottom: '5px', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, color: '#374151' }}>Control de Tóner</h4>
                    <button className="no-print" onClick={handleToggleAddToner} style={{ padding: '4px 10px', fontSize: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      <i className={`fa-solid ${addingToner ? 'fa-xmark' : 'fa-plus'}`}></i> {addingToner ? 'Cancelar' : 'Registrar Cambio'}
                    </button>
                  </div>
                  
                  {addingToner && (
                    <div className="no-print" style={{ background: '#eff6ff', padding: '15px', borderRadius: '8px', marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>F. Instalación</label>
                        <input type="date" value={tonerInstallationDate} onChange={e => setTonerInstallationDate(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>F. Retiro</label>
                        <input type="date" value={tonerRemovalDate} onChange={e => setTonerRemovalDate(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Referencia</label>
                        <select value={tonerReference} onChange={e => setTonerReference(e.target.value)} style={{ padding: '6px', width: '120px', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                          <option value="">Seleccione...</option>
                          <option value="CF226X">CF226X</option>
                          <option value="CE278A">CE278A</option>
                          <option value="CF283A">CF283A</option>
                          <option value="CE505A">CE505A</option>
                          <option value="CE505X">CE505X</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Pág. Iniciales</label>
                        <input type="number" value={tonerInitial} onChange={e => setTonerInitial(e.target.value)} placeholder="0" style={{ padding: '6px', width: '90px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Pág. Finales</label>
                        <input type="number" value={tonerFinal} onChange={e => setTonerFinal(e.target.value)} placeholder="1000" style={{ padding: '6px', width: '90px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                      </div>
                      <button onClick={handleAddToner} style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        {editingTonerIndex !== null ? 'Actualizar' : 'Guardar'}
                      </button>
                    </div>
                  )}

                  {showHistoryModal.tonerHistory && showHistoryModal.tonerHistory.length > 0 ? (
                    <div className="table-responsive" style={{ marginBottom: '20px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                            <th style={{ padding: '8px' }}>F. Instalación</th>
                            <th style={{ padding: '8px' }}>F. Retiro</th>
                            <th style={{ padding: '8px' }}>Referencia</th>
                            <th style={{ padding: '8px' }}>Pág. Iniciales</th>
                            <th style={{ padding: '8px' }}>Pág. Finales</th>
                            <th style={{ padding: '8px' }}>Total Impresas</th>
                            <th style={{ padding: '8px' }}>Resmas Usadas</th>
                            <th className="no-print" style={{ padding: '8px', textAlign: 'center' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {showHistoryModal.tonerHistory.map((t, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '8px' }}>{t.installationDate || t.date || 'N/A'}</td>
                              <td style={{ padding: '8px' }}>{t.removalDate || 'N/A'}</td>
                              <td style={{ padding: '8px' }}>{t.reference || 'N/A'}</td>
                              <td style={{ padding: '8px' }}>{t.initialPages}</td>
                              <td style={{ padding: '8px' }}>{t.finalPages}</td>
                              <td style={{ padding: '8px', fontWeight: 'bold', color: getTonerColor(t.reference || '', t.totalPages) }}>{t.totalPages}</td>
                              <td style={{ padding: '8px', color: '#4f46e5' }}>{(t.totalPages / 500).toFixed(1)}</td>
                              <td className="no-print" style={{ padding: '8px', textAlign: 'center' }}>
                                <button onClick={() => handleEditToner(idx)} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', marginRight: '8px' }} title="Editar">
                                  <i className="fa-solid fa-pen"></i>
                                </button>
                                <button onClick={() => handleDeleteToner(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Eliminar">
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '15px', background: '#f9fafb', borderRadius: '8px', color: '#6b7280', fontSize: '13px', textAlign: 'center', marginBottom: '20px' }}>
                      No hay registros de cambio de tóner.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h4 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '5px', marginBottom: '10px', color: '#374151' }}>Especificaciones Técnicas</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px', color: '#4b5563', marginBottom: '20px', background: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
                    <div><strong>Procesador:</strong> {showHistoryModal.procesador || 'N/A'}</div>
                    <div><strong>RAM:</strong> {showHistoryModal.ram || 'N/A'}</div>
                    <div><strong>Disco Duro:</strong> {showHistoryModal.discoDuro || 'N/A'}</div>
                    <div><strong>Board:</strong> {showHistoryModal.board || 'N/A'}</div>
                    <div><strong>Monitor:</strong> {showHistoryModal.monitor || 'N/A'}</div>
                    <div><strong>Teclado / Mouse:</strong> {showHistoryModal.teclado ? showHistoryModal.teclado : 'N/A'} / {showHistoryModal.mouse ? showHistoryModal.mouse : 'N/A'}</div>
                    {showHistoryModal.technicalSpecs && (
                      <div style={{ gridColumn: '1 / -1', marginTop: '5px' }}><strong>Observaciones:</strong> {showHistoryModal.technicalSpecs}</div>
                    )}
                  </div>
                  
                  {showHistoryModal.equipmentType === 'CCTV' && showHistoryModal.cctvChannels && showHistoryModal.cctvChannels.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '5px', marginBottom: '15px', color: '#374151' }}>Representación de Canales (CCTV)</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
                        {showHistoryModal.cctvChannels.map((ch, i) => (
                          <div key={i} style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #d1d5db', paddingBottom: '5px' }}>
                              <strong style={{ color: '#111827', fontSize: '14px' }}>CH {ch.numero}</strong>
                              <i className="fa-solid fa-video" style={{ color: '#4b5563' }}></i>
                            </div>
                            <div style={{ fontSize: '12px', color: '#4b5563', lineHeight: '1.4' }}>
                              {ch.descripcion}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <h4 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '5px', marginBottom: '10px', color: '#374151' }}>Historial de Asignaciones</h4>
              {loadingHistory ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>Cargando historial...</p>
              ) : historyData.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px', background: '#f9fafb', borderRadius: '8px' }}>No hay historial de asignaciones para este equipo.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {historyData.map(asig => {
                    const formatDate = (timestamp: any) => {
                      if (!timestamp) return '---';
                      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                      return date.toLocaleString();
                    };
                    return (
                      <div key={asig.id} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: asig.estado === 'Asignado' ? '#eff6ff' : 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <strong><i className="fa-solid fa-user"></i> {asig.personaName}</strong>
                          <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '20px', background: asig.estado === 'Asignado' ? '#bfdbfe' : '#e5e7eb', color: asig.estado === 'Asignado' ? '#1d4ed8' : '#4b5563', fontWeight: 'bold' }}>
                            {asig.estado}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#4b5563', display: 'flex', justifyContent: 'space-between' }}>
                          <div><i className="fa-solid fa-calendar-check" style={{ color: '#10b981' }}></i> Entregado: {formatDate(asig.fechaAsignacion)}</div>
                          <div><i className="fa-solid fa-calendar-xmark" style={{ color: '#ef4444' }}></i> Devuelto: {asig.estado === 'Devuelto' ? formatDate(asig.fechaDevolucion) : '---'}</div>
                        </div>
                        {asig.observaciones && <div style={{ fontSize: '12px', marginTop: '5px', color: '#6b7280' }}><strong>Obs. Entrega:</strong> {asig.observaciones}</div>}
                        {asig.observacionesDevolucion && <div style={{ fontSize: '12px', marginTop: '5px', color: '#6b7280' }}><strong>Obs. Devolución:</strong> {asig.observacionesDevolucion}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
