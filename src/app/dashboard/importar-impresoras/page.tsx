"use client";
import React, { useState } from 'react';
import { collection, getDocs, query, where, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function FixImpresorasPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const addStatus = (msg: string) => {
    setStatus(prev => [...prev, msg]);
  };

  const fixImport = async () => {
    setLoading(true);
    setStatus([]);
    let deletedAsigC = 0, updatedPerC = 0;

    try {
      addStatus("Buscando las asignaciones incorrectas...");
      const qAsig = query(collection(db, 'asignaciones'), where('observaciones', '==', 'Importado de Excel de Impresoras'));
      const snapshot = await getDocs(qAsig);
      
      addStatus(`Se encontraron ${snapshot.size} asignaciones para corregir.`);

      for (const asigDoc of snapshot.docs) {
        const data = asigDoc.data();
        
        // Update persona
        if (data.personaId) {
          const personaRef = doc(db, 'personas', data.personaId);
          await updateDoc(personaRef, {
            printerBrandModel: data.equipoBrandModel || 'Impresora',
            printerSerial: data.equipoAssetCode || ''
          });
          updatedPerC++;
          addStatus(`Persona ${data.personaName} actualizada con impresora.`);
        }

        // Delete asignacion
        await deleteDoc(doc(db, 'asignaciones', asigDoc.id));
        deletedAsigC++;
        addStatus(`Asignación de impresora eliminada para ${data.personaName}.`);
      }

      addStatus(`Completado. Personas actualizadas: ${updatedPerC}. Asignaciones eliminadas: ${deletedAsigC}. (Los equipos/impresoras se mantuvieron en el inventario)`);
      setDone(true);
    } catch (err: any) {
      addStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Corregir Asignaciones de Impresoras</h1>
      <p className="mb-4">Este script moverá las impresoras a la sección de "Otras herramientas tecnológicas" de cada persona y eliminará el acta de asignación independiente.</p>
      
      {!done && (
        <button 
          onClick={fixImport} 
          disabled={loading}
          className="bg-orange-600 text-white px-4 py-2 rounded mb-4"
        >
          {loading ? 'Corrigiendo...' : 'Corregir Importación'}
        </button>
      )}

      {done && (
        <Link href="/dashboard/asignaciones" className="bg-green-600 text-white px-4 py-2 rounded mb-4 inline-block">
          Volver a Asignaciones
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
