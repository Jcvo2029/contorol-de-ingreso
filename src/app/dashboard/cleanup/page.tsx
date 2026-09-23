"use client";
import React, { useState } from 'react';
import { collection, getDocs, query, updateDoc, doc, deleteDoc, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import * as XLSX from 'xlsx';

interface PersonaData {
  id: string;
  name: string;
  email?: string;
  area?: string;
  createdAt?: any;
}

export default function CleanupPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string[]>([]);

  const addStatus = (msg: string) => {
    setStatus(prev => [...prev, msg]);
  };

  const procesarLimpieza = async () => {
    setLoading(true);
    setStatus([]);
    try {
      addStatus('Analizando base de datos de Personas...');

      const qPers = query(collection(db, 'personas'));
      const persSnapshot = await getDocs(qPers);

      const personas: PersonaData[] = persSnapshot.docs.map(d => ({
        id: d.id,
        name: d.data().name || '',
        email: d.data().email || '',
        area: d.data().area || '',
        createdAt: d.data().createdAt
      }));

      // Función para normalizar texto (quitar tildes y mayúsculas para comparar)
      const normalizeText = (text: string) => {
        return text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      };

      const toTitleCase = (str: string) => {
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      };

      // Agrupar por nombre (normalizado)
      const groups: Record<string, PersonaData[]> = {};

      personas.forEach(p => {
        const nameKey = normalizeText(p.name);
        if (!groups[nameKey]) groups[nameKey] = [];
        groups[nameKey].push(p);
      });

      let unificados = 0;
      let eliminados = 0;
      let asignacionesActualizadas = 0;

      for (const nameKey in groups) {
        const pList = groups[nameKey];
        if (pList.length > 1) {
          // Ordenar por fecha de creación (ascendente) para mantener el más antiguo como "master"
          pList.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
            return timeA - timeB;
          });

          const master = pList[0];
          const duplicates = pList.slice(1);

          addStatus(`Encontrados ${duplicates.length} duplicados para: ${master.name}`);

          // Recolectar todos los correos únicos
          const allEmails = new Set<string>();
          if (master.email) master.email.split(',').map(e => e.trim()).forEach(e => allEmails.add(e));

          duplicates.forEach(d => {
            if (d.email) d.email.split(',').map(e => e.trim()).forEach(e => allEmails.add(e));
          });

          const mergedEmails = Array.from(allEmails).filter(e => e).join(', ');

          // Actualizar el master con los correos unificados
          if (mergedEmails !== master.email) {
            await updateDoc(doc(db, 'personas', master.id), {
              email: mergedEmails
            });
            unificados++;
          }

          // Para cada duplicado, reasignar sus asignaciones y luego eliminar
          for (const d of duplicates) {
            // Buscar si tiene asignaciones
            const qAsig = query(collection(db, 'asignaciones'), where('personaId', '==', d.id));
            const asigSnapshot = await getDocs(qAsig);

            for (const asigDoc of asigSnapshot.docs) {
              await updateDoc(doc(db, 'asignaciones', asigDoc.id), {
                personaId: master.id,
                personaName: master.name
              });
              asignacionesActualizadas++;
            }

            // Eliminar el documento duplicado
            await deleteDoc(doc(db, 'personas', d.id));
            eliminados++;
          }
        }
      }

      addStatus(`¡Limpieza completada exitosamente!`);
      addStatus(`- Perfiles actualizados/unificados: ${unificados}`);
      addStatus(`- Perfiles duplicados eliminados: ${eliminados}`);
      addStatus(`- Asignaciones reubicadas: ${asignacionesActualizadas}`);

    } catch (error: any) {
      console.error(error);
      addStatus(`ERROR: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const estandarizarNombres = async () => {
    setLoading(true);
    setStatus([]);
    try {
      addStatus('Analizando base de datos para corregir MAYÚSCULAS...');
      const qPers = query(collection(db, 'personas'));
      const persSnapshot = await getDocs(qPers);

      const toTitleCase = (str: string) => {
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      };

      let actualizados = 0;
      let asignacionesActualizadas = 0;

      for (const d of persSnapshot.docs) {
        const currentName = d.data().name || '';
        if (!currentName) continue;

        const titleCaseName = toTitleCase(currentName.trim());

        if (titleCaseName !== currentName) {
          // El nombre estaba mal escrito, actualizamos
          await updateDoc(doc(db, 'personas', d.id), {
            name: titleCaseName
          });
          actualizados++;

          // Actualizar todas sus asignaciones para que reflejen el nuevo nombre
          const qAsig = query(collection(db, 'asignaciones'), where('personaId', '==', d.id));
          const asigSnapshot = await getDocs(qAsig);
          for (const asigDoc of asigSnapshot.docs) {
            await updateDoc(doc(db, 'asignaciones', asigDoc.id), {
              personaName: titleCaseName
            });
            asignacionesActualizadas++;
          }
        }
      }

      addStatus(`¡Nombres estandarizados exitosamente!`);
      addStatus(`- Personas corregidas a formato Título: ${actualizados}`);
      addStatus(`- Asignaciones actualizadas: ${asignacionesActualizadas}`);
    } catch (error: any) {
      console.error(error);
      addStatus(`ERROR: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const estandarizarAreas = async () => {
    setLoading(true);
    setStatus([]);
    try {
      addStatus('Analizando base de datos para corregir MAYÚSCULAS en áreas...');
      const qPers = query(collection(db, 'personas'));
      const persSnapshot = await getDocs(qPers);

      const toTitleCase = (str: string) => {
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      };

      let actualizados = 0;

      for (const d of persSnapshot.docs) {
        const currentArea = d.data().area || '';
        if (!currentArea) continue;

        const titleCaseArea = toTitleCase(currentArea.trim());

        if (titleCaseArea !== currentArea) {
          await updateDoc(doc(db, 'personas', d.id), {
            area: titleCaseArea
          });
          actualizados++;
        }
      }

      addStatus(`¡Áreas estandarizadas exitosamente!`);
      addStatus(`- Personas actualizadas a formato Título: ${actualizados}`);
    } catch (error: any) {
      console.error(error);
      addStatus(`ERROR: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const migrarCorreosAInventario = async () => {
    setLoading(true);
    setStatus([]);
    try {
      addStatus('Buscando correos en perfiles de personas...');
      const qPers = query(collection(db, 'personas'));
      const persSnapshot = await getDocs(qPers);

      let correosMigrados = 0;

      for (const d of persSnapshot.docs) {
        const p = d.data();
        if (p.email && p.email.trim() !== '' && !p.email.includes('[Inactivo]')) {
          const cleanEmail = p.email.trim();
          const assetCode = `MAIL-${d.id.substring(0, 5).toUpperCase()}`;

          // 1. Crear el equipo (Cuenta de Correo)
          const equipoRef = await addDoc(collection(db, 'equipos'), {
            assetCode: assetCode,
            serialNumber: 'N/A',
            equipmentType: 'Cuenta de Correo',
            brandModel: cleanEmail,
            ownership: 'Propio de la empresa',
            status: 'Dentro',
            createdAt: serverTimestamp()
          });

          // 2. Crear la asignación a la persona
          await addDoc(collection(db, 'asignaciones'), {
            personaId: d.id,
            personaName: p.name,
            equipoId: equipoRef.id,
            equipoAssetCode: assetCode,
            equipoBrandModel: cleanEmail,
            fechaAsignacion: serverTimestamp(),
            estado: 'Asignado'
          });

          correosMigrados++;
        }
      }

      addStatus(`¡Migración completada exitosamente!`);
      addStatus(`- Correos convertidos a equipos y asignados: ${correosMigrados}`);
      addStatus(`NOTA: Los correos originales se mantuvieron en los perfiles por seguridad.`);
    } catch (error: any) {
      console.error(error);
      addStatus(`ERROR: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const importarLicenciasOffice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus([]);
    addStatus(`Leyendo archivo Excel: ${file.name}...`);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json: any[] = XLSX.utils.sheet_to_json(worksheet);

          addStatus(`¡Excel leído! Encontradas ${json.length} filas. Procesando...`);

          let actualizados = 0;
          let asignacionesCreadas = 0;
          let noEncontrados = 0;

          // Cache all personas to minimize reads
          const qPers = query(collection(db, 'personas'));
          const persSnapshot = await getDocs(qPers);
          const allPersonas = persSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

          const toTitleCase = (str: string) => {
            return str.toLowerCase().split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          };

          for (const row of json) {
            const rawName = row['NOMBRE USUARIO'];
            const email = row['ID USUARIO']?.toLowerCase()?.trim();
            const licencia = row['LICENCIA ASIGNADA']?.trim();

            if (!rawName || rawName === 'N/A' || !licencia) continue;

            const titleCaseName = toTitleCase(rawName.trim());

            // Find persona
            const personaMatch = allPersonas.find((p: any) => p.name === titleCaseName || p.name.toLowerCase() === rawName.trim().toLowerCase());

            if (personaMatch) {
              const pId = personaMatch.id;

              // 1. Update Persona Profile
              const updates: any = {};
              if (licencia) updates.office365License = licencia;
              if (email && email !== 'n/a') updates.office365Email = email; // Guardar como correo de O365, manteniendo el principal intacto

              if (Object.keys(updates).length > 0) {
                await updateDoc(doc(db, 'personas', pId), updates);
                actualizados++;
              }

              // 2. Crear Equipo (Licencia) y Asignación si es una licencia válida y no "DISPONIBLE"
              if (!licencia.toLowerCase().includes('disponible')) {
                const assetCode = `O365-${pId.substring(0, 5).toUpperCase()}`;
                const equipoRef = await addDoc(collection(db, 'equipos'), {
                  assetCode: assetCode,
                  serialNumber: email || 'N/A', // Guardar el correo como número de serie de la licencia
                  equipmentType: 'Licencia Office 365',
                  brandModel: licencia,
                  ownership: 'Propio de la empresa',
                  status: 'Dentro',
                  createdAt: serverTimestamp()
                });

                await addDoc(collection(db, 'asignaciones'), {
                  personaId: pId,
                  personaName: personaMatch.name,
                  equipoId: equipoRef.id,
                  equipoAssetCode: assetCode,
                  equipoBrandModel: licencia,
                  fechaAsignacion: serverTimestamp(),
                  estado: 'Asignado'
                });
                asignacionesCreadas++;
              }
            } else {
              addStatus(`Advertencia: No se encontró la persona "${rawName}" en la base de datos.`);
              noEncontrados++;
            }
          }

          addStatus(`¡Importación de licencias completada!`);
          addStatus(`- Perfiles de usuario actualizados: ${actualizados}`);
          addStatus(`- Licencias creadas y asignadas: ${asignacionesCreadas}`);
          if (noEncontrados > 0) addStatus(`- Usuarios no encontrados en el sistema: ${noEncontrados}`);
        } catch (err: any) {
          console.error(err);
          addStatus(`ERROR procesando excel: ${err.message}`);
        } finally {
          setLoading(false);
          // Reset file input
          e.target.value = '';
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      console.error(error);
      addStatus(`ERROR general: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ background: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginBottom: '15px' }}><i className="fa-solid fa-broom"></i> Limpiador de Duplicados</h2>
        <p style={{ marginBottom: '25px', color: '#4b5563' }}>
          Esta herramienta escaneará tu base de datos de Personas buscando perfiles con el mismo nombre.
          Unificará todos los correos en un solo perfil maestro, reasignará los equipos si es necesario, y borrará los registros redundantes.
          <br /><br />
          <strong>Esta operación no se puede deshacer.</strong>
        </p>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
          <button
            onClick={procesarLimpieza}
            disabled={loading}
            style={{
              padding: '12px 24px',
              background: loading ? '#9ca3af' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Limpiando...' : 'Ejecutar Limpieza de Duplicados'}
          </button>

          <button
            onClick={estandarizarNombres}
            disabled={loading}
            style={{
              padding: '12px 24px',
              background: loading ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Procesando...' : 'Estandarizar Nombres'}
          </button>

          <button
            onClick={estandarizarAreas}
            disabled={loading}
            style={{
              padding: '12px 24px',
              background: loading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Trabajando...' : 'Estandarizar Áreas (Mayúsculas a Título)'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
          <button
            onClick={migrarCorreosAInventario}
            disabled={loading}
            style={{
              padding: '12px 24px',
              background: loading ? '#9ca3af' : '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              flex: '1 1 calc(50% - 15px)'
            }}
          >
            <i className="fa-solid fa-envelope"></i> {loading ? 'Migrando...' : 'Migrar Correos a Inventario'}
          </button>

          <label
            style={{
              padding: '12px 24px',
              background: loading ? '#9ca3af' : '#0284c7',
              color: 'white',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              flex: '1 1 calc(50% - 15px)',
              textAlign: 'center',
              display: 'inline-block'
            }}
          >
            <i className="fa-brands fa-microsoft"></i> {loading ? 'Importando...' : 'Importar Licencias Office 365'}
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={importarLicenciasOffice}
              style={{ display: 'none' }}
              disabled={loading}
            />
          </label>
        </div>

        {status.length > 0 && (
          <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '8px', border: '1px solid #d1d5db', minHeight: '200px' }}>
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
