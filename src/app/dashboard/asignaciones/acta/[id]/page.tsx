"use client";
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import SignatureCanvas from 'react-signature-canvas';
import Link from 'next/link';
import './acta.css';

interface SelectableToolItem {
  id: string;
  descripcion: string;
  detalle: string;
  sistemaTipo: string;
  serial: string;
  isShared?: boolean;
  isOtherComputer?: boolean;
  capitalizeDesc?: boolean;
  capitalizeDetalle?: boolean;
  uppercaseSerial?: boolean;
  monospaceSerial?: boolean;
}

interface ExtraActaItem {
  id: string;
  descripcion: string;
  detalle: string;
  sistemaTipo: string;
  serial: string;
}

const isComputerType = (type?: string) => {
  if (!type) return false;
  const t = type.toUpperCase();
  return (
    t.includes('PC') ||
    t.includes('PORTÁTIL') ||
    t.includes('PORTATIL') ||
    t.includes('LAPTOP') ||
    t.includes('COMPUTADOR') ||
    t.includes('ESCRITORIO') ||
    t.includes('ALL IN ONE') ||
    t.includes('SERVIDOR')
  );
};

export default function ActaPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;
  
  const formatText = (str: string) => str ? str.toLowerCase() : '';

  
  const [asignacion, setAsignacion] = useState<any>(null);
  const [persona, setPersona] = useState<any>(null);
  const [equipo, setEquipo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sharedPrinters, setSharedPrinters] = useState<any[]>([]);
  const [otrosEquipos, setOtrosEquipos] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [signingRole, setSigningRole] = useState<'colaborador' | 'entrega' | 'gerencia' | null>(null);
  const [signatureError, setSignatureError] = useState('');
  const [savingSignature, setSavingSignature] = useState(false);
  const sigCanvas = useRef<any>(null);

  // Observaciones de devolución y entrega
  const [observacionesDevolucion, setObservacionesDevolucion] = useState('');
  const [observacionesEntrega, setObservacionesEntrega] = useState('');
  const [savingObs, setSavingObs] = useState(false);

  // Toggle between 'entrega' and 'devolucion' views when estado is Devuelto
  const [viewMode, setViewMode] = useState<'entrega' | 'devolucion'>('devolucion');

  const [showContentMobile, setShowContentMobile] = useState(false);

  // Selección de elementos para Acta de Devolución y Acta de Entrega
  const [devolucionIncludeMain, setDevolucionIncludeMain] = useState<boolean>(true);
  const [devolucionIncludeSpecs, setDevolucionIncludeSpecs] = useState<boolean>(true);
  const [devolucionSelectedIds, setDevolucionSelectedIds] = useState<string[]>([]);
  const [devolucionExtraItems, setDevolucionExtraItems] = useState<ExtraActaItem[]>([]);

  const [entregaIncludeMain, setEntregaIncludeMain] = useState<boolean>(true);
  const [entregaSelectedIds, setEntregaSelectedIds] = useState<string[] | null>(null);
  const [entregaExtraItems, setEntregaExtraItems] = useState<ExtraActaItem[]>([]);
  const [showSelectorPanel, setShowSelectorPanel] = useState<boolean>(true);
  const [showEntregaSelector, setShowEntregaSelector] = useState<boolean>(false);
  const [savingSelection, setSavingSelection] = useState<boolean>(false);

  // Formulario rápido para ítem adicional manual
  const [customDesc, setCustomDesc] = useState('');
  const [customDetalle, setCustomDetalle] = useState('');
  const [customSerial, setCustomSerial] = useState('');

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
          setDevolucionIncludeMain(asigData.devolucionIncludeMain ?? true);
          setDevolucionIncludeSpecs(asigData.devolucionIncludeSpecs ?? true);
          setDevolucionSelectedIds(
            Array.isArray(asigData.itemsDevolucionSeleccionados) ? asigData.itemsDevolucionSeleccionados : []
          );
          setDevolucionExtraItems(
            Array.isArray(asigData.itemsDevolucionExtra) ? asigData.itemsDevolucionExtra : []
          );
          setEntregaIncludeMain(asigData.entregaIncludeMain ?? true);
          setEntregaSelectedIds(
            Array.isArray(asigData.itemsEntregaSeleccionados) ? asigData.itemsEntregaSeleccionados : null
          );
          setEntregaExtraItems(
            Array.isArray(asigData.itemsEntregaExtra) ? asigData.itemsEntregaExtra : []
          );

          // Fetch Persona details
          let personaData = null;
          if (asigData.personaId) {
            const persDoc = await getDoc(doc(db, 'personas', asigData.personaId));
            if (persDoc.exists()) {
              personaData = persDoc.data();
              setPersona(personaData);
            }
          }

          // Fetch Area's shared printers if this persona doesn't have it directly
          if (personaData && personaData.area) {
             const qArea = query(collection(db, 'personas'), where('area', '==', personaData.area));
             const areaSnapshot = await getDocs(qArea);
             let shared: any[] = [];
             areaSnapshot.docs.forEach(d => {
               if (d.id !== asigData.personaId) {
                 const p = d.data();
                 if (p.printerBrandModel) {
                   shared.push({ brandModel: p.printerBrandModel, serial: p.printerSerial, mainUser: p.name });
                 }
                 if (p.assignedPrinters) {
                   p.assignedPrinters.forEach((ap:any) => {
                     shared.push({ brandModel: ap.brandModel, serial: ap.serial, mainUser: p.name });
                   });
                 }
               }
             });
             if (shared.length > 0) {
               setSharedPrinters(shared);
             }
          }

          // Fetch Equipo details
          if (asigData.equipoId) {
            const equiDoc = await getDoc(doc(db, 'equipos', asigData.equipoId));
            if (equiDoc.exists()) setEquipo(equiDoc.data());
          }

          // Fetch other equipments assigned to this persona
          if (asigData.personaId) {
            const qOtrasAsig = query(collection(db, 'asignaciones'), where('personaId', '==', asigData.personaId), where('estado', '==', 'Asignado'));
            const otrasAsigSnap = await getDocs(qOtrasAsig);
            let otrosEquiposList: any[] = [];
            for (const d of otrasAsigSnap.docs) {
              if (d.id !== id) { // Exclude current assignment
                const oa = d.data();
                if (oa.equipoId) {
                  const eDoc = await getDoc(doc(db, 'equipos', oa.equipoId));
                  if (eDoc.exists()) {
                    const eData = eDoc.data();
                    // Optional: You could filter to only show peripherals, but showing all other assigned items is usually desired in the Acta tools section
                    otrosEquiposList.push({ ...eData, asignacionId: d.id });
                  }
                }
              }
            }
            if (otrosEquiposList.length > 0) {
              setOtrosEquipos(otrosEquiposList);
            }
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

  const handleSaveObservacionesEntrega = async () => {
    setSavingObs(true);
    try {
      await updateDoc(doc(db, 'asignaciones', id), {
        observaciones: observacionesEntrega.trim()
      });
      setAsignacion({ ...asignacion, observaciones: observacionesEntrega.trim() });
    } catch (e) {
      console.error(e);
    } finally {
      setSavingObs(false);
    }
  };

  const availableTools = useMemo<SelectableToolItem[]>(() => {
    const list: SelectableToolItem[] = [];
    if (persona?.office365License) {
      list.push({
        id: 'office365',
        descripcion: formatText(persona.office365License),
        detalle: formatText(persona.office365Email) || '---',
        sistemaTipo: 'Paquete de Office',
        serial: persona.office365Key || 'N/A',
        capitalizeDesc: true,
        monospaceSerial: true,
      });
    }
    if (persona?.domainUser) {
      list.push({
        id: 'domain',
        descripcion: 'Acceso al Dominio',
        detalle: formatText(persona.domainUser),
        sistemaTipo: 'Red Local',
        serial: 'N/A',
      });
    }
    if (persona?.siesaUser) {
      list.push({
        id: 'siesa',
        descripcion: 'Acceso ERP SIESA',
        detalle: formatText(persona.siesaUser),
        sistemaTipo: 'SIESA',
        serial: 'N/A',
      });
    }
    if (persona?.printerBrandModel) {
      list.push({
        id: 'main-printer',
        descripcion: 'Impresora Asignada',
        detalle: formatText(persona.printerBrandModel),
        sistemaTipo: 'Hardware',
        serial: persona.printerSerial || 'N/A',
        capitalizeDetalle: true,
        uppercaseSerial: true,
      });
    }
    persona?.assignedPrinters?.forEach((ap: any, i: number) => {
      list.push({
        id: `assigned-printer:${i}:${ap.serial || ap.brandModel || ''}`,
        descripcion: 'Impresora Adicional',
        detalle: formatText(ap.brandModel),
        sistemaTipo: 'Hardware',
        serial: ap.serial || 'N/A',
        capitalizeDetalle: true,
        uppercaseSerial: true,
      });
    });
    sharedPrinters.forEach((sp: any, i: number) => {
      list.push({
        id: `shared-printer:${i}:${sp.serial || sp.brandModel || ''}`,
        descripcion: 'Impresora de Área (Compartida)',
        detalle: formatText(sp.brandModel),
        sistemaTipo: 'Hardware',
        serial: sp.serial || 'N/A',
        isShared: true,
        capitalizeDetalle: true,
        uppercaseSerial: true,
      });
    });
    persona?.assignedTools?.forEach((at: any, i: number) => {
      list.push({
        id: `assigned-tool:${i}:${at.serial || at.brandModel || ''}`,
        descripcion: formatText(at.equipmentType) || 'Herramienta Tecnológica',
        detalle: formatText(at.brandModel),
        sistemaTipo: 'Hardware',
        serial: at.serial || 'N/A',
        capitalizeDetalle: true,
        uppercaseSerial: true,
      });
    });
    otrosEquipos.forEach((oe: any, i: number) => {
      list.push({
        id: `otro-equipo:${oe.asignacionId || `${i}:${oe.serialNumber || ''}`}`,
        descripcion: formatText(oe.equipmentType) || 'Periférico / Accesorio',
        detalle: formatText(oe.brandModel),
        sistemaTipo: 'Hardware',
        serial: oe.serialNumber || 'N/A',
        isOtherComputer: isComputerType(oe.equipmentType),
        capitalizeDetalle: true,
        uppercaseSerial: true,
      });
    });
    return list;
  }, [persona, sharedPrinters, otrosEquipos]);

  const isDevolucion = viewMode === 'devolucion' && asignacion?.estado === 'Devuelto';

  const defaultEntregaIds = useMemo(
    () => availableTools.filter((t) => !t.isOtherComputer).map((t) => t.id),
    [availableTools]
  );

  const effectiveEntregaSelectedIds = entregaSelectedIds !== null ? entregaSelectedIds : defaultEntregaIds;
  const activeIncludeMain = isDevolucion ? devolucionIncludeMain : entregaIncludeMain;
  const activeSelectedIds = isDevolucion ? devolucionSelectedIds : effectiveEntregaSelectedIds;
  const activeExtraItems = isDevolucion ? devolucionExtraItems : entregaExtraItems;

  const selectedTools = useMemo(
    () => availableTools.filter((t) => activeSelectedIds.includes(t.id)),
    [availableTools, activeSelectedIds]
  );

  const hasAnyToolsToRender = selectedTools.length > 0 || activeExtraItems.length > 0;

  const persistSelection = async (updates: Record<string, any>) => {
    setSavingSelection(true);
    try {
      await updateDoc(doc(db, 'asignaciones', id), updates);
      setAsignacion((prev: any) => (prev ? { ...prev, ...updates } : prev));
    } catch (err) {
      console.error('Error guardando selección del acta:', err);
    } finally {
      setSavingSelection(false);
    }
  };

  const handleToggleMainEquipo = (checked: boolean) => {
    if (isDevolucion) {
      setDevolucionIncludeMain(checked);
      persistSelection({ devolucionIncludeMain: checked });
    } else {
      setEntregaIncludeMain(checked);
      persistSelection({ entregaIncludeMain: checked });
    }
  };

  const handleToggleSpecsDevolucion = (checked: boolean) => {
    setDevolucionIncludeSpecs(checked);
    persistSelection({ devolucionIncludeSpecs: checked });
  };

  const handleToggleTool = (toolId: string) => {
    const next = activeSelectedIds.includes(toolId)
      ? activeSelectedIds.filter((item) => item !== toolId)
      : [...activeSelectedIds, toolId];

    if (isDevolucion) {
      setDevolucionSelectedIds(next);
      persistSelection({ itemsDevolucionSeleccionados: next });
    } else {
      setEntregaSelectedIds(next);
      persistSelection({ itemsEntregaSeleccionados: next });
    }
  };

  const handleSelectSoloEquipoPrincipal = () => {
    if (isDevolucion) {
      setDevolucionIncludeMain(true);
      setDevolucionSelectedIds([]);
      persistSelection({ devolucionIncludeMain: true, itemsDevolucionSeleccionados: [] });
    } else {
      setEntregaIncludeMain(true);
      setEntregaSelectedIds([]);
      persistSelection({ entregaIncludeMain: true, itemsEntregaSeleccionados: [] });
    }
  };

  const handleSelectTodoPersonal = () => {
    const personalIds = availableTools
      .filter((t) => !t.isOtherComputer && !t.isShared)
      .map((t) => t.id);

    if (isDevolucion) {
      setDevolucionIncludeMain(true);
      setDevolucionSelectedIds(personalIds);
      persistSelection({ devolucionIncludeMain: true, itemsDevolucionSeleccionados: personalIds });
    } else {
      setEntregaIncludeMain(true);
      setEntregaSelectedIds(personalIds);
      persistSelection({ entregaIncludeMain: true, itemsEntregaSeleccionados: personalIds });
    }
  };

  const quickAccessories = [
    { key: 'cargador', label: 'Cargador', detalle: 'Original / Adaptador AC' },
    { key: 'mouse', label: 'Mouse', detalle: equipo?.mouse && equipo.mouse !== 'Sí' ? equipo.mouse : 'Óptico / USB' },
    { key: 'teclado', label: 'Teclado', detalle: equipo?.teclado && equipo.teclado !== 'Sí' ? equipo.teclado : 'Estándar / USB' },
    { key: 'monitor', label: 'Monitor', detalle: equipo?.monitor && equipo.monitor !== 'Sí' ? equipo.monitor : 'Pantalla externa' },
    { key: 'cable-poder', label: 'Cable de poder', detalle: 'Cable AC' },
    { key: 'diadema', label: 'Diadema', detalle: 'Audio / Micrófono' },
    { key: 'maletin', label: 'Maletín / Base', detalle: 'Accesorio' },
  ];

  const handleToggleQuickAccessory = (key: string, label: string, detalle: string) => {
    const chipId = `quick:${key}`;
    const exists = activeExtraItems.some((item) => item.id === chipId);
    const next = exists
      ? activeExtraItems.filter((item) => item.id !== chipId)
      : [
          ...activeExtraItems,
          { id: chipId, descripcion: label, detalle, sistemaTipo: 'Accesorio', serial: 'N/A' },
        ];

    if (isDevolucion) {
      setDevolucionExtraItems(next);
      persistSelection({ itemsDevolucionExtra: next });
    } else {
      setEntregaExtraItems(next);
      persistSelection({ itemsEntregaExtra: next });
    }
  };

  const handleAddCustomExtra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDesc.trim()) return;
    const newItem: ExtraActaItem = {
      id: `custom:${Date.now()}`,
      descripcion: customDesc.trim(),
      detalle: customDetalle.trim() || 'Entregado',
      sistemaTipo: 'Hardware / Accesorio',
      serial: customSerial.trim() || 'N/A',
    };
    const next = [...activeExtraItems, newItem];
    if (isDevolucion) {
      setDevolucionExtraItems(next);
      persistSelection({ itemsDevolucionExtra: next });
    } else {
      setEntregaExtraItems(next);
      persistSelection({ itemsEntregaExtra: next });
    }
    setCustomDesc('');
    setCustomDetalle('');
    setCustomSerial('');
  };

  const handleRemoveExtraItem = (extraId: string) => {
    const next = activeExtraItems.filter((item) => item.id !== extraId);
    if (isDevolucion) {
      setDevolucionExtraItems(next);
      persistSelection({ itemsDevolucionExtra: next });
    } else {
      setEntregaExtraItems(next);
      persistSelection({ itemsEntregaExtra: next });
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando documento...</div>;
  if (!asignacion) return <div style={{ padding: '40px', textAlign: 'center' }}>No se encontró el acta de asignación.</div>;

  const isSelectorVisible = isDevolucion ? showSelectorPanel : showEntregaSelector;
  const textoElementosDevueltos =
    activeIncludeMain && hasAnyToolsToRender
      ? 'del equipo y de las herramientas/accesorios descritos anteriormente'
      : activeIncludeMain
      ? 'del equipo descrito anteriormente'
      : hasAnyToolsToRender
      ? 'de las herramientas y accesorios descritos anteriormente'
      : 'de los elementos descritos';

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

      {/* Botón compacto en modo Entrega cuando el selector está oculto */}
      {!isDevolucion && !showEntregaSelector && (
        <div className="no-print" style={{ maxWidth: '900px', margin: '0 auto 12px auto', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setShowEntregaSelector(true)}
            className="btn-selector-quick"
          >
            <i className="fa-solid fa-sliders"></i> Elegir qué elementos incluir en el acta
          </button>
        </div>
      )}

      {isDevolucion && !showSelectorPanel && (
        <div className="no-print" style={{ maxWidth: '900px', margin: '0 auto 12px auto', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setShowSelectorPanel(true)}
            className="btn-selector-quick primary"
          >
            <i className="fa-solid fa-list-check"></i> Elegir qué elementos me entrega el colaborador
          </button>
        </div>
      )}

      {/* Panel interactivo de selección (solo visible en pantalla, oculto al imprimir) */}
      {isSelectorVisible && (
        <div className={`acta-selector-panel no-print ${isDevolucion ? '' : 'entrega-mode'}`}>
          <div className="selector-panel-header">
            <div>
              <h4 className="selector-panel-title">
                <i className="fa-solid fa-list-check" style={{ color: isDevolucion ? '#10b981' : '#4f46e5' }}></i>
                {isDevolucion
                  ? '¿Qué elementos te entrega / devuelve el colaborador?'
                  : 'Elementos incluidos en esta Acta de Entrega'}
              </h4>
              <p className="selector-panel-subtitle">
                {isDevolucion
                  ? 'Marca únicamente lo que recibes en esta acta. Otros PCs o herramientas que conserva el colaborador quedan fuera.'
                  : 'Marca o desmarca las herramientas y accesorios que deseas mostrar en el acta.'}
              </p>
            </div>
            <div className="selector-quick-actions">
              {savingSelection ? (
                <span className="selector-save-status">Guardando...</span>
              ) : (
                <span className="selector-save-status">
                  <i className="fa-solid fa-check"></i> Guardado automático
                </span>
              )}
              <button
                type="button"
                onClick={handleSelectSoloEquipoPrincipal}
                className="btn-selector-quick"
                title="Dejar únicamente el equipo principal de esta acta"
              >
                Solo equipo principal
              </button>
              {availableTools.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectTodoPersonal}
                  className="btn-selector-quick primary"
                  title="Marcar equipo principal + herramientas personales (sin otros PCs ni impresoras compartidas)"
                >
                  {isDevolucion ? 'Todo (Paz y Salvo)' : 'Todas sus herramientas'}
                </button>
              )}
              <button
                type="button"
                onClick={() => (isDevolucion ? setShowSelectorPanel(false) : setShowEntregaSelector(false))}
                className="btn-selector-quick"
                title="Ocultar este panel"
              >
                Ocultar
              </button>
            </div>
          </div>

          <div className="selector-items-grid">
            {/* Equipo principal de la asignación */}
            <label className={`selector-item-card ${activeIncludeMain ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={activeIncludeMain}
                onChange={(e) => handleToggleMainEquipo(e.target.checked)}
              />
              <div className="selector-item-info">
                <div className="selector-item-name">
                  {formatText(equipo?.equipmentType) || 'Equipo'} — {equipo?.brandModel || asignacion.equipoBrandModel || 'Sin modelo'}
                </div>
                <div className="selector-item-detail">S/N: {equipo?.serialNumber || 'No registrado'}</div>
                <span className="selector-badge main">Equipo de esta acta</span>
              </div>
            </label>

            {/* Opción de mostrar/ocultar especificaciones registradas en devolución */}
            {isDevolucion && asignacion.observaciones && (
              <label className={`selector-item-card ${devolucionIncludeSpecs ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={devolucionIncludeSpecs}
                  onChange={(e) => handleToggleSpecsDevolucion(e.target.checked)}
                />
                <div className="selector-item-info">
                  <div className="selector-item-name" style={{ textTransform: 'none' }}>
                    Especificaciones / Observaciones del equipo
                  </div>
                  <div className="selector-item-detail">
                    {asignacion.observaciones.length > 65
                      ? `${asignacion.observaciones.slice(0, 65)}...`
                      : asignacion.observaciones}
                  </div>
                  <span className="selector-badge neutral">Texto técnico del equipo</span>
                </div>
              </label>
            )}

            {/* Herramientas, licencias, impresoras y otros equipos del colaborador */}
            {availableTools.map((tool) => {
              const checked = activeSelectedIds.includes(tool.id);
              return (
                <label key={tool.id} className={`selector-item-card ${checked ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleTool(tool.id)}
                  />
                  <div className="selector-item-info">
                    <div className="selector-item-name">
                      {tool.descripcion}
                    </div>
                    <div className="selector-item-detail" style={{ textTransform: tool.capitalizeDetalle ? 'capitalize' : 'none' }}>
                      {tool.detalle} {tool.serial && tool.serial !== 'N/A' ? `• S/N: ${tool.serial.toUpperCase()}` : ''}
                    </div>
                    {tool.isOtherComputer && (
                      <span className="selector-badge warn">Otro PC activo del colaborador</span>
                    )}
                    {tool.isShared && (
                      <span className="selector-badge neutral">Impresora compartida del área</span>
                    )}
                  </div>
                </label>
              );
            })}

            {/* Ítems adicionales agregados manualmente */}
            {activeExtraItems.map((extra) => (
              <div key={extra.id} className="selector-item-card selected" style={{ cursor: 'default' }}>
                <input type="checkbox" checked readOnly />
                <div className="selector-item-info">
                  <div className="selector-item-name">{extra.descripcion}</div>
                  <div className="selector-item-detail">
                    {extra.detalle} {extra.serial && extra.serial !== 'N/A' ? `• S/N: ${extra.serial}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-remove-extra"
                  onClick={() => handleRemoveExtraItem(extra.id)}
                  title="Quitar elemento"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ))}
          </div>

          {/* Barra rápida para agregar accesorios u otros elementos */}
          <div className="selector-extra-section">
            <span className="selector-extra-label">
              {isDevolucion
                ? '¿También te entrega algún accesorio? Clic rápido o agrégalo manualmente:'
                : 'Agregar accesorio adicional al acta:'}
            </span>
            <div className="selector-chips">
              {quickAccessories.map((acc) => {
                const isActive = activeExtraItems.some((item) => item.id === `quick:${acc.key}`);
                return (
                  <button
                    key={acc.key}
                    type="button"
                    onClick={() => handleToggleQuickAccessory(acc.key, acc.label, acc.detalle)}
                    className={`selector-chip-btn ${isActive ? 'active' : ''}`}
                  >
                    {isActive ? '✓ ' : '+ '}
                    {acc.label}
                  </button>
                );
              })}
            </div>
            <form onSubmit={handleAddCustomExtra} className="selector-custom-form">
              <input
                type="text"
                placeholder="Otro elemento (ej. Monitor 19'', Cargador...)"
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                style={{ flex: '2', minWidth: '180px' }}
              />
              <input
                type="text"
                placeholder="Detalle / Marca (opcional)"
                value={customDetalle}
                onChange={(e) => setCustomDetalle(e.target.value)}
                style={{ flex: '1.5', minWidth: '140px' }}
              />
              <input
                type="text"
                placeholder="Serial (opcional)"
                value={customSerial}
                onChange={(e) => setCustomSerial(e.target.value)}
                style={{ flex: '1', minWidth: '110px' }}
              />
              <button type="submit" className="btn-add-extra-item" disabled={!customDesc.trim()}>
                + Agregar
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="acta-container">
        <div className="mobile-toggle-content no-print">
          <button 
            onClick={() => setShowContentMobile(!showContentMobile)}
            className="btn-toggle-content"
          >
            <i className={`fa-solid ${showContentMobile ? 'fa-eye-slash' : 'fa-eye'}`}></i> {showContentMobile ? 'Ocultar Contenido' : 'Ver Contenido'}
          </button>
        </div>

        <div className={`acta-content-wrapper ${showContentMobile ? 'show-mobile' : 'hide-mobile'}`}>
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
              {isDevolucion && asignacion.fechaDevolucion && (
                <p style={{ marginTop: '5px' }}><strong>Fecha Devolución:</strong> {formatDate(asignacion.fechaDevolucion)}</p>
              )}
            </div>
          </div>

          <div className="acta-title">
            <h1>{isDevolucion ? 'ACTA DE DEVOLUCIÓN DE EQUIPO' : 'ACTA DE ENTREGA Y COMPROMISO DE EQUIPO'}</h1>
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

        {activeIncludeMain && (
          <div className="acta-section">
            <h3>{isDevolucion ? 'Datos del Equipo Devuelto' : 'Datos del Equipo Asignado'}</h3>
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
        )}

        {hasAnyToolsToRender && (
          <div className="acta-section">
            <h3>{isDevolucion ? 'Herramientas y Accesorios Entregados' : 'Herramientas Tecnológicas Asignadas'}</h3>
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
                  {selectedTools.map((tool) => (
                    <tr
                      key={tool.id}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        background: tool.isShared ? '#f8fafc' : 'transparent',
                      }}
                    >
                      <td
                        style={{
                          padding: '8px',
                          fontSize: '14px',
                          color: '#1f2937',
                          textTransform: tool.capitalizeDesc ? 'capitalize' : 'none',
                        }}
                      >
                        {tool.descripcion}
                      </td>
                      <td
                        style={{
                          padding: '8px',
                          fontSize: '14px',
                          color: '#1f2937',
                          textTransform: tool.capitalizeDetalle ? 'capitalize' : 'none',
                        }}
                      >
                        {tool.detalle}
                      </td>
                      <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>{tool.sistemaTipo}</td>
                      <td
                        style={{
                          padding: '8px',
                          fontSize: '14px',
                          color: '#1f2937',
                          fontFamily: tool.monospaceSerial ? 'monospace' : 'inherit',
                          textTransform: tool.uppercaseSerial ? 'uppercase' : 'none',
                        }}
                      >
                        {tool.serial}
                      </td>
                    </tr>
                  ))}
                  {activeExtraItems.map((extra) => (
                    <tr key={extra.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937', textTransform: 'capitalize' }}>
                        {extra.descripcion}
                      </td>
                      <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>{extra.detalle}</td>
                      <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937' }}>{extra.sistemaTipo}</td>
                      <td style={{ padding: '8px', fontSize: '14px', color: '#1f2937', textTransform: 'uppercase' }}>
                        {extra.serial}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Observaciones de Entrega / Especificaciones */}
        {((!isDevolucion && (asignacion.observaciones || viewMode === 'entrega' || asignacion.estado !== 'Devuelto')) ||
          (isDevolucion && asignacion.observaciones && devolucionIncludeSpecs)) && (
          <div className="acta-section">
            <h3>Especificaciones Técnicas y Observaciones</h3>
            {asignacion.observaciones ? (
              <div style={{ marginTop: '5px' }}>
                <p>{asignacion.observaciones}</p>
                {!isDevolucion && (
                  <button
                    className="no-print"
                    onClick={() => { setObservacionesEntrega(asignacion.observaciones || ''); setAsignacion({ ...asignacion, observaciones: null }); }}
                    style={{ marginTop: '5px', fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Editar observaciones de entrega
                  </button>
                )}
              </div>
            ) : !isDevolucion && (
              <div className="no-print" style={{ marginTop: '10px' }}>
                <textarea
                  value={observacionesEntrega}
                  onChange={(e) => setObservacionesEntrega(e.target.value)}
                  placeholder="Describa las observaciones del equipo al momento de la entrega (daños, faltantes, buen estado, etc.)"
                  rows={4}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                />
                <button
                  onClick={handleSaveObservacionesEntrega}
                  disabled={savingObs || !observacionesEntrega.trim()}
                  style={{ marginTop: '8px', padding: '8px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  {savingObs ? 'Guardando...' : 'Guardar Observaciones'}
                </button>
                <p style={{ marginTop: '8px', color: '#6b7280', fontSize: '12px' }}>Las observaciones son opcionales. Si no hay observaciones relevantes, deje el campo vacío.</p>
              </div>
            )}
          </div>
        )}

        <div className="acta-legal-text">
          {isDevolucion ? (
            <>
              <p>
                Por medio del presente documento, <strong>{persona?.name || asignacion.personaName}</strong>, identificado(a) con{' '}
                C.C. <strong>{persona?.idNumber || ''}</strong>, hace entrega formal {textoElementosDevueltos} a la empresa{' '}
                <strong>CONTEX S.A.S.</strong>, en las condiciones especificadas, dando por{' '}
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
                  onClick={() => { setObservacionesDevolucion(asignacion.observacionesDevolucion || ''); setAsignacion({ ...asignacion, observacionesDevolucion: null }); }}
                  style={{ marginTop: '5px', fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Editar observaciones
                </button>
              )}
            </>
          ) : (
            <>
              <p>
                Hago constar la recepción {activeIncludeMain && hasAnyToolsToRender ? 'del equipo y herramientas tecnológicas descritas' : activeIncludeMain ? 'del equipo descrito' : 'de las herramientas tecnológicas descritas'}, asignados en buen estado y en las condiciones indicadas, para uso exclusivo como <strong>herramienta de trabajo</strong>.
              </p>
              <br />
              <p><strong>Me comprometo a:</strong></p>
              <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
                <li>Darles un uso exclusivamente laboral y no instalar software no autorizado.</li>
                <li>Asumir responsabilidad económica por pérdida, robo o daños por mal uso.</li>
                <li>Devolverlos en las mismas condiciones al cese de mis funciones o requerimiento de la empresa.</li>
              </ul>
            </>
          )}
        </div>
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
