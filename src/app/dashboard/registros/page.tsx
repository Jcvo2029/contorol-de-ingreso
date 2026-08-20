"use client";
import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Html5Qrcode } from 'html5-qrcode';
import './registros.css';

interface Registry {
  id: string;
  idNumber: string;
  employeeName: string;
  visitorType: 'Empleado' | 'Proveedor/Cliente';
  inChargeEmployee?: string;
  area: string;
  assetCode: string;
  serialNumber: string;
  equipmentType: string;
  brandModel: string;
  ownership: string;
  equipmentState: string;
  reason: string;
  type: 'Entrada' | 'Salida';
  notes: string;
  photoUrl?: string;
  timestamp: any;
  registeredBy: string;
}

interface Equipment {
  id: string;
  assetCode: string;
  serialNumber: string;
  equipmentType: string;
  brandModel: string;
  ownership: string;
  status?: string;
  photoUrl?: string;
}

interface Persona {
  id: string;
  idNumber: string;
  name: string;
  area: string;
  visitorType: 'Empleado' | 'Proveedor/Cliente';
  company?: string;
}

interface GroupedMovement {
  id: string;
  idNumber: string;
  employeeName: string;
  visitorType: 'Empleado' | 'Proveedor/Cliente';
  inChargeEmployee?: string;
  area: string;
  assetCode: string;
  serialNumber: string;
  equipmentType: string;
  brandModel: string;
  ownership: string;
  equipmentState: string;
  photoUrl?: string;
  entryTimestamp?: any;
  entryReason?: string;
  entryNotes?: string;
  entryBy?: string;
  exitTimestamp?: any;
  exitReason?: string;
  exitNotes?: string;
  exitBy?: string;
  isCurrentlyInside: boolean;
  rawEntryRecord?: Registry;
}

// Client-side image compression helper
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

