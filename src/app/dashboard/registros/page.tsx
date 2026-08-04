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
  
  // Movement fields
  const [equipmentState, setEquipmentState] = useState('Bueno');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

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
          assetCode: finalAssetCode
        });
        finalAssetCode = foundEq.assetCode || finalAssetCode;
      } else {
        await addDoc(collection(db, 'equipos'), {
          assetCode: finalAssetCode,
          serialNumber,
          equipmentType,
          brandModel,
          ownership,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1f2937' }}>
            <i className="fa-solid fa-clipboard-list" style={{ color: '#4f46e5', marginRight: '10px' }}></i>
            Control de Entradas y Salidas
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
            Gestiona los registros e ingresos de equipos en las instalaciones.
          </p>
        </div>

        <button 
          className="btn-toggle-form"
          onClick={() => setShowForm(!showForm)}
        >
          <i className={`fa-solid ${showForm ? 'fa-xmark' : 'fa-plus'}`}></i>
          {showForm ? 'Ocultar Formulario' : 'Nuevo Registro / Ingreso'}
        </button>
      </div>

      {/* Registration Form (Collapsible) */}
      {showForm && (
        <div className="registry-form-card">
          <h2><i className="fa-solid fa-laptop"></i> Formulario de Registro de Equipos</h2>
          
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
                <th>Equipo / Código</th>
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
                      <div>{group.equipmentType} - {group.brandModel}</div>
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '4px', marginRight: '6px' }}>Activo: {group.assetCode}</span>
                        <span style={{ fontSize: '11px', background: '#f3f4f6', color: '#4b5563', padding: '2px 6px', borderRadius: '4px' }}>SN: {group.serialNumber}</span>
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
    </div>
  );
}


