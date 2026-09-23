"use client";
import React, { useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function AsignarImpresorasAreaPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const addStatus = (msg: string) => {
    setStatus(prev => [...prev, msg]);
  };

  const executeUpdate = async () => {
    setLoading(true);
    setStatus([]);
    let updatedCount = 0;

    try {
      addStatus("Obteniendo todas las personas...");
      const personasSnapshot = await getDocs(collection(db, 'personas'));
      const todasLasPersonas = personasSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      // Encontrar qué área tiene qué impresora
      const impresorasPorArea: Record<string, { brandModel: string, serial: string }> = {};
      
      for (const p of todasLasPersonas) {
        if (p.area && p.printerBrandModel) {
          const areaLower = p.area.trim().toLowerCase();
          if (!impresorasPorArea[areaLower]) {
            impresorasPorArea[areaLower] = {
              brandModel: p.printerBrandModel,
              serial: p.printerSerial || ''
            };
          }
        }
      }

      addStatus(`Se detectaron impresoras configuradas para las siguientes áreas: ${Object.keys(impresorasPorArea).join(', ')}`);

      // Aplicar la impresora a todas las personas del mismo área
      for (const p of todasLasPersonas) {
        if (!p.area) continue;
        
        const areaLower = p.area.trim().toLowerCase();
        const impresoraArea = impresorasPorArea[areaLower];
        
        if (impresoraArea) {
          // Si esta persona no tiene la misma impresora configurada, la actualizamos
          if (p.printerBrandModel !== impresoraArea.brandModel || p.printerSerial !== impresoraArea.serial) {
            const personaRef = doc(db, 'personas', p.id);
            await updateDoc(personaRef, {
              printerBrandModel: impresoraArea.brandModel,
              printerSerial: impresoraArea.serial
            });
            updatedCount++;
            addStatus(`Actualizada persona: ${p.name || 'Sin Nombre'} (${p.area}) con impresora ${impresoraArea.brandModel}`);
          }
        }
      }

      addStatus(`Completado. Se actualizaron ${updatedCount} perfiles de usuario.`);
      setDone(true);
    } catch (err: any) {
      addStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Asignar Impresoras por Área</h1>
      <p className="mb-4">Este script tomará la impresora de un usuario y se la asignará automáticamente a todos los demás usuarios que pertenezcan a la misma área o departamento.</p>
      
      {!done && (
        <button 
          onClick={executeUpdate} 
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
        >
          {loading ? 'Procesando...' : 'Aplicar Impresoras a toda el Área'}
        </button>
      )}

      {done && (
        <Link href="/dashboard/personas" className="bg-green-600 text-white px-4 py-2 rounded mb-4 inline-block">
          Volver a Personas
        </Link>
      )}

      <div className="mt-4 bg-gray-100 p-4 rounded h-64 overflow-y-auto">
        {status.map((msg, i) => (
          <div key={i} className="text-sm border-b py-1">{msg}</div>
        ))}
      </div>
    </div>
  );
}
