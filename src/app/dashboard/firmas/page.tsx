"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import SignatureCanvas from 'react-signature-canvas';
import SearchablePersonaSelect, { PersonaOption } from '@/components/SearchablePersonaSelect';
import './firmas.css';

const ALMACEN_EMAIL = 'almacen@contexsas.com';

const UNIDADES_INSUMO = [
  'Unidad',
  'Caja',
  'Paquete',
  'Par',
  'Rollo',
  'Resma',
  'Metro',
  'Kg',
  'Gramo',
  'Litro',
  'Galón',
  'Botella',
  'Kit',
  'Juego',
  'Otro',
];

interface InsumoItem {
  descripcion: string;
  cantidad: number;
  unidad: string;
}

interface SalidaInsumo {
  id: string;
  consecutivo: string;
  personaId?: string;
  personaName: string;
  personaCedula: string;
  area: string;
  insumos: InsumoItem[];
  observaciones?: string;
  firmaReceptor?: string | null;
  estado: 'Firmado' | 'Pendiente';
  entregadoPorEmail: string;
  entregadoPorNombre: string;
  fechaSalida: any;
  fechaFirma?: any;
}

function getSafeSignatureDataUrl(canvasRef: React.RefObject<SignatureCanvas | null>): string | null {
  const sig = canvasRef.current;
  if (!sig || sig.isEmpty()) return null;
  try {
    return sig.getTrimmedCanvas().toDataURL('image/png');
  } catch {
    return sig.getCanvas().toDataURL('image/png');
  }
}

