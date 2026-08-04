"use client";
import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { QRCodeSVG } from 'qrcode.react';
import './equipos.css';

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
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form State
  const [assetCode, setAssetCode] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [equipmentType, setEquipmentType] = useState('Portátil');
  const [brandModel, setBrandModel] = useState('');
  const [ownership, setOwnership] = useState('Propio de la empresa');
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'equipos'), orderBy('assetCode', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const equipData: Equipment[] = [];
      snapshot.forEach((doc) => {
        equipData.push({ id: doc.id, ...doc.data() } as Equipment);
      });
      setEquipments(equipData);
    });
    return () => unsubscribe();
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

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetCode.trim() || !serialNumber.trim() || !brandModel.trim()) {
      alert('Por favor complete los campos obligatorios.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'equipos'), {
        assetCode,
        serialNumber,
        equipmentType,
        brandModel,
        ownership,
        photoUrl: photoUrl || '',
        status: 'Dentro',
        createdAt: serverTimestamp()
      });
      
      setAssetCode('');
      setSerialNumber('');
      setEquipmentType('Portátil');
      setBrandModel('');
      setOwnership('Propio de la empresa');
      setPhotoUrl('');
      setShowAddModal(false);
    } catch (error: any) {
      console.error("Error adding equipment: ", error);
      alert("Hubo un error al guardar el equipo: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintQR = () => {
    window.print();
  };

  return (
    <div className="equipos-container">
      <div className="equipos-card">
        <div className="header-with-action">
          <h2><i className="fa-solid fa-server"></i> Inventario de Equipos</h2>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <i className="fa-solid fa-plus"></i> Nuevo Equipo
          </button>
        </div>
        <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>
          Base de datos maestra de ControlTech. Aquí puedes gestionar todos los activos tecnológicos, adjuntar fotografías, generar sus códigos QR y ver su estado actual.
        </p>
        
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
              {equipments.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    No hay equipos registrados en la base de datos.
                  </td>
                </tr>
              ) : (
                equipments.map((equip) => (
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
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>SN: {equip.serialNumber}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '12px', padding: '4px 8px', borderRadius: '4px', fontWeight: '600',
                        backgroundColor: equip.status === 'Fuera' ? '#fee2e2' : (equip.status === 'Mantenimiento' ? '#fef3c7' : '#d1fae5'),
                        color: equip.status === 'Fuera' ? '#991b1b' : (equip.status === 'Mantenimiento' ? '#92400e' : '#065f46')
                      }}>
                        {equip.status || 'Dentro'}
                      </span>
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
                    <td>
                      <button className="btn-qr" onClick={() => setSelectedQR(equip)}>
                        <i className="fa-solid fa-qrcode"></i> Ver QR
                      </button>
                    </td>
                  </tr>
                ))
              )}
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
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Marca y Modelo *</label>
                <input type="text" value={brandModel} onChange={e => setBrandModel(e.target.value)} placeholder="Ej: Lenovo ThinkPad T14" required />
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

      {/* QR Code Modal */}
      {selectedQR && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h3>Etiqueta QR <button className="close-btn" onClick={() => setSelectedQR(null)}>&times;</button></h3>
            <div className="qr-container">
              {selectedQR.photoUrl && (
                <div style={{ marginBottom: '12px' }}>
                  <img src={selectedQR.photoUrl} alt="Foto equipo" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '12px', border: '2px solid #e5e7eb' }} />
                </div>
              )}
              <div className="qr-code">
                <QRCodeSVG value={selectedQR.assetCode || selectedQR.serialNumber} size={200} />
              </div>
              <div className="qr-info">
                <h4>{selectedQR.assetCode}</h4>
                <p>{selectedQR.brandModel}</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>SN: {selectedQR.serialNumber}</p>
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
    </div>
  );
}
