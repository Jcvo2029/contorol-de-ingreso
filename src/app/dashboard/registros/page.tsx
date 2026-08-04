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

export default function RegistrosPage() {
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  
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

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const scannerStarted = useRef(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }

    // Subscribe to registries
    const qReg = query(collection(db, 'registros'), orderBy('timestamp', 'desc'), limit(50));
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
      setAssetCode(''); // Clear it so it gets auto-generated
    }
  };

  // QR Scanning Logic — step 1: just show the modal
  const startScanner = () => {
    scannerStarted.current = false;
    setIsScanning(true);
  };

  // Step 2: once the modal (and #qr-reader div) is in the DOM, start the camera
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
    setAssetCode(decodedText);

    // Autofill by Asset Code
    const found = equipments.find(eq => eq.assetCode.toLowerCase() === decodedText.toLowerCase());
    if (found) {
      setSerialNumber(found.serialNumber || '');
      setEquipmentType(found.equipmentType || 'Portátil');
      setBrandModel(found.brandModel || '');
      setOwnership(found.ownership || 'Propio de la empresa');
    } else {
      // It's a new Asset Code (maybe a pre-printed label)
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
      // 1. Check if equipment exists in master DB
      let finalAssetCode = assetCode;
      
      // Auto-generate Asset Code if empty
      if (!finalAssetCode.trim()) {
        finalAssetCode = `ACT-${Math.floor(100000 + Math.random() * 900000)}`;
      }
      
      let foundEq = equipments.find(eq => eq.assetCode.toLowerCase() === finalAssetCode.toLowerCase() || eq.serialNumber.toLowerCase() === serialNumber.toLowerCase());
      
      const newStatus = type === 'Entrada' ? 'Dentro' : 'Fuera';

      if (foundEq) {
        // Update existing equipment status
        await updateDoc(doc(db, 'equipos', foundEq.id), {
          status: newStatus,
          assetCode: finalAssetCode // in case it was mapped by serial but assetCode was empty
        });
        finalAssetCode = foundEq.assetCode || finalAssetCode;
      } else {
        // Create new equipment on the fly
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

      // 2. Save the registry log
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
      
      // Clear form
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
      
    } catch (error: any) {
      console.error("Error adding document: ", error);
      alert('Hubo un error al guardar el registro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '...';
    const date = timestamp.toDate();
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '...';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="registros-container">
      {/* Scanner Modal */}
      {isScanning && (
        <div className="scanner-modal-overlay">
          <div className="scanner-modal">
            <h3><i className="fa-solid fa-qrcode"></i> Escanear Código QR</h3>
            <p>Apunta la cámara al código QR del equipo</p>
            <div id="qr-reader" style={{ width: '100%', maxWidth: '400px', margin: '0 auto', overflow: 'hidden', borderRadius: '12px' }}></div>
            <button className="btn-cancel-scan" onClick={stopScanner}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="registry-form-card">
        <h2><i className="fa-solid fa-laptop"></i> Registro de Equipos</h2>
        
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
          <button type="button" className="btn-scan-qr" onClick={startScanner}>
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
        </div>
      </div>

      <div className="registry-list-card">
        <h2><i className="fa-solid fa-list-check"></i> Últimos Movimientos</h2>
        
        <div className="table-responsive">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Persona / Responsable</th>
                <th>Equipo / Código</th>
                <th>Tipo / Motivo</th>
                <th>Fecha / Hora</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {registries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    No hay registros de entradas o salidas el día de hoy.
                  </td>
                </tr>
              ) : (
                registries.map((reg) => (
                  <tr key={reg.id}>
                    <td>
                      <strong>{reg.employeeName}</strong>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>ID: {reg.idNumber}</div>
                      <div style={{ fontSize: '12px', color: reg.visitorType === 'Empleado' ? '#059669' : '#d97706', fontWeight: '600' }}>
                        {reg.visitorType}
                      </div>
                      {reg.inChargeEmployee && <div style={{ fontSize: '11px', color: '#6b7280' }}>A cargo: {reg.inChargeEmployee}</div>}
                      {reg.area && <div style={{ fontSize: '11px', color: '#6b7280' }}>{reg.area}</div>}
                    </td>
                    <td>
                      <div>{reg.equipmentType} - {reg.brandModel}</div>
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '4px', marginRight: '6px' }}>Activo: {reg.assetCode}</span>
                        <span style={{ fontSize: '11px', background: '#f3f4f6', color: '#4b5563', padding: '2px 6px', borderRadius: '4px' }}>SN: {reg.serialNumber}</span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span className={`badge ${reg.type.toLowerCase()}`}>
                          {reg.type}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{reg.reason}</div>
                    </td>
                    <td>
                      <div>{formatDate(reg.timestamp)}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{formatTime(reg.timestamp)}</div>
                    </td>
                    <td style={{ fontSize: '12px', color: '#4b5563', maxWidth: '200px' }}>
                      <div style={{ marginBottom: '2px' }}><strong>Propiedad:</strong> {reg.ownership}</div>
                      <div><strong>Estado:</strong> {reg.equipmentState}</div>
                      {reg.notes && <div style={{ marginTop: '2px', fontStyle: 'italic' }}>"{reg.notes}"</div>}
                      <div style={{ marginTop: '4px', color: '#9ca3af' }}>Por: {reg.registeredBy}</div>
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