function ResponsiveSignatureBox({
  sigRef,
  height,
  guideText,
}: {
  sigRef: React.RefObject<SignatureCanvas | null>;
  height: number;
  guideText: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(540);

  useEffect(() => {
    const syncWidth = () => {
      if (wrapRef.current) {
        const w = Math.floor(wrapRef.current.clientWidth);
        if (w > 100) setWidth(w);
      }
    };
    syncWidth();
    window.addEventListener('resize', syncWidth);
    return () => window.removeEventListener('resize', syncWidth);
  }, []);

  return (
    <div ref={wrapRef} className="signature-canvas-wrapper">
      <SignatureCanvas
        ref={sigRef}
        penColor="#111827"
        clearOnResize={false}
        canvasProps={{
          width,
          height,
          style: { display: 'block', width: `${width}px`, height: `${height}px`, cursor: 'crosshair' },
        }}
      />
      <div className="signature-guide-line" />
      <div className="signature-guide-text">{guideText}</div>
    </div>
  );
}

export default function FirmasInsumosPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: string } | null>(null);

  // Data from Firestore
  const [salidas, setSalidas] = useState<SalidaInsumo[]>([]);
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [areas, setAreas] = useState<string[]>([]);

  // UI state
  const [showForm, setShowForm] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todas' | 'Firmado' | 'Pendiente'>('Todas');
  const [onlyToday, setOnlyToday] = useState(false);

  // Form state
  const [receiverMode, setReceiverMode] = useState<'registrado' | 'manual'>('registrado');
  const [selectedPersonaId, setSelectedPersonaId] = useState('');
  const [personaName, setPersonaName] = useState('');
  const [personaCedula, setPersonaCedula] = useState('');
  const [area, setArea] = useState('');
  const [insumos, setInsumos] = useState<InsumoItem[]>([{ descripcion: '', cantidad: 1, unidad: 'Unidad' }]);
  const [observaciones, setObservaciones] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Inline signature canvas
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);
  const sigWrapRef = useRef<HTMLDivElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(640);

  // Modals
  const [signingRecord, setSigningRecord] = useState<SalidaInsumo | null>(null);
  const modalSigRef = useRef<SignatureCanvas | null>(null);
  const [modalSigError, setModalSigError] = useState('');
  const [savingModalSig, setSavingModalSig] = useState(false);
  const [receiptRecord, setReceiptRecord] = useState<SalidaInsumo | null>(null);

  // Fullscreen/Expanded signature helper for the creation form
  const [showExpandedPad, setShowExpandedPad] = useState(false);
  const expandedSigRef = useRef<SignatureCanvas | null>(null);
  const [capturedFormSignature, setCapturedFormSignature] = useState<string | null>(null);

  // Access check: ONLY almacen@contexsas.com (role Almacén) and Admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setAuthorized(false);
        return;
      }

      const emailLower = (fbUser.email || '').toLowerCase();
      let role = emailLower === ALMACEN_EMAIL ? 'Almacén' : 'Empleado';
      let name = emailLower === ALMACEN_EMAIL ? 'Almacén' : (fbUser.email?.split('@')[0] || 'Usuario');

      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (emailLower !== ALMACEN_EMAIL && parsed.role) role = parsed.role;
          if (parsed.name) name = parsed.name;
        } catch {}
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (emailLower !== ALMACEN_EMAIL && data.role) role = data.role;
          if (data.name) name = data.name;
        }
      } catch (err) {
        console.warn('Error verificando rol de usuario:', err);
      }

      const isAllowed = emailLower === ALMACEN_EMAIL || role === 'Almacén' || role === 'Admin';
      setCurrentUser({ name, email: fbUser.email || '', role });
      setAuthorized(isAllowed);
    });

    return () => unsubscribe();
  }, []);

  // Measure inline signature container width so touch/mouse coordinates stay pixel-accurate
  useEffect(() => {
    if (!showForm) return;
    const updateWidth = () => {
      if (sigWrapRef.current) {
        const w = Math.floor(sigWrapRef.current.clientWidth);
        if (w > 120) setCanvasWidth(w);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [showForm, capturedFormSignature]);

  // Subscribe to Firestore collections only when authorized
  useEffect(() => {
    if (!authorized) return;

    const qSalidas = query(collection(db, 'salidas_insumos'), orderBy('fechaSalida', 'desc'));
    const unsubSalidas = onSnapshot(qSalidas, (snapshot) => {
      const list: SalidaInsumo[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as SalidaInsumo);
      });
      setSalidas(list);
    });

    const qPersonas = query(collection(db, 'personas'), orderBy('name', 'asc'));
    const unsubPersonas = onSnapshot(qPersonas, (snapshot) => {
      const list: PersonaOption[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name || '',
          idNumber: data.idNumber || '',
          area: data.area || '',
          cargo: data.cargo || '',
        });
      });
      setPersonas(list);
    });

    const qAreas = query(collection(db, 'areas'), orderBy('name', 'asc'));
    const unsubAreas = onSnapshot(qAreas, (snapshot) => {
      const list: string[] = [];
      snapshot.forEach((d) => {
        const n = d.data().name;
        if (n) list.push(n);
      });
      setAreas(list);
    });

    return () => {
      unsubSalidas();
      unsubPersonas();
      unsubAreas();
    };
  }, [authorized]);

  // Suggestions of past supply descriptions for fast entry
  const pastInsumoSuggestions = useMemo(() => {
    const set = new Set<string>();
    salidas.forEach((s) => {
      (s.insumos || []).forEach((it) => {
        if (it.descripcion && it.descripcion.trim()) set.add(it.descripcion.trim());
      });
    });
    return Array.from(set).sort();
  }, [salidas]);

  // KPI calculations
  const kpis = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    let hoy = 0;
    let firmadas = 0;
    let pendientes = 0;

    salidas.forEach((s) => {
      if (s.estado === 'Firmado' || s.firmaReceptor) firmadas++;
      else pendientes++;

      if (s.fechaSalida) {
        const d = s.fechaSalida.toDate ? s.fechaSalida.toDate() : new Date(s.fechaSalida);
        if (d >= startOfToday) hoy++;
      }
    });

    return { total: salidas.length, hoy, firmadas, pendientes };
  }, [salidas]);

  // Handle selecting a collaborator from SearchablePersonaSelect
  const handleSelectPersona = (personaId: string) => {
    setSelectedPersonaId(personaId);
    if (!personaId) {
      setPersonaName('');
      setPersonaCedula('');
      setArea('');
      return;
    }
    const found = personas.find((p) => p.id === personaId);
    if (found) {
      setPersonaName(found.name || '');
      setPersonaCedula(found.idNumber || '');
      setArea(found.area || '');
    }
  };

  // Dynamic insumos list handlers
  const handleInsumoChange = (index: number, field: keyof InsumoItem, value: string | number) => {
    setInsumos((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleAddInsumoRow = () => {
    setInsumos((prev) => [...prev, { descripcion: '', cantidad: 1, unidad: 'Unidad' }]);
  };

  const handleRemoveInsumoRow = (index: number) => {
    setInsumos((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const generateNextConsecutivo = () => {
    let maxNum = 0;
    salidas.forEach((s) => {
      const m = (s.consecutivo || '').match(/SAL-(\d+)/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    return `SAL-${String(maxNum + 1).padStart(4, '0')}`;
  };

  const resetForm = () => {
    setSelectedPersonaId('');
    setPersonaName('');
    setPersonaCedula('');
    setArea('');
    setInsumos([{ descripcion: '', cantidad: 1, unidad: 'Unidad' }]);
    setObservaciones('');
    setCapturedFormSignature(null);
    setFormError('');
    sigCanvasRef.current?.clear();
  };

  const handleSaveSalida = async (requireSignature: boolean) => {
    setFormError('');
    setFormSuccess('');

    const cleanName = personaName.trim();
    const cleanCedula = personaCedula.trim();
    const cleanArea = area.trim();

    if (!cleanName) {
      setFormError('Debes seleccionar o escribir el nombre del colaborador que recibe los insumos.');
      return;
    }

    const validInsumos = insumos
      .map((i) => ({
        descripcion: i.descripcion.trim(),
        cantidad: Number(i.cantidad) > 0 ? Number(i.cantidad) : 1,
        unidad: i.unidad || 'Unidad',
      }))
      .filter((i) => i.descripcion.length > 0);

    if (validInsumos.length === 0) {
      setFormError('Debes ingresar al menos un insumo con su descripción.');
      return;
    }

    const sigDataUrl = capturedFormSignature || getSafeSignatureDataUrl(sigCanvasRef);

    if (requireSignature && !sigDataUrl) {
      setFormError('Por favor solicita la firma del colaborador en el recuadro antes de guardar, o usa "Guardar Pendiente de Firma".');
      return;
    }

    setSaving(true);
    try {
      const consecutivo = generateNextConsecutivo();
      const estado: 'Firmado' | 'Pendiente' = sigDataUrl ? 'Firmado' : 'Pendiente';

      await addDoc(collection(db, 'salidas_insumos'), {
        consecutivo,
        personaId: receiverMode === 'registrado' ? selectedPersonaId : '',
        personaName: cleanName,
        personaCedula: cleanCedula || 'N/A',
        area: cleanArea || 'Sin área',
        insumos: validInsumos,
        observaciones: observaciones.trim(),
        firmaReceptor: sigDataUrl || null,
        estado,
        entregadoPorEmail: currentUser?.email || ALMACEN_EMAIL,
        entregadoPorNombre: currentUser?.name || 'Almacén',
        fechaSalida: serverTimestamp(),
        fechaFirma: sigDataUrl ? serverTimestamp() : null,
      });

      resetForm();
      setFormSuccess(
        estado === 'Firmado'
          ? `Salida ${consecutivo} registrada y firmada correctamente.`
          : `Salida ${consecutivo} guardada como Pendiente de Firma.`
      );
      setTimeout(() => setFormSuccess(''), 4500);
    } catch (err: any) {
      console.error('Error guardando salida de insumos:', err);
      setFormError('Error al guardar en la base de datos: ' + (err.message || 'Intente de nuevo.'));
    } finally {
      setSaving(false);
    }
  };

  // Sign a pending record via modal
  const handleConfirmPendingSignature = async () => {
    if (!signingRecord) return;
    setModalSigError('');
    const sigData = getSafeSignatureDataUrl(modalSigRef);
    if (!sigData) {
      setModalSigError('Por favor dibuje la firma en el recuadro blanco.');
      return;
    }
    setSavingModalSig(true);
    try {
      await updateDoc(doc(db, 'salidas_insumos', signingRecord.id), {
        firmaReceptor: sigData,
        estado: 'Firmado',
        fechaFirma: serverTimestamp(),
      });
      setSigningRecord(null);
    } catch (err: any) {
      console.error('Error guardando firma:', err);
      setModalSigError('No se pudo guardar la firma: ' + (err.message || 'Error desconocido'));
    } finally {
      setSavingModalSig(false);
    }
  };

  const handleDeleteSalida = async (item: SalidaInsumo) => {
    if (!confirm(`¿Seguro que deseas eliminar la salida ${item.consecutivo} de ${item.personaName}?`)) return;
    try {
      await deleteDoc(doc(db, 'salidas_insumos', item.id));
    } catch (err: any) {
      alert('Error al eliminar registro: ' + (err.message || 'Error'));
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return '---';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredSalidas = useMemo(() => {
    const q = search.toLowerCase().trim();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return salidas.filter((s) => {
      const effectiveStatus = s.firmaReceptor ? 'Firmado' : s.estado;
      if (statusFilter !== 'Todas' && effectiveStatus !== statusFilter) return false;

      if (onlyToday && s.fechaSalida) {
        const d = s.fechaSalida.toDate ? s.fechaSalida.toDate() : new Date(s.fechaSalida);
        if (d < startOfToday) return false;
      }

      if (!q) return true;
      const inInsumos = (s.insumos || []).some((i) =>
        (i.descripcion || '').toLowerCase().includes(q)
      );
      return (
        (s.consecutivo || '').toLowerCase().includes(q) ||
        (s.personaName || '').toLowerCase().includes(q) ||
        (s.personaCedula || '').toLowerCase().includes(q) ||
        (s.area || '').toLowerCase().includes(q) ||
        (s.observaciones || '').toLowerCase().includes(q) ||
        inInsumos
      );
    });
  }, [salidas, search, statusFilter, onlyToday]);

  const handleExportCsv = () => {
    const headers = ['Consecutivo', 'Fecha', 'Recibido Por', 'Cédula', 'Área', 'Insumos', 'Observaciones', 'Estado', 'Entregado Por'];
    const rows = filteredSalidas.map((s) => {
      const insumosText = (s.insumos || [])
        .map((i) => `${i.cantidad} ${i.unidad} - ${i.descripcion}`)
        .join(' | ');
      return [
        s.consecutivo,
        formatDate(s.fechaSalida),
        s.personaName,
        s.personaCedula,
        s.area,
        insumosText,
        s.observaciones || '',
        s.firmaReceptor ? 'Firmado' : s.estado,
        s.entregadoPorNombre || s.entregadoPorEmail || 'Almacén',
      ]
        .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
        .join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salidas_insumos_almacen_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authorized === null) {
    return (
      <div className="firmas-container" style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.6rem', marginBottom: '12px' }}></i>
        <p>Verificando permisos de acceso...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="firmas-container">
        <div className="firmas-header-card" style={{ borderLeftColor: '#ef4444' }}>
          <div>
            <h2 style={{ color: '#b91c1c' }}>
              <i className="fa-solid fa-lock"></i> Acceso Restringido
            </h2>
            <p>
              Este módulo de <strong>Firmas y Salida de Insumos de Almacén</strong> es exclusivo para{' '}
              <code>almacen@contexsas.com</code> y administradores autorizados.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="firmas-container">
      {/* Header */}
      <div className="firmas-header-card">
        <div>
          <h2>
            <i className="fa-solid fa-file-signature" style={{ color: '#209D88' }}></i>
            Salida de Insumos de Almacén — Firmas
          </h2>
          <p>
            Registra la entrega de insumos del almacén y captura la firma digital de recibido de cada colaborador.
          </p>
        </div>
        <div className="firmas-header-actions">
          <button type="button" className="btn-firmas-secondary" onClick={handleExportCsv}>
            <i className="fa-solid fa-file-excel" style={{ color: '#059669' }}></i> Exportar CSV
          </button>
          <button
            type="button"
            className="btn-firmas-primary"
            onClick={() => setShowForm((v) => !v)}
          >
            <i className={`fa-solid ${showForm ? 'fa-chevron-up' : 'fa-plus'}`}></i>
            {showForm ? 'Ocultar Formulario' : 'Nueva Salida de Insumos'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="firmas-kpi-grid">
        <div className="firmas-kpi-card">
          <div className="firmas-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <i className="fa-solid fa-boxes-stacked"></i>
          </div>
          <div>
            <div className="firmas-kpi-label">Total Salidas</div>
            <div className="firmas-kpi-value">{kpis.total}</div>
          </div>
        </div>
        <div className="firmas-kpi-card">
          <div className="firmas-kpi-icon" style={{ background: '#f0fdfa', color: '#0d9488' }}>
            <i className="fa-solid fa-calendar-day"></i>
          </div>
          <div>
            <div className="firmas-kpi-label">Salidas Hoy</div>
            <div className="firmas-kpi-value">{kpis.hoy}</div>
          </div>
        </div>
        <div className="firmas-kpi-card">
          <div className="firmas-kpi-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <i className="fa-solid fa-signature"></i>
          </div>
          <div>
            <div className="firmas-kpi-label">Firmadas</div>
            <div className="firmas-kpi-value">{kpis.firmadas}</div>
          </div>
        </div>
        <div className="firmas-kpi-card">
          <div className="firmas-kpi-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
            <i className="fa-solid fa-hourglass-half"></i>
          </div>
          <div>
            <div className="firmas-kpi-label">Pendientes de Firma</div>
            <div className="firmas-kpi-value">{kpis.pendientes}</div>
          </div>
        </div>
      </div>

      {/* Success notification */}
      {formSuccess && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #6ee7b7',
            color: '#065f46',
            padding: '14px 18px',
            borderRadius: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <i className="fa-solid fa-circle-check" style={{ fontSize: '1.1rem' }}></i>
          <span>{formSuccess}</span>
        </div>
      )}

      {/* New Dispatch Form */}
      {showForm && (
        <div className="firmas-form-card">
          <div className="firmas-form-title">
            <span>
              <i className="fa-solid fa-dolly" style={{ color: '#209D88', marginRight: '8px' }}></i>
              Registrar Salida de Insumos
            </span>
            <div className="firmas-mode-tabs">
              <button
                type="button"
                className={`firmas-mode-tab ${receiverMode === 'registrado' ? 'active' : ''}`}
                onClick={() => {
                  setReceiverMode('registrado');
                  setPersonaName('');
                  setPersonaCedula('');
                  setArea('');
                  setSelectedPersonaId('');
                }}
              >
                <i className="fa-solid fa-users" style={{ marginRight: '5px' }}></i>
                Colaborador Registrado
              </button>
              <button
                type="button"
                className={`firmas-mode-tab ${receiverMode === 'manual' ? 'active' : ''}`}
                onClick={() => {
                  setReceiverMode('manual');
                  setSelectedPersonaId('');
                }}
              >
                <i className="fa-solid fa-user-pen" style={{ marginRight: '5px' }}></i>
                Ingreso Manual / Externo
              </button>
            </div>
          </div>

          {/* Section 1: Receiver */}
          <div className="firmas-section-label">
            <i className="fa-solid fa-user-check"></i> 1. Datos de quien recibe
          </div>
          <div className="firmas-grid-3">
            <div className="firmas-field">
              <label>Colaborador / Receptor *</label>
              {receiverMode === 'registrado' ? (
                <SearchablePersonaSelect
                  value={selectedPersonaId}
                  onChange={handleSelectPersona}
                  personas={personas}
                  placeholder="-- Buscar colaborador por nombre o cédula --"
                />
              ) : (
                <input
                  type="text"
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  placeholder="Nombre completo de quien recibe"
                />
              )}
            </div>

            <div className="firmas-field">
              <label>Cédula / Documento</label>
              <input
                type="text"
                value={personaCedula}
                onChange={(e) => setPersonaCedula(e.target.value)}
                placeholder="Ej: 1002135024"
              />
            </div>

            <div className="firmas-field">
              <label>Área / Departamento destino</label>
              <input
                type="text"
                list="almacen-areas-list"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Ej: Telares, Producción, Contabilidad..."
              />
              <datalist id="almacen-areas-list">
                {areas.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Section 2: Supplies */}
          <div className="firmas-section-label">
            <i className="fa-solid fa-box-open"></i> 2. Insumos entregados
          </div>
          <div className="insumos-list-box">
            <datalist id="past-insumos-suggestions">
              {pastInsumoSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>

            <div
              className="insumo-row"
              style={{ marginBottom: '6px', fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}
            >
              <span>Descripción del Insumo *</span>
              <span>Cantidad *</span>
              <span>Unidad</span>
              <span></span>
            </div>

            {insumos.map((item, idx) => (
              <div className="insumo-row" key={idx}>
                <input
                  type="text"
                  list="past-insumos-suggestions"
                  value={item.descripcion}
                  onChange={(e) => handleInsumoChange(idx, 'descripcion', e.target.value)}
                  placeholder="Ej: Guantes de nitrilo, Cinta de embalaje, Resma papel carta..."
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    background: 'white',
                    fontSize: '0.9rem',
                  }}
                />
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={item.cantidad}
                  onChange={(e) => handleInsumoChange(idx, 'cantidad', e.target.value)}
                  style={{
                    padding: '10px 10px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    background: 'white',
                    fontSize: '0.9rem',
                    textAlign: 'center',
                    fontWeight: 600,
                  }}
                />
                <select
                  value={item.unidad}
                  onChange={(e) => handleInsumoChange(idx, 'unidad', e.target.value)}
                  style={{
                    padding: '10px 10px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    background: 'white',
                    fontSize: '0.88rem',
                  }}
                >
                  {UNIDADES_INSUMO.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-remove-row"
                  onClick={() => handleRemoveInsumoRow(idx)}
                  disabled={insumos.length === 1}
                  style={{ opacity: insumos.length === 1 ? 0.35 : 1 }}
                  title="Quitar ítem"
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
              </div>
            ))}

            <button type="button" className="btn-add-row" onClick={handleAddInsumoRow}>
              <i className="fa-solid fa-plus"></i> Agregar otro insumo
            </button>
          </div>

          {/* Observations */}
          <div className="firmas-field" style={{ marginBottom: '20px' }}>
            <label>Observaciones / Motivo de Salida (Opcional)</label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: Consumo semanal del área, reposición por desgaste, orden de producción #..."
            />
          </div>

          {/* Section 3: Digital Signature */}
          <div className="signature-pad-section">
            <div className="signature-pad-header">
              <div className="firmas-section-label" style={{ marginBottom: 0 }}>
                <i className="fa-solid fa-pen-nib"></i> 3. Firma Digital de Recibido
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-firmas-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={() => setShowExpandedPad(true)}
                >
                  <i className="fa-solid fa-expand"></i> Ampliar Lienzo
                </button>
                <button
                  type="button"
                  className="btn-firmas-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={() => {
                    sigCanvasRef.current?.clear();
                    setCapturedFormSignature(null);
                  }}
                >
                  <i className="fa-solid fa-eraser"></i> Limpiar Firma
                </button>
              </div>
            </div>

            {capturedFormSignature ? (
              <div
                style={{
                  background: 'white',
                  border: '2px solid #10b981',
                  borderRadius: '10px',
                  padding: '14px',
                  textAlign: 'center',
                }}
              >
                <img
                  src={capturedFormSignature}
                  alt="Firma capturada"
                  style={{ maxHeight: '140px', maxWidth: '100%', display: 'inline-block' }}
                />
                <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600, marginTop: '6px' }}>
                  <i className="fa-solid fa-circle-check"></i> Firma capturada lista para guardar
                </div>
              </div>
            ) : (
              <div ref={sigWrapRef} className="signature-canvas-wrapper">
                <SignatureCanvas
                  ref={sigCanvasRef}
                  penColor="#111827"
                  canvasProps={{
                    width: canvasWidth,
                    height: 175,
                    style: { display: 'block', width: '100%', height: '175px', cursor: 'crosshair' },
                  }}
                />
                <div className="signature-guide-line" />
                <div className="signature-guide-text">
                  Firme aquí con el mouse o el dedo para confirmar el recibido de los insumos
                </div>
              </div>
            )}
          </div>

          {formError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                color: '#b91c1c',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.88rem',
                fontWeight: 500,
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{formError}</span>
            </div>
          )}

          <div className="firmas-form-footer">
            <button type="button" className="btn-firmas-secondary" onClick={resetForm} disabled={saving}>
              Limpiar Todo
            </button>
            <button
              type="button"
              className="btn-save-pending"
              onClick={() => handleSaveSalida(false)}
              disabled={saving}
              title="Guarda la salida sin firma para que el colaborador firme al recoger"
            >
              <i className="fa-solid fa-clock"></i>
              {saving ? 'Guardando...' : 'Guardar Pendiente de Firma'}
            </button>
            <button
              type="button"
              className="btn-save-signed"
              onClick={() => handleSaveSalida(true)}
              disabled={saving}
            >
              <i className="fa-solid fa-check-double"></i>
              {saving ? 'Guardando...' : 'Guardar y Firmar Salida'}
            </button>
          </div>
        </div>
      )}

      {/* History List */}
      <div className="firmas-list-card">
        <div className="firmas-toolbar">
          <div className="firmas-search-bar">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por consecutivo, colaborador, cédula, área o insumo..."
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
              >
                ✕
              </button>
            )}
          </div>

          <div className="firmas-filter-pills">
            {(['Todas', 'Firmado', 'Pendiente'] as const).map((st) => (
              <button
                key={st}
                type="button"
                className={`filter-pill ${statusFilter === st ? 'active' : ''}`}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'Todas' ? 'Todas' : st === 'Firmado' ? 'Firmadas' : 'Pendientes'}
              </button>
            ))}
            <button
              type="button"
              className={`filter-pill ${onlyToday ? 'active' : ''}`}
              onClick={() => setOnlyToday((v) => !v)}
            >
              <i className="fa-solid fa-calendar-day" style={{ marginRight: '5px' }}></i>
              Hoy
            </button>
          </div>
        </div>

        <div className="firmas-table-container">
          <table className="firmas-table">
            <thead>
              <tr>
                <th>Consecutivo / Fecha</th>
                <th>Recibido Por</th>
                <th>Insumos Entregados</th>
                <th>Estado / Firma</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredSalidas.length > 0 ? (
                filteredSalidas.map((item) => {
                  const isSigned = Boolean(item.firmaReceptor);
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{item.consecutivo}</strong>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                          {formatDate(item.fechaSalida)}
                        </div>
                      </td>
                      <td>
                        <strong>{item.personaName}</strong>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                          {item.personaCedula && item.personaCedula !== 'N/A' ? `C.C. ${item.personaCedula}` : ''}
                          {item.personaCedula && item.personaCedula !== 'N/A' && item.area ? ' • ' : ''}
                          {item.area || ''}
                        </div>
                      </td>
                      <td>
                        <div className="insumo-chip-list">
                          {(item.insumos || []).map((ins, i) => (
                            <div className="insumo-chip" key={i}>
                              <span className="insumo-qty-badge">
                                {ins.cantidad} {ins.unidad}
                              </span>
                              <span>{ins.descripcion}</span>
                            </div>
                          ))}
                        </div>
                        {item.observaciones && (
                          <div style={{ fontSize: '0.76rem', color: '#6b7280', marginTop: '4px', fontStyle: 'italic' }}>
                            Obs: {item.observaciones}
                          </div>
                        )}
                      </td>
                      <td>
                        {isSigned ? (
                          <div>
                            <span className="badge-firma-ok">
                              <i className="fa-solid fa-check"></i> Firmado
                            </span>
                            <img
                              src={item.firmaReceptor!}
                              alt="Firma receptor"
                              className="firma-thumb"
                              title="Clic para ver comprobante"
                              onClick={() => setReceiptRecord(item)}
                            />
                          </div>
                        ) : (
                          <span className="badge-firma-pending">
                            <i className="fa-solid fa-clock"></i> Pendiente
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          {!isSigned && (
                            <button
                              type="button"
                              className="btn-tbl btn-tbl-sign"
                              onClick={() => {
                                setModalSigError('');
                                setSigningRecord(item);
                              }}
                              title="Capturar firma ahora"
                            >
                              <i className="fa-solid fa-pen-nib"></i> Firmar
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-tbl"
                            onClick={() => setReceiptRecord(item)}
                            title="Ver o imprimir comprobante"
                          >
                            <i className="fa-solid fa-print"></i> Comprobante
                          </button>
                          <button
                            type="button"
                            className="btn-tbl btn-tbl-delete"
                            onClick={() => handleDeleteSalida(item)}
                            title="Eliminar registro"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#6b7280' }}>
                    {search || statusFilter !== 'Todas' || onlyToday
                      ? 'No se encontraron salidas de insumos con los filtros aplicados.'
                      : 'Aún no hay salidas de insumos registradas. Crea la primera en el formulario superior.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expanded Signature Modal (for Creation Form) */}
      {showExpandedPad && (
        <div className="firmas-modal-overlay">
          <div className="firmas-modal-content" style={{ maxWidth: '680px' }}>
            <div className="firmas-modal-header">
              <h3>
                <i className="fa-solid fa-pen-nib" style={{ color: '#209D88', marginRight: '8px' }}></i>
                Firma Digital del Colaborador {personaName ? `— ${personaName}` : ''}
              </h3>
              <button type="button" className="firmas-modal-close" onClick={() => setShowExpandedPad(false)}>
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#4b5563', marginBottom: '12px' }}>
              Dibuje su firma en el recuadro amplio usando el dedo o el mouse y luego haga clic en <strong>Usar esta Firma</strong>.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <ResponsiveSignatureBox
                sigRef={expandedSigRef}
                height={240}
                guideText="Firme sobre la línea"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-firmas-secondary"
                onClick={() => expandedSigRef.current?.clear()}
              >
                <i className="fa-solid fa-eraser"></i> Limpiar
              </button>
              <button
                type="button"
                className="btn-save-signed"
                onClick={() => {
                  const data = getSafeSignatureDataUrl(expandedSigRef);
                  if (!data) {
                    alert('Por favor dibuje una firma antes de continuar.');
                    return;
                  }
                  setCapturedFormSignature(data);
                  setShowExpandedPad(false);
                }}
              >
                <i className="fa-solid fa-check"></i> Usar esta Firma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Sign Pending Record */}
      {signingRecord && (
        <div className="firmas-modal-overlay">
          <div className="firmas-modal-content" style={{ maxWidth: '640px' }}>
            <div className="firmas-modal-header">
              <h3>
                <i className="fa-solid fa-signature" style={{ color: '#059669', marginRight: '8px' }}></i>
                Firmar Salida {signingRecord.consecutivo}
              </h3>
              <button
                type="button"
                className="firmas-modal-close"
                onClick={() => setSigningRecord(null)}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '16px',
                fontSize: '0.88rem',
              }}
            >
              <div>
                <strong>Receptor:</strong> {signingRecord.personaName}{' '}
                {signingRecord.personaCedula && signingRecord.personaCedula !== 'N/A'
                  ? `(C.C. ${signingRecord.personaCedula})`
                  : ''}
              </div>
              <div style={{ marginTop: '4px' }}>
                <strong>Área:</strong> {signingRecord.area}
              </div>
              <div style={{ marginTop: '8px' }}>
                <strong>Insumos recibidos:</strong>
                <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                  {(signingRecord.insumos || []).map((ins, i) => (
                    <li key={i}>
                      <strong>
                        {ins.cantidad} {ins.unidad}
                      </strong>{' '}
                      — {ins.descripcion}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <ResponsiveSignatureBox
                sigRef={modalSigRef}
                height={220}
                guideText="Firma de recibido conforme"
              />
            </div>

            {modalSigError && (
              <p style={{ color: '#dc2626', fontSize: '0.86rem', marginBottom: '12px' }}>{modalSigError}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-firmas-secondary"
                onClick={() => modalSigRef.current?.clear()}
                disabled={savingModalSig}
              >
                <i className="fa-solid fa-eraser"></i> Limpiar
              </button>
              <button
                type="button"
                className="btn-save-signed"
                onClick={handleConfirmPendingSignature}
                disabled={savingModalSig}
              >
                <i className="fa-solid fa-check"></i>
                {savingModalSig ? 'Guardando...' : 'Confirmar Firma'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Printable Receipt */}
      {receiptRecord && (
        <div className="firmas-modal-overlay">
          <div className="firmas-modal-content printable-receipt-root">
            <div className="firmas-modal-header no-print">
              <h3>Comprobante de Salida — {receiptRecord.consecutivo}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-firmas-primary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                  onClick={() => window.print()}
                >
                  <i className="fa-solid fa-print"></i> Imprimir / PDF
                </button>
                <button
                  type="button"
                  className="firmas-modal-close"
                  onClick={() => setReceiptRecord(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="receipt-sheet">
              <div className="receipt-header">
                <div>
                  <img
                    src="/img/logo-contexsas.png"
                    alt="Contexsas Logo"
                    style={{ height: '48px', objectFit: 'contain' }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '4px' }}>
                    COMPAÑÍA NACIONAL DE TEXTILES S.A.S.
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#111827' }}>
                    COMPROBANTE DE SALIDA DE INSUMOS
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0d9488', marginTop: '4px' }}>
                    N° {receiptRecord.consecutivo}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: '2px' }}>
                    Fecha: {formatDate(receiptRecord.fechaSalida)}
                  </div>
                </div>
              </div>

              <div className="receipt-meta-grid">
                <div>
                  <strong>Recibido por:</strong> {receiptRecord.personaName}
                </div>
                <div>
                  <strong>Documento / C.C.:</strong> {receiptRecord.personaCedula || 'N/A'}
                </div>
                <div>
                  <strong>Área / Destino:</strong> {receiptRecord.area || 'Sin área'}
                </div>
                <div>
                  <strong>Entregado por:</strong> {receiptRecord.entregadoPorNombre || 'Almacén'}
                </div>
              </div>

              <table className="receipt-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                    <th>Descripción del Insumo</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Cantidad</th>
                    <th style={{ width: '120px' }}>Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {(receiptRecord.insumos || []).map((ins, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td>{ins.descripcion}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{ins.cantidad}</td>
                      <td>{ins.unidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {receiptRecord.observaciones && (
                <div
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '16px',
                    fontSize: '0.86rem',
                  }}
                >
                  <strong>Observaciones:</strong> {receiptRecord.observaciones}
                </div>
              )}

              <p style={{ fontSize: '0.8rem', color: '#4b5563', lineHeight: 1.45 }}>
                Hago constar que he recibido a satisfacción del Almacén de la empresa los insumos relacionados
                en el presente comprobante, para uso exclusivo en las labores asignadas.
              </p>

              <div className="receipt-signatures">
                <div className="receipt-sig-box">
                  <div className="receipt-sig-img-wrap">
                    <span style={{ fontSize: '0.82rem', color: '#6b7280', fontStyle: 'italic' }}>
                      Despacho de Almacén
                    </span>
                  </div>
                  <div className="receipt-sig-line">
                    <strong>Entregado por:</strong>
                    <div>{receiptRecord.entregadoPorNombre || 'Almacén'}</div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{receiptRecord.entregadoPorEmail}</div>
                  </div>
                </div>

                <div className="receipt-sig-box">
                  <div className="receipt-sig-img-wrap">
                    {receiptRecord.firmaReceptor ? (
                      <img
                        src={receiptRecord.firmaReceptor}
                        alt="Firma Receptor"
                        style={{ maxHeight: '72px', maxWidth: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#d97706' }}>(Pendiente de firma)</span>
                    )}
                  </div>
                  <div className="receipt-sig-line">
                    <strong>Recibido Conforme por:</strong>
                    <div>{receiptRecord.personaName}</div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                      C.C. {receiptRecord.personaCedula || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
