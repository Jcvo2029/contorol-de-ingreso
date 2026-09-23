"use client";
import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando documento...</div>;
  if (!asignacion) return <div style={{ padding: '40px', textAlign: 'center' }}>No se encontró el acta de asignación.</div>;

  return (
    <div style={{ padding: '20px' }}>
      <div className="acta-actions">
        <Link href="/dashboard/asignaciones" className="btn-volver">
          <i className="fa-solid fa-arrow-left"></i> Volver a Asignaciones
        </Link>
        <button onClick={() => window.print()} className="btn-imprimir">
          <i className="fa-solid fa-print"></i> Imprimir Acta
        </button>
      </div>

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
            <p><strong>Fecha:</strong> {formatDate(asignacion.fechaAsignacion)}</p>
          </div>
        </div>

        <div className="acta-title">
          <h1>ACTA DE ENTREGA Y COMPROMISO DE EQUIPO</h1>
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

        {(persona?.office365Email || persona?.office365License || persona?.domainUser || persona?.siesaUser || persona?.office365Key || persona?.printerBrandModel) && (
          <div className="acta-section">
            <h3>Herramientas Tecnológicas Asignadas</h3>
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
        )}

        {asignacion.observaciones && (
          <div className="acta-section">
            <h3>Observaciones del Estado</h3>
            <p style={{ marginTop: '5px' }}>{asignacion.observaciones}</p>
          </div>
        )}

        <div className="acta-legal-text">
          <p>
            Por medio del presente documento, hago constar que he recibido por parte de la empresa el equipo 
            informático descrito anteriormente, el cual me es asignado en perfectas condiciones de funcionamiento 
            (salvo las observaciones especificadas) y estrictamente para uso como <strong>herramienta de trabajo</strong> 
            en el cumplimiento de mis labores asignadas.
          </p>
          <br />
          <p>
            <strong>Me comprometo a:</strong>
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
            <li>Darle un uso adecuado y exclusivo para actividades relacionadas con la empresa.</li>
            <li>No instalar software pirata, malicioso o no autorizado por el departamento de tecnología.</li>
            <li>Responder económicamente por la pérdida, robo o daños ocasionados por el mal uso, negligencia o descuido del equipo.</li>
            <li>Devolver el equipo inmediatamente al cese de mis funciones o cuando la empresa lo requiera, en las mismas condiciones en que fue entregado, salvo el deterioro por desgaste natural.</li>
          </ul>
        </div>

        <div className="acta-firmas">
          <div className="firma-box">
            <div className="firma-line">
              <p><strong>Entregado por:</strong></p>
              <p>{currentUser?.name || '___________________________'}</p>
              <p>C.C. {currentUser?.cedula || '___________'}</p>
            </div>
          </div>
          <div className="firma-box">
            <div className="firma-line">
              <p><strong>Recibido y Aceptado por:</strong></p>
              <p>{persona?.name || asignacion.personaName}</p>
              <p>C.C. {persona?.idNumber || ''}</p>
            </div>
          </div>
          <div className="firma-box">
            <div className="firma-line">
              <p><strong>Autorizado por:</strong></p>
              <p>Joussette Abudinen</p>
              <p>Gerencia</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
