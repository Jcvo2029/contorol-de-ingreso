"use client";
import React, { useEffect, useState, useRef } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import SignatureCanvas from 'react-signature-canvas';
import Image from 'next/image';
import Link from 'next/link';
import './acta.css';

export default function ActaPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;
  
  const formatText = (str: string) => str ? str.toLowerCase() : '';

  
  const [asignacion, setAsignacion] = useState<any>(null);
  const [persona, setPersona] = useState<any>(null);
  const [equipo, setEquipo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [signingRole, setSigningRole] = useState<'colaborador' | 'entrega' | 'gerencia' | null>(null);
  const [signatureError, setSignatureError] = useState('');
  const [savingSignature, setSavingSignature] = useState(false);
  const sigCanvas = useRef<any>(null);

  // Observaciones de devolución
  const [observacionesDevolucion, setObservacionesDevolucion] = useState('');
  const [savingObs, setSavingObs] = useState(false);

  // Toggle between 'entrega' and 'devolucion' views when estado is Devuelto
  const [viewMode, setViewMode] = useState<'entrega' | 'devolucion'>('devolucion');

  const handleOpenModal = async (role: 'colaborador' | 'entrega' | 'gerencia') => {
    setSigningRole(role);
    setIsModalOpen(true);
    
    if (window.innerWidth <= 768) {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        if (window.screen && window.screen.orientation && (window.screen.orientation as any).lock) {
          await (window.screen.orientation as any).lock('landscape');
        }
      } catch (err) {
        console.warn('Orientation lock failed or not supported:', err);
      }
    }
  };

  const handleCloseModal = async () => {
    setIsModalOpen(false);
    setSigningRole(null);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn(err);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }

    const fetchData = async () => {
      try {
        // Fetch Asignacion
        const asigDoc = await getDoc(doc(db, 'asignaciones', id));
        if (asigDoc.exists()) {
          const asigData = asigDoc.data();
          setAsignacion(asigData);

          // Fetch Persona details
          if (asigData.personaId) {
            const persDoc = await getDoc(doc(db, 'personas', asigData.personaId));
            if (persDoc.exists()) setPersona(persDoc.data());
          }

          // Fetch Equipo details
          if (asigData.equipoId) {
            const equiDoc = await getDoc(doc(db, 'equipos', asigData.equipoId));
            if (equiDoc.exists()) setEquipo(equiDoc.data());
          }
        }
      } catch (error) {
        console.error("Error cargando acta:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '---';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleSaveSignature = async () => {
    if (sigCanvas.current?.isEmpty()) {
      setSignatureError('Por favor, dibuje su firma antes de guardar.');
      return;
    }
    if (!signingRole) return;
    
    setSignatureError('');
    setSavingSignature(true);
    
    try {
      const dataURL = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
      
      const fieldName = signingRole === 'colaborador' ? 'firmaColaborador' : 
                        signingRole === 'entrega' ? 'firmaEntrega' : 'firmaGerencia';
      
      await updateDoc(doc(db, 'asignaciones', id), {
        [fieldName]: dataURL,
        [`fechaFirma_${signingRole}`]: serverTimestamp()
      });
      
      setAsignacion({ ...asignacion, [fieldName]: dataURL });
      await handleCloseModal();
    } catch (error) {
      console.error("Error guardando firma:", error);
      setSignatureError('Error al guardar la firma. Intente de nuevo.');
    } finally {
      setSavingSignature(false);
    }
  };

  const handleClearSignature = () => {
    sigCanvas.current?.clear();
    setSignatureError('');
  };

  const handleDeleteSignature = async (role: 'colaborador' | 'entrega' | 'gerencia') => {
    if (!confirm('¿Está seguro de que desea borrar esta firma?')) return;
    
    try {
      const fieldName = role === 'colaborador' ? 'firmaColaborador' : 
                        role === 'entrega' ? 'firmaEntrega' : 'firmaGerencia';
      
      const dateFieldName = `fechaFirma_${role}`;
      
      const updates = {
        [fieldName]: null,
        [dateFieldName]: null
      };
      
      await updateDoc(doc(db, 'asignaciones', id), updates);
      
      setAsignacion({ ...asignacion, [fieldName]: null, [dateFieldName]: null });
    } catch (error) {
      console.error("Error borrando firma:", error);
      alert('Error al borrar la firma.');
    }
  };

  const handleSaveObservaciones = async () => {
    setSavingObs(true);
    try {
      await updateDoc(doc(db, 'asignaciones', id), {
        observacionesDevolucion: observacionesDevolucion.trim()
      });
      setAsignacion({ ...asignacion, observacionesDevolucion: observacionesDevolucion.trim() });
    } catch (e) {
      console.error(e);
    } finally {
      setSavingObs(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando documento...</div>;
  if (!asignacion) return <div style={{ padding: '40px', textAlign: 'center' }}>No se encontró el acta de asignación.</div>;

  return (
    <div className="print-wrapper" style={{ padding: '20px' }}>
      <div className="acta-actions">
        <div style={{ display: 'flex', gap: '15px' }}>
          <Link href="/dashboard/asignaciones" className="btn-volver">
            <i className="fa-solid fa-arrow-left"></i> Volver a Asignaciones
          </Link>
          <button onClick={() => window.print()} className="btn-imprimir">
            <i className="fa-solid fa-print"></i> Imprimir Acta
          </button>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!asignacion.firmaEntrega && (
            <button onClick={() => handleOpenModal('entrega')} className="btn-firmar">
              <i className="fa-solid fa-pen-nib"></i> Firmar (Entrega)
            </button>
          )}
          {!asignacion.firmaColaborador && (
            <button onClick={() => handleOpenModal('colaborador')} className="btn-firmar">
              <i className="fa-solid fa-pen-nib"></i> Firmar (Colaborador)
            </button>
          )}
          {!asignacion.firmaGerencia && (
            <button onClick={() => handleOpenModal('gerencia')} className="btn-firmar">
              <i className="fa-solid fa-pen-nib"></i> Firmar (Gerencia)
            </button>
          )}
        </div>
      </div>

      {/* Toggle view when devuelto */}
      {asignacion.estado === 'Devuelto' && (
        <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
          <button
            onClick={() => setViewMode('entrega')}
            style={{
              padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600',
              background: viewMode === 'entrega' ? '#4f46e5' : 'white',
              color: viewMode === 'entrega' ? 'white' : '#374151',
              border: '1px solid #d1d5db'
            }}
          >
            <i className="fa-solid fa-file-arrow-down"></i> Acta de Entrega Original
          </button>
          <button
            onClick={() => setViewMode('devolucion')}
            style={{
              padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600',
              background: viewMode === 'devolucion' ? '#10b981' : 'white',
              color: viewMode === 'devolucion' ? 'white' : '#374151',
              border: '1px solid #d1d5db'
            }}
          >
            <i className="fa-solid fa-file-circle-check"></i> Acta de Devolución / Paz y Salvo
          </button>
        </div>
      )}

      <div className="acta-container">
        <div className="acta-header">
          <div className="acta-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <img 
              src="/img/logo-contexsas.png?v=2" 
              alt="Logo Empresa"
              style={{ width: '150px', height: 'auto', objectFit: 'contain' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <div className="acta-header-info">
            <p><strong>Fecha Asignación:</strong> {formatDate(asignacion.fechaAsignacion)}</p>
            {viewMode === 'devolucion' && asignacion.estado === 'Devuelto' && asignacion.fechaDevolucion && (
              <p style={{ marginTop: '5px' }}><strong>Fecha Devolución:</strong> {formatDate(asignacion.fechaDevolucion)}</p>
            )}
          </div>
        </div>

        <div className="acta-title">
          <h1>{viewMode === 'devolucion' && asignacion.estado === 'Devuelto' ? 'ACTA DE DEVOLUCIÓN DE EQUIPO' : 'ACTA DE ENTREGA Y COMPROMISO DE EQUIPO'}</h1>
        </div>

        <div className="acta-section">
          <h3>Datos del Colaborador</h3>
          <div className="acta-grid">
            <div className="acta-item">
              <span className="acta-label">Nombre Completo</span>
              <span className="acta-value">{persona?.name || asignacion.personaName}</span>
            </div>
            <div className="acta-item">
              <span className="acta-label">Documento de Identidad</span>
              <span className="acta-value">{persona?.idNumber || 'No registrado'}</span>
            </div>
            <div className="acta-item">
              <span className="acta-label">Área o Departamento</span>
              <span className="acta-value">{persona?.area || 'No registrado'}</span>
            </div>
            <div className="acta-item">
              <span className="acta-label">Correo Corporativo / Contacto</span>
              <span className="acta-value">{persona?.email || 'No registrado'}</span>
            </div>
          </div>
        </div>

        <div className="acta-section">
          <h3>Datos del Equipo Asignado</h3>
          <div className="table-responsive">
            <table className="equipo-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>Tipo de Equipo</th>
                  <th style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>Marca</th>
                  <th style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>Modelo</th>
                  <th style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>Número de Serie</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937', textTransform: 'capitalize' }}>{formatText(equipo?.equipmentType) || 'No registrado'}</td>
                  <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937', textTransform: 'capitalize' }}>{formatText((equipo?.brandModel || asignacion.equipoBrandModel || '').split(' ')[0]) || 'No registrado'}</td>
                  <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937', textTransform: 'capitalize' }}>{formatText((equipo?.brandModel || asignacion.equipoBrandModel || '').split(' ').slice(1).join(' ')) || 'No registrado'}</td>
                  <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>{equipo?.serialNumber || 'No registrado'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {(persona?.office365Email || persona?.office365License || persona?.domainUser || persona?.siesaUser || persona?.office365Key || persona?.printerBrandModel) && (
          <div className="acta-section">
            <h3>Herramientas Tecnológicas Asignadas</h3>
            <div className="table-responsive">
              <table className="herramientas-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                    <th style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>Descripción / Herramienta</th>
                    <th style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>Usuario / Detalle</th>
                    <th style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>Sistema / Tipo</th>
                    <th style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>Llave / Serial</th>
                  </tr>
                </thead>
                <tbody>
                {persona?.office365License && (
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937', textTransform: 'capitalize' }}>{formatText(persona.office365License)}</td>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>{formatText(persona.office365Email) || '---'}</td>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>Office 365</td>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937', fontFamily: 'monospace' }}>{persona.office365Key || 'N/A'}</td>
                  </tr>
                )}
                {persona?.domainUser && (
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>Acceso al Dominio</td>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>{formatText(persona.domainUser)}</td>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>Red Local</td>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>N/A</td>
                  </tr>
                )}
                {persona?.siesaUser && (
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>Acceso ERP SIESA</td>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>{formatText(persona.siesaUser)}</td>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>SIESA</td>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>N/A</td>
                  </tr>
                )}
                {persona?.printerBrandModel && (
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>Impresora Asignada</td>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937', textTransform: 'capitalize' }}>{formatText(persona.printerBrandModel)}</td>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>Hardware</td>
                    <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937', textTransform: 'uppercase' }}>{persona.printerSerial || 'N/A'}</td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {asignacion.observaciones && (
          <div className="acta-section">
            <h3>Observaciones del Estado</h3>
            <p style={{ marginTop: '5px' }}>{asignacion.observaciones}</p>
          </div>
        )}

        <div className="acta-legal-text">
          {viewMode === 'devolucion' && asignacion.estado === 'Devuelto' ? (
            <>
              <p>
                Por medio del presente documento, <strong>{persona?.name || asignacion.personaName}</strong>, identificado(a) con 
                C.C. <strong>{persona?.idNumber || ''}</strong>, hace entrega formal del equipo y de las herramientas tecnológicas 
                descritas anteriormente a la empresa <strong> CONTEX S.A.S.</strong>, en las condiciones especificadas, dando por 
                terminada la responsabilidad sobre dichos activos a partir de la fecha de devolución indicada.
              </p>
              <br />
              <p><strong>Estado en que se devuelve el equipo:</strong></p>
              {asignacion.observacionesDevolucion ? (
                <div style={{ marginTop: '10px', padding: '12px 15px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                  <p>{asignacion.observacionesDevolucion}</p>
                </div>
              ) : (
                <div className="no-print" style={{ marginTop: '10px' }}>
                  <textarea
                    value={observacionesDevolucion}
                    onChange={(e) => setObservacionesDevolucion(e.target.value)}
                    placeholder="Describa el estado en que se recibe el equipo (daños, faltantes, buen estado, etc.)"
                    rows={4}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <button
                    onClick={handleSaveObservaciones}
                    disabled={savingObs || !observacionesDevolucion.trim()}
                    style={{ marginTop: '8px', padding: '8px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                  >
                    {savingObs ? 'Guardando...' : 'Guardar Observaciones'}
                  </button>
                  <p style={{ marginTop: '8px', color: '#6b7280', fontSize: '12px' }}>Las observaciones son opcionales. Si no hay observaciones relevantes, puede proceder a firmar directamente.</p>
                </div>
              )}
              {asignacion.observacionesDevolucion && (
                <button
                  className="no-print"
                  onClick={() => { setAsignacion({ ...asignacion, observacionesDevolucion: null }); setObservacionesDevolucion(''); }}
                  style={{ marginTop: '5px', fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Editar observaciones
                </button>
              )}
            </>
          ) : (
            <>
              <p>
                Por medio del presente documento, hago constar que he recibido por parte de la empresa el equipo informático 
                y las herramientas tecnológicas descritas anteriormente, los cuales me son asignados en perfectas condiciones de 
                funcionamiento (salvo las observaciones especificadas) y estrictamente para uso como <strong>herramienta de trabajo</strong> 
                en el cumplimiento de mis labores asignadas.
              </p>
              <br />
              <p><strong>Me comprometo a:</strong></p>
              <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
                <li>Darle un uso adecuado y exclusivo para actividades relacionadas con la empresa.</li>
                <li>No instalar software pirata, malicioso o no autorizado por el departamento de tecnología.</li>
                <li>Responder económicamente por la pérdida, robo o daños ocasionados por el mal uso, negligencia o descuido del equipo.</li>
                <li>Devolver el equipo inmediatamente al cese de mis funciones o cuando la empresa lo requiera, en las mismas condiciones en que fue entregado, salvo el deterioro por desgaste natural.</li>
              </ul>
            </>
          )}
        </div>

        <div className="acta-firmas">
          <div className="firma-box">
            {asignacion.firmaEntrega && (
              <div style={{ textAlign: 'center', marginBottom: '5px', position: 'relative' }}>
                <img src={asignacion.firmaEntrega} alt="Firma Entrega" style={{ maxHeight: '70px', maxWidth: '100%', display: 'inline-block' }} />
                <button onClick={() => handleDeleteSignature('entrega')} className="btn-delete-signature no-print" title="Borrar firma">
                  <i className="fa-solid fa-trash"></i>
                </button>
              </div>
            )}
            <div className="firma-line" style={asignacion.firmaEntrega ? { marginTop: '5px' } : {}}>
              <p><strong>{viewMode === 'devolucion' && asignacion.estado === 'Devuelto' ? 'Recibido conforme por:' : 'Entregado por:'}</strong></p>
              <p>{currentUser?.name || '___________________________'}</p>
              <p>C.C. {currentUser?.cedula || '___________'}</p>
            </div>
          </div>
          <div className="firma-box">
            {asignacion.firmaColaborador && (
              <div style={{ textAlign: 'center', marginBottom: '5px', position: 'relative' }}>
                <img src={asignacion.firmaColaborador} alt="Firma Colaborador" style={{ maxHeight: '70px', maxWidth: '100%', display: 'inline-block' }} />
                <button onClick={() => handleDeleteSignature('colaborador')} className="btn-delete-signature no-print" title="Borrar firma">
                  <i className="fa-solid fa-trash"></i>
                </button>
              </div>
            )}
            <div className="firma-line" style={asignacion.firmaColaborador ? { marginTop: '5px' } : {}}>
              <p><strong>{viewMode === 'devolucion' && asignacion.estado === 'Devuelto' ? 'Entregado por el Colaborador:' : 'Recibido y Aceptado por:'}</strong></p>
              <p>{persona?.name || asignacion.personaName}</p>
              <p>C.C. {persona?.idNumber || ''}</p>
            </div>
          </div>
          <div className="firma-box">
            {asignacion.firmaGerencia && (
              <div style={{ textAlign: 'center', marginBottom: '5px', position: 'relative' }}>
                <img src={asignacion.firmaGerencia} alt="Firma Gerencia" style={{ maxHeight: '70px', maxWidth: '100%', display: 'inline-block' }} />
                <button onClick={() => handleDeleteSignature('gerencia')} className="btn-delete-signature no-print" title="Borrar firma">
                  <i className="fa-solid fa-trash"></i>
                </button>
              </div>
            )}
            <div className="firma-line" style={asignacion.firmaGerencia ? { marginTop: '5px' } : {}}>
              <p><strong>Autorizado por:</strong></p>
              <p>Joussette Abudinen</p>
              <p>Gerencia</p>
            </div>
          </div>
        </div>

      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content signature-modal">
            <h3>
              {signingRole === 'colaborador' ? 'Firma del Colaborador' : 
               signingRole === 'entrega' ? 'Firma de Entrega' : 'Firma de Gerencia'}
            </h3>
            <p style={{ marginBottom: '15px', color: '#4b5563', fontSize: '0.9rem' }}>Por favor, firme en el recuadro blanco usando su dedo o el mouse.</p>
            
            <div className="signature-container">
              <SignatureCanvas 
                ref={sigCanvas} 
                penColor="black"
                canvasProps={{ className: 'sigCanvas' }} 
              />
            </div>
            
            {signatureError && <p style={{ color: '#ef4444', marginTop: '10px', fontSize: '0.9rem' }}>{signatureError}</p>}
            
            <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={handleCloseModal} className="btn-cancelar" disabled={savingSignature}>Cancelar</button>
              <button onClick={handleClearSignature} className="btn-limpiar" disabled={savingSignature}>Limpiar</button>
              <button onClick={handleSaveSignature} className="btn-save" disabled={savingSignature}>
                {savingSignature ? 'Guardando...' : 'Guardar Firma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