export default function RegistrosPage() {
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  
  // Form toggle state (collapsed by default)
  const [showForm, setShowForm] = useState(false);

  // Person fields
  const [visitorType, setVisitorType] = useState<'Empleado' | 'Proveedor/Cliente'>('Empleado');
  const [idNumber, setIdNumber] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [inChargeEmployee, setInChargeEmployee] = useState('');
  const [area, setArea] = useState('');
  
  // Equipment fields
  const [assetCode, setAssetCode] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [equipmentType, setEquipmentType] = useState('Portátil');
  const [brandModel, setBrandModel] = useState('');
  const [ownership, setOwnership] = useState('Propio de la empresa');
  const [photoUrl, setPhotoUrl] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Movement fields
  const [equipmentState, setEquipmentState] = useState('Bueno');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

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

  // Add Master Equipment modal state directly from Registros
  const [showAddEquipModal, setShowAddEquipModal] = useState(false);
  const [newEquipAssetCode, setNewEquipAssetCode] = useState('');
  const [newEquipSerialNumber, setNewEquipSerialNumber] = useState('');
  const [newEquipType, setNewEquipType] = useState('Portátil');
  const [newEquipBrandModel, setNewEquipBrandModel] = useState('');
  const [newEquipOwnership, setNewEquipOwnership] = useState('Propio de la empresa');
  const [newEquipPhotoUrl, setNewEquipPhotoUrl] = useState('');
  const [newEquipLoading, setNewEquipLoading] = useState(false);

  const handleNewEquipPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setNewEquipPhotoUrl(compressed);
      } catch (err) {
        console.error("Error al procesar la foto:", err);
      }
    }
  };

  const handleCreateMasterEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEquipSerialNumber.trim() || !newEquipBrandModel.trim()) {
      alert('Por favor complete Serial y Marca/Modelo del equipo.');
      return;
    }
    setNewEquipLoading(true);
    try {
      let finalCode = newEquipAssetCode.trim() || `ACT-${Math.floor(100000 + Math.random() * 900000)}`;
      await addDoc(collection(db, 'equipos'), {
        assetCode: finalCode,
        serialNumber: newEquipSerialNumber,
        equipmentType: newEquipType,
        brandModel: newEquipBrandModel,
        ownership: newEquipOwnership,
        photoUrl: newEquipPhotoUrl || '',
        status: 'Dentro',
        createdAt: serverTimestamp()
      });

      // Autofill into Registros form
      setAssetCode(finalCode);
      setSerialNumber(newEquipSerialNumber);
      setEquipmentType(newEquipType);
      setBrandModel(newEquipBrandModel);
      setOwnership(newEquipOwnership);
      if (newEquipPhotoUrl) setPhotoUrl(newEquipPhotoUrl);

      setShowAddEquipModal(false);
      setShowForm(true);
      setNewEquipAssetCode('');
      setNewEquipSerialNumber('');
      setNewEquipBrandModel('');
      setNewEquipPhotoUrl('');
      alert(`✓ Equipo ${newEquipBrandModel} añadido con éxito al Inventario Maestro.`);
    } catch (err: any) {
      alert("Error al registrar equipo: " + err.message);
    } finally {
      setNewEquipLoading(false);
    }
  };

  // Quick Checkout modal state
  const [checkoutTarget, setCheckoutTarget] = useState<Registry | null>(null);
  const [checkoutConfirmId, setCheckoutConfirmId] = useState('');
  const [checkoutReason, setCheckoutReason] = useState('Salida de la empresa');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scannerContext, setScannerContext] = useState<'form' | 'checkout'>('form');
  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const scannerStarted = useRef(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }

    // Subscribe to registries (limit 150 for grouping)
    const qReg = query(collection(db, 'registros'), orderBy('timestamp', 'desc'), limit(150));
    const unsubReg = onSnapshot(qReg, (snapshot) => {
      const registryData: Registry[] = [];
      snapshot.forEach((doc) => {
        registryData.push({ id: doc.id, ...doc.data() } as Registry);
      });
      setRegistries(registryData);
    });

    // Fetch equipments for autofill
    const qEq = query(collection(db, 'equipos'));
    const unsubEq = onSnapshot(qEq, (snapshot) => {
      const equipData: Equipment[] = [];
      snapshot.forEach((doc) => {
        equipData.push({ id: doc.id, ...doc.data() } as Equipment);
      });
      setEquipments(equipData);
    });

    // Fetch personas for autofill
    const qPer = query(collection(db, 'personas'));
    const unsubPer = onSnapshot(qPer, (snapshot) => {
      const perData: Persona[] = [];
      snapshot.forEach((doc) => {
        perData.push({ id: doc.id, ...doc.data() } as Persona);
      });
      setPersonas(perData);
    });

    return () => {
      unsubReg();
      unsubEq();
      unsubPer();
      if (html5QrCode.current && html5QrCode.current.isScanning) {
        html5QrCode.current.stop().catch(console.error);
      }
    };
  }, []);

  const getGroupedMovements = (rawRegistries: Registry[]): GroupedMovement[] => {
    const sorted = [...rawRegistries].sort((a, b) => {
      const timeA = a.timestamp?.seconds || (a.timestamp?.toDate ? a.timestamp.toDate().getTime() / 1000 : 0);
      const timeB = b.timestamp?.seconds || (b.timestamp?.toDate ? b.timestamp.toDate().getTime() / 1000 : 0);
      return timeA - timeB;
    });

    const activeMap = new Map<string, GroupedMovement>();
    const completedList: GroupedMovement[] = [];

    for (const reg of sorted) {
      const key = (reg.serialNumber && reg.serialNumber.trim() !== '') 
        ? reg.serialNumber.toLowerCase() 
        : (reg.assetCode && reg.assetCode.trim() !== '') 
          ? reg.assetCode.toLowerCase() 
          : `${reg.idNumber}-${reg.equipmentType}`;

      if (reg.type === 'Entrada') {
        if (activeMap.has(key)) {
          completedList.push(activeMap.get(key)!);
        }

        const newGroup: GroupedMovement = {
          id: reg.id,
          idNumber: reg.idNumber,
          employeeName: reg.employeeName,
          visitorType: reg.visitorType,
          inChargeEmployee: reg.inChargeEmployee,
          area: reg.area,
          assetCode: reg.assetCode,
          serialNumber: reg.serialNumber,
          equipmentType: reg.equipmentType,
          brandModel: reg.brandModel,
          ownership: reg.ownership,
          equipmentState: reg.equipmentState,
          photoUrl: reg.photoUrl || '',
          entryTimestamp: reg.timestamp,
          entryReason: reg.reason,
          entryNotes: reg.notes,
          entryBy: reg.registeredBy,
          isCurrentlyInside: true,
          rawEntryRecord: reg
        };
        activeMap.set(key, newGroup);

      } else if (reg.type === 'Salida') {
        if (activeMap.has(key)) {
          const group = activeMap.get(key)!;
          group.exitTimestamp = reg.timestamp;
          group.exitReason = reg.reason;
          group.exitNotes = reg.notes;
          group.exitBy = reg.registeredBy;
          if (reg.photoUrl && !group.photoUrl) {
            group.photoUrl = reg.photoUrl;
          }
          group.isCurrentlyInside = false;

          completedList.push(group);
          activeMap.delete(key);
        } else {
          completedList.push({
            id: reg.id,
            idNumber: reg.idNumber,
            employeeName: reg.employeeName,
            visitorType: reg.visitorType,
            inChargeEmployee: reg.inChargeEmployee,
            area: reg.area,
            assetCode: reg.assetCode,
            serialNumber: reg.serialNumber,
            equipmentType: reg.equipmentType,
            brandModel: reg.brandModel,
            ownership: reg.ownership,
            equipmentState: reg.equipmentState,
            photoUrl: reg.photoUrl || '',
            exitTimestamp: reg.timestamp,
            exitReason: reg.reason,
            exitNotes: reg.notes,
            exitBy: reg.registeredBy,
            isCurrentlyInside: false,
            rawEntryRecord: reg
          });
        }
      }
    }

    for (const group of activeMap.values()) {
      completedList.push(group);
    }

    return completedList.sort((a, b) => {
      const timeA = Math.max(
        a.exitTimestamp?.seconds || (a.exitTimestamp?.toDate ? a.exitTimestamp.toDate().getTime() / 1000 : 0),
        a.entryTimestamp?.seconds || (a.entryTimestamp?.toDate ? a.entryTimestamp.toDate().getTime() / 1000 : 0)
      );
      const timeB = Math.max(
        b.exitTimestamp?.seconds || (b.exitTimestamp?.toDate ? b.exitTimestamp.toDate().getTime() / 1000 : 0),
        b.entryTimestamp?.seconds || (b.entryTimestamp?.toDate ? b.entryTimestamp.toDate().getTime() / 1000 : 0)
      );
      return timeB - timeA;
    });
  };

  // Autofill logic via ID Number (Person)
  const handleIdNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const id = e.target.value;
    setIdNumber(id);
    const found = personas.find(p => p.idNumber === id.trim() && id.trim() !== '');
    if (found) {
      setEmployeeName(found.name || '');
      setArea(found.area || found.company || '');
      setVisitorType(found.visitorType || 'Empleado');
    }
  };

  // Autofill logic via Serial Number (Manual typing)
  const handleSerialNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const serial = e.target.value;
    setSerialNumber(serial);
    
    // Find equipment by Serial Number
    const found = equipments.find(eq => eq.serialNumber.toLowerCase() === serial.toLowerCase() && serial !== '');
    if (found) {
      setAssetCode(found.assetCode || '');
      setEquipmentType(found.equipmentType || 'Portátil');
      setBrandModel(found.brandModel || '');
      setOwnership(found.ownership || 'Propio de la empresa');
      if (found.photoUrl) setPhotoUrl(found.photoUrl);
    } else {
      setAssetCode('');
    }
  };

  // QR Scanning Logic
  const startScanner = (context: 'form' | 'checkout' = 'form') => {
    setScannerContext(context);
    scannerStarted.current = false;
    setIsScanning(true);
  };

  useEffect(() => {
    if (!isScanning || scannerStarted.current) return;

    const initScanner = async () => {
      scannerStarted.current = true;
      try {
        if (html5QrCode.current) {
          try { await html5QrCode.current.stop(); } catch (_) {}
        }
        html5QrCode.current = new Html5Qrcode("qr-reader");
        await html5QrCode.current.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          (_errorMessage) => { /* scan errors — ignore */ }
        );
      } catch (err) {
        console.error("Error starting scanner:", err);
        alert("No se pudo iniciar la cámara. Verifica los permisos de cámara en tu navegador.");
        setIsScanning(false);
      }
    };

    initScanner();
  }, [isScanning]);

  const stopScanner = async () => {
    if (html5QrCode.current && html5QrCode.current.isScanning) {
      try { await html5QrCode.current.stop(); } catch (err) { console.error(err); }
    }
    scannerStarted.current = false;
    setIsScanning(false);
  };

  const handleScanSuccess = (decodedText: string) => {
    stopScanner();

    if (scannerContext === 'checkout' && checkoutTarget) {
      const matchesAsset = checkoutTarget.assetCode.toLowerCase() === decodedText.toLowerCase();
      const matchesSerial = checkoutTarget.serialNumber.toLowerCase() === decodedText.toLowerCase();
      const matchesId = checkoutTarget.idNumber.toLowerCase() === decodedText.toLowerCase();

      if (matchesAsset || matchesSerial || matchesId) {
        setCheckoutConfirmId(checkoutTarget.idNumber);
        alert(`✓ QR verificado con éxito: Equipo perteneciente a ${checkoutTarget.employeeName}`);
      } else {
        alert(`El QR escaneado (${decodedText}) no coincide con el equipo de ${checkoutTarget.employeeName}.`);
      }
      return;
    }

    setAssetCode(decodedText);
    const found = equipments.find(eq => eq.assetCode.toLowerCase() === decodedText.toLowerCase());
    if (found) {
      setSerialNumber(found.serialNumber || '');
      setEquipmentType(found.equipmentType || 'Portátil');
      setBrandModel(found.brandModel || '');
      setOwnership(found.ownership || 'Propio de la empresa');
      if (found.photoUrl) setPhotoUrl(found.photoUrl);
    } else {
      setSerialNumber('');
      setBrandModel('');
    }
  };

  const handleRegister = async (type: 'Entrada' | 'Salida') => {
    if (!idNumber.trim() || !employeeName.trim() || !brandModel.trim() || !serialNumber.trim() || !reason.trim()) {
      alert('Por favor complete los campos obligatorios: Identificación, Responsable, Serial, Marca/Modelo y Motivo.');
      return;
    }
    
    if (visitorType === 'Proveedor/Cliente' && !inChargeEmployee.trim()) {
      alert('Al ser un Proveedor/Cliente, debe especificar quién es el Empleado a Cargo internamente.');
      return;
    }

    setLoading(true);
    try {
      let finalAssetCode = assetCode;
      
      if (!finalAssetCode.trim()) {
        finalAssetCode = `ACT-${Math.floor(100000 + Math.random() * 900000)}`;
      }
      
      let foundEq = equipments.find(eq => eq.assetCode.toLowerCase() === finalAssetCode.toLowerCase() || eq.serialNumber.toLowerCase() === serialNumber.toLowerCase());
      const newStatus = type === 'Entrada' ? 'Dentro' : 'Fuera';

      if (foundEq) {
        await updateDoc(doc(db, 'equipos', foundEq.id), {
          status: newStatus,
          assetCode: finalAssetCode,
          ...(photoUrl ? { photoUrl } : {})
        });
        finalAssetCode = foundEq.assetCode || finalAssetCode;
      } else {
        await addDoc(collection(db, 'equipos'), {
          assetCode: finalAssetCode,
          serialNumber,
          equipmentType,
          brandModel,
          ownership,
          photoUrl: photoUrl || '',
          status: newStatus,
          createdAt: serverTimestamp()
        });
      }

      await addDoc(collection(db, 'registros'), {
        visitorType,
        idNumber,
        employeeName,
        inChargeEmployee: visitorType === 'Proveedor/Cliente' ? inChargeEmployee : '',
        area,
        assetCode: finalAssetCode,
        serialNumber,
        equipmentType,
        brandModel,
        ownership,
        equipmentState,
        reason,
        type,
        notes,
        photoUrl: photoUrl || '',
        timestamp: serverTimestamp(),
        registeredBy: currentUser?.name || 'Desconocido'
      });
      
      // Clear form and collapse it
      setVisitorType('Empleado');
      setIdNumber('');
      setEmployeeName('');
      setInChargeEmployee('');
      setArea('');
      setAssetCode('');
      setSerialNumber('');
      setEquipmentType('Portátil');
      setBrandModel('');
      setOwnership('Propio de la empresa');
      setEquipmentState('Bueno');
      setReason('');
      setNotes('');
      setPhotoUrl('');
      setShowForm(false);

      alert(`✓ ${type} registrada correctamente para ${employeeName}.`);
      
    } catch (error: any) {
      console.error("Error adding document: ", error);
      alert('Hubo un error al guardar el registro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCheckout = async () => {
    if (!checkoutTarget) return;
    if (checkoutConfirmId.trim() !== checkoutTarget.idNumber.trim()) {
      alert(`La cédula/ID ingresada (${checkoutConfirmId}) no coincide con la cédula del responsable (${checkoutTarget.idNumber}).`);
      return;
    }

    setCheckoutLoading(true);
    try {
      // 1. Update equipment status in 'equipos'
      const foundEq = equipments.find(eq => 
        (checkoutTarget.assetCode && eq.assetCode.toLowerCase() === checkoutTarget.assetCode.toLowerCase()) || 
        (checkoutTarget.serialNumber && eq.serialNumber.toLowerCase() === checkoutTarget.serialNumber.toLowerCase())
      );
      if (foundEq) {
        await updateDoc(doc(db, 'equipos', foundEq.id), { status: 'Fuera' });
      }

      // 2. Add 'Salida' record in 'registros'
      await addDoc(collection(db, 'registros'), {
        visitorType: checkoutTarget.visitorType || 'Empleado',
        idNumber: checkoutTarget.idNumber,
        employeeName: checkoutTarget.employeeName,
        inChargeEmployee: checkoutTarget.inChargeEmployee || '',
        area: checkoutTarget.area || '',
        assetCode: checkoutTarget.assetCode || '',
        serialNumber: checkoutTarget.serialNumber || '',
        equipmentType: checkoutTarget.equipmentType || 'Portátil',
        brandModel: checkoutTarget.brandModel || '',
        ownership: checkoutTarget.ownership || 'Propio de la empresa',
        equipmentState: checkoutTarget.equipmentState || 'Bueno',
        reason: checkoutReason || 'Salida de la empresa',
        type: 'Salida',
        notes: checkoutNotes || '',
        timestamp: serverTimestamp(),
        registeredBy: currentUser?.name || 'Desconocido'
      });

      setCheckoutTarget(null);
      alert(`✓ Salida de equipo registrada con éxito para ${checkoutTarget.employeeName}`);
    } catch (err: any) {
      console.error("Error confirming checkout:", err);
      alert("Error al registrar salida: " + err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '...';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '...';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const groupedMovements = getGroupedMovements(registries);

  return (
    <div className="registros-container">
      {/* Scanner Modal */}
      {isScanning && (
        <div className="scanner-modal-overlay">
          <div className="scanner-modal">
            <h3><i className="fa-solid fa-qrcode"></i> Escanear Código QR</h3>
            <p>{scannerContext === 'checkout' ? 'Apunta al QR del equipo para verificar la salida' : 'Apunta la cámara al código QR del equipo'}</p>
            <div id="qr-reader" style={{ width: '100%', maxWidth: '400px', margin: '0 auto', overflow: 'hidden', borderRadius: '12px' }}></div>
            <button className="btn-cancel-scan" onClick={stopScanner}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Quick Checkout Confirmation Modal */}
      {checkoutTarget && (
        <div className="checkout-modal-overlay">
          <div className="checkout-modal">
            <div className="checkout-modal-header">
              <h3><i className="fa-solid fa-person-walking-arrow-right"></i> Confirmar Salida de Equipo</h3>
              <button 
                onClick={() => setCheckoutTarget(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}
              >
                ✕
              </button>
            </div>

            <div className="checkout-info-box">
              <div className="checkout-info-row">
                <span>Responsable:</span>
                <strong>{checkoutTarget.employeeName}</strong>
              </div>
              <div className="checkout-info-row">
                <span>Cédula / ID:</span>
                <strong>{checkoutTarget.idNumber}</strong>
              </div>
              <div className="checkout-info-row">
                <span>Equipo:</span>
                <strong>{checkoutTarget.equipmentType} - {checkoutTarget.brandModel}</strong>
              </div>
              <div className="checkout-info-row">
                <span>Activo / SN:</span>
                <strong>{checkoutTarget.assetCode} ({checkoutTarget.serialNumber})</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                type="button" 
                className="btn-scan-qr" 
                onClick={() => startScanner('checkout')}
                style={{ padding: '12px', fontSize: '0.9rem' }}
              >
                <i className="fa-solid fa-camera"></i> Escanear QR para Confirmar
              </button>

              <div className="form-group">
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Confirmar N° Identificación (Cédula) *</label>
                <input 
                  type="text" 
                  placeholder={`Ingresa la cédula (${checkoutTarget.idNumber}) para confirmar`}
                  value={checkoutConfirmId}
                  onChange={(e) => setCheckoutConfirmId(e.target.value)}
                  style={{
                    borderColor: checkoutConfirmId.trim() === checkoutTarget.idNumber.trim() ? '#10b981' : '#d1d5db',
                    background: checkoutConfirmId.trim() === checkoutTarget.idNumber.trim() ? '#ecfdf5' : '#ffffff'
                  }}
                />
                {checkoutConfirmId.trim() === checkoutTarget.idNumber.trim() && (
                  <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>✓ Cédula confirmada correctamente</span>
                )}
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Motivo de Salida</label>
                <input 
                  type="text" 
                  value={checkoutReason}
                  onChange={(e) => setCheckoutReason(e.target.value)}
                  placeholder="Ej: Salida de la empresa, Mantenimiento..."
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Observaciones (Opcional)</label>
                <input 
                  type="text" 
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  placeholder="Ej: Salida autorizada con pase..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button 
                className="btn-salida" 
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={handleQuickCheckout}
                disabled={checkoutLoading || checkoutConfirmId.trim() !== checkoutTarget.idNumber.trim()}
              >
                {checkoutLoading ? 'Guardando...' : 'Confirmar y Marcar Salida'}
              </button>
              <button 
                className="logout-btn" 
                style={{ flex: '0.4', justifyContent: 'center' }}
                onClick={() => setCheckoutTarget(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Header & Collapsible Form */}
      <div className="registros-header-card">
        <h2>
          <i className="fa-solid fa-clipboard-list" style={{ color: '#4f46e5' }}></i>
          Control de Entradas y Salidas
        </h2>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            className="btn-toggle-form"
            style={{ background: '#059669', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)' }}
            onClick={() => setShowAddEquipModal(true)}
          >
            <i className="fa-solid fa-server"></i>
            + Registrar Equipo en Inventario
          </button>

          <button 
            className="btn-toggle-form"
            onClick={() => setShowForm(!showForm)}
          >
            <i className={`fa-solid ${showForm ? 'fa-xmark' : 'fa-plus'}`}></i>
            {showForm ? 'Ocultar Formulario' : 'Nuevo Registro / Ingreso'}
          </button>
        </div>
      </div>

      {/* Registration Form (Collapsible) */}
      {showForm && (
        <div className="registry-form-card">
          <h2><i className="fa-solid fa-laptop"></i> Formulario de Registro de Equipos</h2>
          
          <div style={{ background: '#eff6ff', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', borderLeft: '4px solid #3b82f6', fontSize: '0.86rem', color: '#1e40af' }}>
            <i className="fa-solid fa-circle-info" style={{ marginRight: '6px' }}></i>
            <strong>Crear o Vincular Equipos:</strong> Si el serial ingresado ya existe, se autocompletará. Si es un equipo nuevo, al guardar la Entrada o Salida se registrará **automáticamente** en el Inventario Maestro.
          </div>
          
          {/* Fila 0: Tipo de Visitante */}
          <div className="form-row" style={{ background: '#f3f4f6', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Tipo de Persona *</label>
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal', color: '#1f2937' }}>
                  <input 
                    type="radio" 
                    name="visitorType" 
                    checked={visitorType === 'Empleado'} 
                    onChange={() => setVisitorType('Empleado')} 
                    style={{ width: '16px', height: '16px' }}
                  /> 
                  Empleado de la Empresa
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal', color: '#1f2937' }}>
                  <input 
                    type="radio" 
                    name="visitorType" 
                    checked={visitorType === 'Proveedor/Cliente'} 
                    onChange={() => setVisitorType('Proveedor/Cliente')} 
                    style={{ width: '16px', height: '16px' }}
                  /> 
                  Proveedor o Cliente (Visitante)
                </label>
              </div>
            </div>
          </div>

          {/* Fila 1: Responsable y Área */}
          <div className="form-row">
            <div className="form-group" style={{ flex: '0.8' }}>
              <label>N° Identificación (CC/ID) *</label>
              <input 
                type="text" 
                placeholder="Ej: 123456789" 
                value={idNumber}
                onChange={handleIdNumberChange}
                disabled={loading}
                style={{ borderColor: personas.find(p => p.idNumber === idNumber) ? '#4f46e5' : undefined }}
              />
            </div>

            <div className="form-group">
              <label>{visitorType === 'Empleado' ? 'Empleado Responsable *' : 'Nombre del Visitante (Proveedor/Cliente) *'}</label>
              <input 
                type="text" 
                placeholder="Ej: Juan Pérez" 
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                disabled={loading}
              />
            </div>
            
            {visitorType === 'Proveedor/Cliente' && (
              <div className="form-group">
                <label>Empleado a Cargo (Quien autoriza) *</label>
                <input 
                  type="text" 
                  placeholder="Ej: Ing. Carlos Gómez" 
                  value={inChargeEmployee}
                  onChange={(e) => setInChargeEmployee(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}

            <div className="form-group">
              <label>{visitorType === 'Empleado' ? 'Área / Departamento' : 'Empresa / Proveedor'}</label>
              <input 
                type="text" 
                placeholder={visitorType === 'Empleado' ? "Ej: Tecnología..." : "Ej: Microsoft..."} 
                value={area}
                onChange={(e) => setArea(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Action button to open Scanner */}
          <div style={{ marginBottom: '20px' }}>
            <button type="button" className="btn-scan-qr" onClick={() => startScanner('form')}>
              <i className="fa-solid fa-camera"></i> Escanear Etiqueta QR del Equipo
            </button>
          </div>

          {/* Fila 2: Datos del Equipo */}
          <div className="form-row">
            <div className="form-group">
              <label>Serial *</label>
              <input 
                type="text" 
                placeholder="Ej: SN-12345678 (Autocompleta si existe)" 
                value={serialNumber}
                onChange={handleSerialNumberChange}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Código de Activo</label>
              <input 
                type="text" 
                placeholder={assetCode ? assetCode : "Generado por el sistema o por QR"} 
                value={assetCode}
                disabled={true}
                style={{ background: assetCode ? '#e0e7ff' : '#f3f4f6', cursor: 'not-allowed', color: assetCode ? '#3730a3' : '#6b7280', fontWeight: assetCode ? 'bold' : 'normal' }}
              />
            </div>
            
            <div className="form-group">
              <label>Tipo de Equipo *</label>
              <select 
                value={equipmentType}
                onChange={(e) => setEquipmentType(e.target.value)}
                disabled={loading}
                style={{ padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit' }}
              >
                <option value="Portátil">Portátil</option>
                <option value="PC Escritorio">PC Escritorio</option>
                <option value="Monitor">Monitor</option>
                <option value="Tablet">Tablet</option>
                <option value="Teclado/Mouse">Teclado / Mouse</option>
                <option value="Escáner/Impresora">Escáner / Impresora</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>

          {/* Fila 3: Marca y Propiedad */}
          <div className="form-row">
            <div className="form-group">
              <label>Marca y Modelo *</label>
              <input 
                type="text" 
                placeholder="Ej: Dell Latitude 5420" 
                value={brandModel}
                onChange={(e) => setBrandModel(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Pertenencia del Equipo *</label>
              <select 
                value={ownership}
                onChange={(e) => setOwnership(e.target.value)}
                disabled={loading}
                style={{ padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit' }}
              >
                <option value="Propio de la empresa">Propio de la empresa</option>
                <option value="Personal">Personal</option>
                <option value="Proveedor">Proveedor</option>
              </select>
            </div>
          </div>

          {/* Fila 4: Movimiento y Estado */}
          <div className="form-row">
            <div className="form-group">
              <label>Estado del Equipo *</label>
              <select 
                value={equipmentState}
                onChange={(e) => setEquipmentState(e.target.value)}
                disabled={loading}
                style={{ padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit' }}
              >
                <option value="Bueno">Bueno</option>
                <option value="Regular">Regular</option>
                <option value="Malo">Malo</option>
              </select>
            </div>

            <div className="form-group">
              <label>Motivo *</label>
              <input 
                type="text" 
                placeholder="Ej: Trabajo en casa, Mantenimiento..." 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group" style={{ flex: '2' }}>
              <label>Observaciones (Opcional)</label>
              <input 
                type="text" 
                placeholder="Ej: Equipo con un rayón en la pantalla..." 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Fila 5: Foto del Dispositivo */}
          <div className="form-row" style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px dashed #cbd5e1' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                <i className="fa-solid fa-camera" style={{ color: '#4f46e5' }}></i> 
                Foto / Captura del Dispositivo (Opcional)
              </label>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                onChange={handlePhotoChange}
                disabled={loading}
                style={{ marginTop: '8px' }}
              />
              {photoUrl && (
                <div style={{ marginTop: '12px', position: 'relative', width: '100px', height: '100px' }}>
                  <img src={photoUrl} alt="Vista previa equipo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px', border: '2px solid #4f46e5' }} />
                  <button 
                    type="button" 
                    onClick={() => setPhotoUrl('')} 
                    style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button 
              className="btn-entrada" 
              onClick={() => handleRegister('Entrada')}
              disabled={loading || !idNumber.trim() || !employeeName.trim() || !brandModel.trim() || !serialNumber.trim() || !reason.trim() || (visitorType === 'Proveedor/Cliente' && !inChargeEmployee.trim())}
            >
              <i className="fa-solid fa-arrow-right-to-bracket"></i> Marcar Entrada
            </button>
            
            <button 
              className="btn-salida" 
              onClick={() => handleRegister('Salida')}
              disabled={loading || !idNumber.trim() || !employeeName.trim() || !brandModel.trim() || !serialNumber.trim() || !reason.trim() || (visitorType === 'Proveedor/Cliente' && !inChargeEmployee.trim())}
            >
              <i className="fa-solid fa-arrow-right-from-bracket"></i> Marcar Salida
            </button>
            
            <button 
              type="button" 
              className="logout-btn"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Movements Table */}
      <div className="registry-list-card">
        <h2><i className="fa-solid fa-list-check"></i> Historial de Visitas y Movimientos</h2>
        
        <div className="table-responsive">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Persona / Responsable</th>
                <th>Foto / Equipo</th>
                <th>Ingreso (Entrada)</th>
                <th>Salida</th>
                <th>Estado Visita</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {groupedMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No hay registros de entradas o salidas el día de hoy.
                  </td>
                </tr>
              ) : (
                groupedMovements.map((group) => (
                  <tr key={group.id}>
                    <td>
                      <strong>{group.employeeName}</strong>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>ID: {group.idNumber}</div>
                      <div style={{ fontSize: '12px', color: group.visitorType === 'Empleado' ? '#059669' : '#d97706', fontWeight: '600' }}>
                        {group.visitorType}
                      </div>
                      {group.inChargeEmployee && <div style={{ fontSize: '11px', color: '#6b7280' }}>A cargo: {group.inChargeEmployee}</div>}
                      {group.area && <div style={{ fontSize: '11px', color: '#6b7280' }}>{group.area}</div>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {group.photoUrl ? (
                          <img 
                            src={group.photoUrl} 
                            alt={group.brandModel} 
                            onClick={() => setPreviewImage(group.photoUrl || null)}
                            style={{ width: '46px', height: '46px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} 
                            title="Haz clic para ver foto del dispositivo"
                          />
                        ) : (
                          <div style={{ width: '46px', height: '46px', borderRadius: '8px', background: '#f1f5f9', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', border: '1px solid #cbd5e1' }}>
                            <i className="fa-solid fa-laptop"></i>
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: '600', color: '#1f2937' }}>{group.equipmentType} - {group.brandModel}</div>
                          <div style={{ marginTop: '2px' }}>
                            <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '4px', marginRight: '6px' }}>Activo: {group.assetCode}</span>
                            <span style={{ fontSize: '11px', background: '#f3f4f6', color: '#4b5563', padding: '2px 6px', borderRadius: '4px' }}>SN: {group.serialNumber}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {group.entryTimestamp ? (
                        <>
                          <div><strong>{formatDate(group.entryTimestamp)}</strong> {formatTime(group.entryTimestamp)}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{group.entryReason}</div>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>-</span>
                      )}
                    </td>
                    <td>
                      {group.exitTimestamp ? (
                        <>
                          <div><strong>{formatDate(group.exitTimestamp)}</strong> {formatTime(group.exitTimestamp)}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{group.exitReason}</div>
                        </>
                      ) : (
                        <span style={{ color: '#059669', fontStyle: 'italic', fontSize: '12px', fontWeight: '500' }}>Pendiente de salida</span>
                      )}
                    </td>
                    <td>
                      {group.isCurrentlyInside ? (
                        <span className="badge entrada">Dentro</span>
                      ) : (
                        <span className="badge salida">Fuera</span>
                      )}
                    </td>
                    <td>
                      {group.isCurrentlyInside ? (
                        <button 
                          className="btn-quick-salida"
                          onClick={() => {
                            const target = group.rawEntryRecord || {
                              id: group.id,
                              idNumber: group.idNumber,
                              employeeName: group.employeeName,
                              visitorType: group.visitorType,
                              inChargeEmployee: group.inChargeEmployee,
                              area: group.area,
                              assetCode: group.assetCode,
                              serialNumber: group.serialNumber,
                              equipmentType: group.equipmentType,
                              brandModel: group.brandModel,
                              ownership: group.ownership,
                              equipmentState: group.equipmentState,
                              reason: group.entryReason || '',
                              type: 'Entrada',
                              notes: '',
                              timestamp: group.entryTimestamp,
                              registeredBy: group.entryBy || ''
                            };
                            setCheckoutTarget(target as Registry);
                            setCheckoutConfirmId('');
                            setCheckoutReason('Salida de la empresa');
                            setCheckoutNotes('');
                          }}
                        >
                          <i className="fa-solid fa-arrow-right-from-bracket"></i> Marcar Salida
                        </button>
                      ) : (
                        <span style={{ color: '#059669', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fa-solid fa-circle-check"></i> Salida Registrada
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Photo Modal Viewer */}
      {previewImage && (
        <div className="scanner-modal-overlay" onClick={() => setPreviewImage(null)} style={{ zIndex: 10000 }}>
          <div className="checkout-modal" style={{ maxWidth: '600px', textAlign: 'center', background: 'transparent', boxShadow: 'none', padding: '0', border: 'none' }} onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Foto del Dispositivo" style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '16px', border: '4px solid white', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} />
            <div style={{ marginTop: '16px' }}>
              <button className="btn-toggle-form" style={{ margin: '0 auto' }} onClick={() => setPreviewImage(null)}>Cerrar Foto</button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Add Master Equipment Modal */}
      {showAddEquipModal && (
        <div className="scanner-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="checkout-modal" style={{ maxWidth: '520px' }}>
            <div className="checkout-modal-header">
              <h3><i className="fa-solid fa-server" style={{ color: '#059669' }}></i> Añadir Equipo a Inventario</h3>
              <button 
                onClick={() => setShowAddEquipModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMasterEquipment} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Serial del Equipo *</label>
                <input 
                  type="text" 
                  placeholder="Ej: SN-98765432" 
                  value={newEquipSerialNumber}
                  onChange={(e) => setNewEquipSerialNumber(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Marca y Modelo *</label>
                <input 
                  type="text" 
                  placeholder="Ej: HP ProBook 450 G8" 
                  value={newEquipBrandModel}
                  onChange={(e) => setNewEquipBrandModel(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Código de Activo (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="Auto-generado si queda vacío" 
                    value={newEquipAssetCode}
                    onChange={(e) => setNewEquipAssetCode(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Tipo de Equipo</label>
                  <select value={newEquipType} onChange={(e) => setNewEquipType(e.target.value)}>
                    <option value="Portátil">Portátil</option>
                    <option value="PC Escritorio">PC Escritorio</option>
                    <option value="Monitor">Monitor</option>
                    <option value="Tablet">Tablet</option>
                    <option value="Teclado/Mouse">Teclado / Mouse</option>
                    <option value="Escáner/Impresora">Escáner / Impresora</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Pertenencia</label>
                <select value={newEquipOwnership} onChange={(e) => setNewEquipOwnership(e.target.value)}>
                  <option value="Propio de la empresa">Propio de la empresa</option>
                  <option value="Personal">Personal</option>
                  <option value="Proveedor">Proveedor</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}><i className="fa-solid fa-camera"></i> Foto del Dispositivo (Opcional)</label>
                <input type="file" accept="image/*" capture="environment" onChange={handleNewEquipPhotoChange} />
                {newEquipPhotoUrl && (
                  <div style={{ marginTop: '8px', position: 'relative', width: '80px', height: '80px' }}>
                    <img src={newEquipPhotoUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '2px solid #059669' }} />
                    <button type="button" onClick={() => setNewEquipPhotoUrl('')} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button 
                  type="submit" 
                  className="btn-entrada" 
                  style={{ flex: 1, justifyContent: 'center', background: '#059669' }}
                  disabled={newEquipLoading}
                >
                  {newEquipLoading ? 'Guardando...' : 'Guardar en Inventario Maestro'}
                </button>
                <button 
                  type="button" 
                  className="logout-btn" 
                  style={{ flex: '0.4', justifyContent: 'center' }}
                  onClick={() => setShowAddEquipModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


