"use client";
import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function ImportarPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string[]>([]);

  const addStatus = (msg: string) => {
    setStatus(prev => [...prev, msg]);
  };

  // Simple CSV parser that handles quoted strings
  const parseCSV = (text: string) => {
    const result: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            field += '"'; // Escaped quote
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          row.push(field);
          field = '';
        } else if (char === '\n' || char === '\r') {
          if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
            i++; // skip \n
          }
          row.push(field);
          result.push(row);
          row = [];
          field = '';
        } else {
          field += char;
        }
      }
    }
    
    if (field || row.length > 0) {
      row.push(field);
      result.push(row);
    }
    
    return result;
  };

  const procesarImportacion = async () => {
    setLoading(true);
    setStatus([]);
    try {
      addStatus('Obteniendo archivo CSV...');
      const response = await fetch('/temp_inventario_utf8.csv');
      const text = await response.text();
      
      addStatus('Parseando CSV...');
      const rows = parseCSV(text);
      
      // Encontrar los índices de las columnas
      let headerRow = -1;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        if (rows[i].some(c => c.trim().toUpperCase().includes('ASIGNADO'))) {
          headerRow = i;
          break;
        }
      }
      
      if (headerRow === -1) {
        throw new Error('No se encontraron los encabezados (ASIGNADO A, MARCA, etc.) en las primeras filas.');
      }
      
      const headers = rows[headerRow].map(h => h.trim().toUpperCase());
      
      const idxAsignado = headers.findIndex(h => h.includes('ASIGNADO'));
      const idxArea = headers.findIndex(h => h.includes('DEPARTAMENTO') || h.includes('AREA'));
      const idxTipo = headers.findIndex(h => h.includes('TIPO'));
      const idxMarca = headers.findIndex(h => h.includes('MARCA'));
      const idxModelo = headers.findIndex(h => h.includes('MODELO'));
      const idxSerial = headers.findIndex(h => h.includes('SERIAL'));
      const idxObs = headers.findIndex(h => h.includes('OBSERVACIONES'));
      
      const getAreaIdx = () => idxArea;
      
      let equiposCreados = 0;
      let personasCreadas = 0;
      let asignacionesCreadas = 0;
      
      for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < Math.max(idxMarca, idxModelo)) continue;
        
        const marca = row[idxMarca]?.trim() || '';
        const modelo = row[idxModelo]?.trim() || '';
        const serial = row[idxSerial]?.trim() || '';
        const tipo = row[idxTipo]?.trim() || '';
        const asignadoA = row[idxAsignado]?.trim() || '';
        const obs = row[idxObs]?.trim() || '';
        const area = (getAreaIdx() !== -1 ? row[getAreaIdx()]?.trim() : '') || '';
        
        if (!marca && !modelo && !serial) continue; // Fila vacía o inválida
        
        // 1. Crear Equipo
        const brandModel = `${marca} ${modelo}`.trim();
        const equipoData = {
          equipmentType: tipo || 'Otro',
          brandModel: brandModel || 'Desconocido',
          assetCode: serial || 'S/N ' + Date.now(), // Asignar un ID si no hay serial
          serialNumber: serial || '',
          location: 'Oficina',
          createdAt: serverTimestamp()
        };
        
        const docRefEquipo = await addDoc(collection(db, 'equipos'), equipoData);
        equiposCreados++;
        
        // 2. Si está asignado, buscar o crear persona
        if (asignadoA && asignadoA.toUpperCase() !== 'N/A' && asignadoA.toUpperCase() !== 'BODEGA') {
          // Check if person exists
          const qPers = query(collection(db, 'personas'), where('name', '==', asignadoA));
          const persSnapshot = await getDocs(qPers);
          
          let personaId = '';
          let personaName = asignadoA;
          
          if (persSnapshot.empty) {
            const docRefPers = await addDoc(collection(db, 'personas'), {
              name: asignadoA,
              idNumber: 'S/N ' + Date.now(),
              department: area || 'General',
              area: area || 'General',
              createdAt: serverTimestamp()
            });
            personaId = docRefPers.id;
            personasCreadas++;
          } else {
            personaId = persSnapshot.docs[0].id;
          }
          
          // 3. Crear Asignación
          await addDoc(collection(db, 'asignaciones'), {
            personaId: personaId,
            personaName: personaName,
            equipoId: docRefEquipo.id,
            equipoAssetCode: equipoData.assetCode,
            equipoBrandModel: equipoData.brandModel,
            fechaAsignacion: serverTimestamp(),
            fechaDevolucion: null,
            estado: 'Asignado',
            observaciones: obs
          });
          asignacionesCreadas++;
        }
      }
      
      addStatus(`¡Importación completada!`);
      addStatus(`- Equipos creados: ${equiposCreados}`);
      addStatus(`- Personas nuevas: ${personasCreadas}`);
      addStatus(`- Asignaciones creadas: ${asignacionesCreadas}`);
      
    } catch (error: any) {
      console.error(error);
      addStatus(`ERROR: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ background: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginBottom: '15px' }}><i className="fa-solid fa-file-import"></i> Importador de Inventario</h2>
        <p style={{ marginBottom: '25px', color: '#4b5563' }}>
          Esta página está diseñada para migrar los datos del Excel <code>INVENTARIO DE COMPUTADORES_HARDWARE.xlsx</code> a la base de datos de producción de Firebase.
          <br/><br/>
          Por favor, haz clic en el botón de abajo para procesar el CSV temporal. <strong>Esta operación no se puede deshacer.</strong>
        </p>
        
        <button 
          onClick={procesarImportacion} 
          disabled={loading}
          style={{ 
            padding: '12px 24px', 
            background: loading ? '#9ca3af' : '#2563eb', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '30px'
          }}
        >
          {loading ? 'Importando... Por favor espera' : 'Ejecutar Migración Ahora'}
        </button>

        {status.length > 0 && (
          <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
            <h3 style={{ marginBottom: '10px', fontSize: '1rem' }}>Log de Operaciones:</h3>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0, fontFamily: 'monospace', fontSize: '0.9rem' }}>
              {status.map((msg, i) => (
                <li key={i} style={{ marginBottom: '5px', color: msg.startsWith('ERROR') ? '#dc2626' : '#1f2937' }}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div style={{ marginTop: '30px' }}>
          <Link href="/dashboard/equipos" style={{ color: '#2563eb', textDecoration: 'none' }}>&larr; Volver a Equipos</Link>
        </div>
      </div>
    </div>
  );
}
