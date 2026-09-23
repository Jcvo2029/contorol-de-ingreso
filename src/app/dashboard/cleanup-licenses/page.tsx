"use client";
import React, { useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function CleanupLicensesPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const handleCleanup = async () => {
    if (!confirm('Esto eliminará todas las licencias de Office 365 que estén registradas como Equipos. ¿Continuar?')) return;
    setLoading(true);
    setResults(['Iniciando limpieza...']);
    
    try {
      // 1. Encontrar equipos que son Office 365 (por el prefijo del assetCode o por la marca)
      const equiposRef = collection(db, 'equipos');
      // No podemos usar >= si no ordenamos, es mejor traer todos y filtrar en memoria si son pocos
      const querySnapshot = await getDocs(equiposRef);
      
      let equiposDeleted = 0;
      let asignacionesDeleted = 0;
      const equiposIds: string[] = [];

      for (const equipoDoc of querySnapshot.docs) {
        const data = equipoDoc.data();
        if ((data.brandModel && data.brandModel.toUpperCase().includes('OFFICE')) || 
            (data.assetCode && data.assetCode.toUpperCase().startsWith('O365'))) {
          equiposIds.push(equipoDoc.id);
          // Borrar el equipo
          await deleteDoc(doc(db, 'equipos', equipoDoc.id));
          equiposDeleted++;
        }
      }

      setResults(prev => [...prev, `Se eliminaron ${equiposDeleted} equipos (licencias falsas).`]);

      // 2. Borrar las asignaciones correspondientes
      if (equiposIds.length > 0) {
        const asignacionesRef = collection(db, 'asignaciones');
        const asigSnap = await getDocs(asignacionesRef);
        
        for (const asigDoc of asigSnap.docs) {
          if (equiposIds.includes(asigDoc.data().equipoId)) {
            await deleteDoc(doc(db, 'asignaciones', asigDoc.id));
            asignacionesDeleted++;
          }
        }
      }

      setResults(prev => [...prev, `Se eliminaron ${asignacionesDeleted} asignaciones huérfanas.`]);
      setResults(prev => [...prev, '¡Limpieza completada con éxito!']);

    } catch (error: any) {
      console.error(error);
      setResults(prev => [...prev, 'Error: ' + error.message]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px' }}>
      <h1>Limpieza de Licencias de Office 365 en Equipos</h1>
      <p>Este script eliminará los registros de la colección "equipos" que sean licencias de Office.</p>
      
      <button 
        onClick={handleCleanup} 
        disabled={loading}
        style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '20px' }}
      >
        {loading ? 'Ejecutando...' : 'Ejecutar Limpieza'}
      </button>

      <div style={{ marginTop: '30px', background: '#f3f4f6', padding: '20px', borderRadius: '8px' }}>
        <h3>Log de Resultados:</h3>
        {results.map((r, i) => <div key={i}>{r}</div>)}
      </div>
    </div>
  );
}
