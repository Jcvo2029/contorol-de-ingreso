"use client";
import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function ImportarCorreosPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string[]>([]);

  const addStatus = (msg: string) => {
    setStatus(prev => [...prev, msg]);
  };

  // Función para convertir a Título (Ej: JUAN PEREZ -> Juan Perez)
  const toTitleCase = (str: string) => {
    return str.toLowerCase().split(' ').map(word => {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
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
            field += '"';
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
            i++;
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
      addStatus('Obteniendo archivo CSV de correos...');
      const response = await fetch('/temp_correos_utf8.csv');
      const text = await response.text();
      
      addStatus('Parseando CSV...');
      const rows = parseCSV(text);
      
      let headerRow = -1;
      for (let i = 0; i < Math.min(20, rows.length); i++) {
        if (rows[i].some(c => c.trim().toUpperCase().includes('CUENTA DE CORREO') || c.trim().toUpperCase().includes('ASIGNADO A'))) {
          headerRow = i;
          break;
        }
      }
      
      if (headerRow === -1) {
        throw new Error('No se encontraron los encabezados (CUENTA DE CORREO, ASIGNADO A, etc.)');
      }
      
      const headers = rows[headerRow].map(h => h.trim().toUpperCase());
      
      const idxAsignado = headers.findIndex(h => h.includes('ASIGNADO'));
      const idxCorreo = headers.findIndex(h => h.includes('CUENTA') || h.includes('CORREO'));
      const idxSeccion = headers.findIndex(h => h.includes('SECCION') || h.includes('SECCIÓN'));
      const idxOperacion = headers.findIndex(h => h.includes('OPERACI'));
      
      if (idxAsignado === -1 || idxCorreo === -1) {
        throw new Error('Faltan columnas clave como ASIGNADO A o CUENTA DE CORREO.');
      }
      
      // Descargar todas las personas actuales para comparar (insensible a mayúsculas)
      const qPers = query(collection(db, 'personas'));
      const persSnapshot = await getDocs(qPers);
      const personasExistentes = persSnapshot.docs.map(d => ({
        id: d.id,
        name: d.data().name || '',
        nameLower: (d.data().name || '').toLowerCase()
      }));

      let actualizados = 0;
      let creados = 0;
      
      for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < Math.max(idxAsignado, idxCorreo)) continue;
        
        const rawName = row[idxAsignado]?.trim() || '';
        const rawEmail = row[idxCorreo]?.trim() || '';
        const rawSeccion = (idxSeccion !== -1 ? row[idxSeccion]?.trim() : '') || '';
        const rawOperacion = (idxOperacion !== -1 ? row[idxOperacion]?.trim() : '') || '';
        
        if (!rawName && !rawEmail) continue;
        if (!rawName && rawEmail) continue; // Si solo hay correo, es cuenta generica. Se podria obviar o asignar al dpto.

        // Limpieza de datos (Quitar mayúsculas)
        const cleanName = toTitleCase(rawName);
        const cleanEmail = rawEmail.toLowerCase();
        let area = toTitleCase(rawSeccion);
        if (!area && rawOperacion) area = toTitleCase(rawOperacion);

        // Buscar si la persona ya existe ignorando mayúsculas
        const existingPerson = personasExistentes.find(p => p.nameLower === cleanName.toLowerCase());
        
        if (existingPerson) {
          // Actualizar la persona existente
          await updateDoc(doc(db, 'personas', existingPerson.id), {
            name: cleanName, // Actualizar al nombre limpio
            email: cleanEmail,
            ...(area && { area: area }) // Solo si tiene area
          });
          actualizados++;
        } else {
          // Crear nueva persona
          await addDoc(collection(db, 'personas'), {
            name: cleanName,
            email: cleanEmail,
            area: area || 'General',
            idNumber: 'S/N ' + Date.now() + i, // Generar un placeholder
            department: area || 'General',
            createdAt: serverTimestamp()
          });
          creados++;
        }
      }
      
      addStatus(`¡Limpieza e importación completada!`);
      addStatus(`- Personas actualizadas (Nombre corregido y correo añadido): ${actualizados}`);
      addStatus(`- Personas nuevas creadas: ${creados}`);
      
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
        <h2 style={{ marginBottom: '15px' }}><i className="fa-solid fa-envelope-circle-check"></i> Importador de Correos (Limpieza)</h2>
        <p style={{ marginBottom: '25px', color: '#4b5563' }}>
          Esta página procesará el archivo <code>CORREOS CONTEXSAS.xlsx</code>. 
          Corregirá todos los textos en MAYÚSCULAS para que se vean presentables (formato Título), pasará los correos a minúsculas y actualizará los registros de las Personas.
          <br/><br/>
          <strong>Esta operación no se puede deshacer.</strong>
        </p>
        
        <button 
          onClick={procesarImportacion} 
          disabled={loading}
          style={{ 
            padding: '12px 24px', 
            background: loading ? '#9ca3af' : '#10b981', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '30px'
          }}
        >
          {loading ? 'Procesando... Por favor espera' : 'Limpiar e Importar Datos Ahora'}
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
          <Link href="/dashboard/personas" style={{ color: '#2563eb', textDecoration: 'none' }}>&larr; Volver a Personas</Link>
        </div>
      </div>
    </div>
  );
}
