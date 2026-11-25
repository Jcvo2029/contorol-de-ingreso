"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument, degrees } from 'pdf-lib';
import './firmas.css';

const ALMACEN_EMAIL = 'almacen@contexsas.com';

interface PlacedSignature {
  id: string;
  page: number; // 1-indexed
  dataUrl: string;
  xPct: number; // 0..1 relative to rendered page width
  yPct: number; // 0..1 relative to rendered page height
  wPct: number; // 0..1 relative to rendered page width
  hPct: number; // 0..1 relative to rendered page height
  aspectRatio: number; // width / height
}

function getTrimmedPng(sigRef: React.RefObject<SignatureCanvas | null>): { dataUrl: string; aspectRatio: number } | null {
  const sig = sigRef.current;
  if (!sig || sig.isEmpty()) return null;
  try {
    const trimmed = sig.getTrimmedCanvas();
    const w = trimmed.width || 300;
    const h = trimmed.height || 100;
    return {
      dataUrl: trimmed.toDataURL('image/png'),
      aspectRatio: w / h,
    };
  } catch {
    const raw = sig.getCanvas();
    return {
      dataUrl: raw.toDataURL('image/png'),
      aspectRatio: (raw.width || 300) / (raw.height || 120),
    };
  }
}

export default function FirmasDocumentosPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  // File state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileKind, setFileKind] = useState<'pdf' | 'image' | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/png');
  const [loadingFile, setLoadingFile] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Rendered document refs
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const docContainerRef = useRef<HTMLDivElement | null>(null);

  // Signatures placed on document
  const [signatures, setSignatures] = useState<PlacedSignature[]>([]);
  const [activeSigId, setActiveSigId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Signature pad modal (fullscreen)
  const [showSignModal, setShowSignModal] = useState(false);
  const sigPadRef = useRef<SignatureCanvas | null>(null);
  const sigPadWrapRef = useRef<HTMLDivElement | null>(null);
  const [padSize, setPadSize] = useState({ width: 1200, height: 650 });
  const [padError, setPadError] = useState('');

  const openSignModal = async () => {
    setPadError('');
    setShowSignModal(true);
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Browser may decline fullscreen without strict gesture; viewport-fixed 100vw x 100dvh still fills entire window
    }
  };

  const closeSignModal = async () => {
    setShowSignModal(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {}
  };

  // Drag / Resize interaction state
  const dragStateRef = useRef<{
    type: 'move' | 'resize';
    sigId: string;
    startX: number;
    startY: number;
    origXPct: number;
    origYPct: number;
    origWPct: number;
    origHPct: number;
    aspectRatio: number;
    containerW: number;
    containerH: number;
  } | null>(null);

  // Strict access check: ONLY almacen@contexsas.com (Almacén) and Admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setAuthorized(false);
        return;
      }

      const emailLower = (fbUser.email || '').toLowerCase();
      let role = emailLower === ALMACEN_EMAIL ? 'Almacén' : 'Empleado';

      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (emailLower !== ALMACEN_EMAIL && parsed.role) role = parsed.role;
        } catch {}
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (emailLower !== ALMACEN_EMAIL && data.role) role = data.role;
        }
      } catch (err) {
        console.warn('Error verificando rol de usuario:', err);
      }

      setAuthorized(emailLower === ALMACEN_EMAIL || role === 'Almacén' || role === 'Admin');
    });

    return () => unsubscribe();
  }, []);

  // Measure fullscreen signature canvas container (width & height) so USB signature pads & touch stay 1:1 pixel-accurate
  useEffect(() => {
    if (!showSignModal) return;
    const syncSize = () => {
      if (sigPadWrapRef.current) {
        const w = Math.floor(sigPadWrapRef.current.clientWidth);
        const h = Math.floor(sigPadWrapRef.current.clientHeight);
        if (w > 100 && h > 100) {
          setPadSize({ width: w, height: h });
        }
      }
    };
    syncSize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncSize) : null;
    if (ro && sigPadWrapRef.current) {
      ro.observe(sigPadWrapRef.current);
    }
    window.addEventListener('resize', syncSize);
    document.addEventListener('fullscreenchange', syncSize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', syncSize);
      document.removeEventListener('fullscreenchange', syncSize);
    };
  }, [showSignModal]);

  // Render active PDF page whenever pdfDocProxy or currentPage changes
  useEffect(() => {
    if (fileKind !== 'pdf' || !pdfDocProxy) return;
    let cancelled = false;
    let renderTask: any = null;

    const renderPage = async () => {
      try {
        const page = await pdfDocProxy.getPage(currentPage);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        // Render crisp high-resolution canvas fitting desktop nicely (~860px wide)
        const targetWidth = Math.min(880, Math.max(600, window.innerWidth - 100));
        const scale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = pdfCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Error renderizando página PDF:', err);
          setErrorMsg('No se pudo renderizar esta página del PDF.');
        }
      }
    };

    renderPage();
    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {}
    };
  }, [fileKind, pdfDocProxy, currentPage]);

  // Global pointer move/up listeners for dragging and resizing signatures
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const st = dragStateRef.current;
      if (!st) return;

      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;

      if (st.type === 'move') {
        const nextX = Math.max(0, Math.min(1 - st.origWPct, st.origXPct + dx / st.containerW));
        const nextY = Math.max(0, Math.min(1 - st.origHPct, st.origYPct + dy / st.containerH));
        setSignatures((prev) =>
          prev.map((s) => (s.id === st.sigId ? { ...s, xPct: nextX, yPct: nextY } : s))
        );
      } else {
        const origWpx = st.origWPct * st.containerW;
        const newWpx = Math.max(55, Math.min(st.containerW * (1 - st.origXPct), origWpx + dx));
        const newHpx = newWpx / st.aspectRatio;
        const maxHpx = st.containerH * (1 - st.origYPct);
        const clampedHpx = Math.min(newHpx, maxHpx);
        const clampedWpx = clampedHpx * st.aspectRatio;

        setSignatures((prev) =>
          prev.map((s) =>
            s.id === st.sigId
              ? {
                  ...s,
                  wPct: clampedWpx / st.containerW,
                  hPct: clampedHpx / st.containerH,
                }
              : s
          )
        );
      }
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const loadSelectedFile = useCallback(async (file: File) => {
    setErrorMsg('');
    setLoadingFile(true);
    setSignatures([]);
    setActiveSigId(null);

    try {
      const lower = file.name.toLowerCase();
      const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf');
      const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(lower);

      if (!isPdf && !isImg) {
        setErrorMsg('Formato no compatible. Selecciona un archivo PDF o una imagen (PNG, JPG).');
        setLoadingFile(false);
        return;
      }

      if (isPdf) {
        const arrayBuf = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        // Clone bytes for pdf.js because pdf.js may transfer/detach its ArrayBuffer to the worker
        const bytesForViewer = bytes.slice();

        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const loadingTask = pdfjsLib.getDocument({ data: bytesForViewer });
        const docProxy = await loadingTask.promise;

        setPdfBytes(bytes);
        setPdfDocProxy(docProxy);
        setNumPages(docProxy.numPages);
        setCurrentPage(1);
        setImageUrl(null);
        setFileKind('pdf');
        setFileName(file.name);
      } else {
        const reader = new FileReader();
        const dataUrl: string = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
          reader.readAsDataURL(file);
        });
        setImageUrl(dataUrl);
        setImageMime(file.type || 'image/png');
        setPdfBytes(null);
        setPdfDocProxy(null);
        setNumPages(1);
        setCurrentPage(1);
        setFileKind('image');
        setFileName(file.name);
      }
    } catch (err: any) {
      console.error('Error cargando archivo:', err);
      setErrorMsg('No se pudo abrir el archivo seleccionado. Verifica que no esté dañado o protegido con contraseña.');
    } finally {
      setLoadingFile(false);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadSelectedFile(file);
    }
    // Reset input value so selecting the same file again still triggers onChange
    e.target.value = '';
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadSelectedFile(file);
  };

  const handleInsertSignature = () => {
    setPadError('');
    const result = getTrimmedPng(sigPadRef);
    if (!result) {
      setPadError('Por favor dibuje su firma en el recuadro antes de insertar.');
      return;
    }

    const container = docContainerRef.current;
    const containerW = container?.clientWidth || 800;
    const containerH = container?.clientHeight || 1050;

    // Default signature size: ~24% of page width, preserving aspect ratio
    const defaultWpx = Math.min(220, containerW * 0.28);
    const defaultHpx = defaultWpx / result.aspectRatio;
    const wPct = Math.min(0.45, defaultWpx / containerW);
    const hPct = Math.min(0.25, defaultHpx / containerH);

    const newSig: PlacedSignature = {
      id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      page: currentPage,
      dataUrl: result.dataUrl,
      xPct: Math.max(0.05, 0.5 - wPct / 2),
      yPct: Math.max(0.05, 0.78 - hPct / 2),
      wPct,
      hPct,
      aspectRatio: result.aspectRatio,
    };

    setSignatures((prev) => [...prev, newSig]);
    setActiveSigId(newSig.id);
    closeSignModal();
  };

  const startSigInteraction = (
    e: React.PointerEvent,
    sig: PlacedSignature,
    type: 'move' | 'resize'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const container = docContainerRef.current;
    if (!container) return;

    setActiveSigId(sig.id);
    dragStateRef.current = {
      type,
      sigId: sig.id,
      startX: e.clientX,
      startY: e.clientY,
      origXPct: sig.xPct,
      origYPct: sig.yPct,
      origWPct: sig.wPct,
      origHPct: sig.hPct,
      aspectRatio: sig.aspectRatio,
      containerW: container.clientWidth,
      containerH: container.clientHeight,
    };
  };

  const buildSignedPdfBytes = async (): Promise<Uint8Array> => {
    if (fileKind === 'pdf' && pdfBytes) {
      const pdfDoc = await PDFDocument.load(pdfBytes);

      for (const sig of signatures) {
        const pageIndex = sig.page - 1;
        if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue;
        const page = pdfDoc.getPage(pageIndex);
        const { width, height } = page.getSize();
        const rotAngle = ((page.getRotation().angle % 360) + 360) % 360;

        const pngImage = await pdfDoc.embedPng(sig.dataUrl);

        if (rotAngle === 0) {
          const drawW = sig.wPct * width;
          const drawH = sig.hPct * height;
          const drawX = sig.xPct * width;
          const drawY = height - (sig.yPct + sig.hPct) * height;
          page.drawImage(pngImage, { x: drawX, y: drawY, width: drawW, height: drawH });
        } else if (rotAngle === 90) {
          // Visual width = height, visual height = width
          const drawW = sig.wPct * height;
          const drawH = sig.hPct * width;
          const drawX = (sig.yPct + sig.hPct) * width;
          const drawY = (1 - sig.xPct) * height - drawW;
          page.drawImage(pngImage, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
            rotate: degrees(90),
          });
        } else if (rotAngle === 270) {
          const drawW = sig.wPct * height;
          const drawH = sig.hPct * width;
          const drawX = width - (sig.yPct + sig.hPct) * width;
          const drawY = sig.xPct * height + drawW;
          page.drawImage(pngImage, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
            rotate: degrees(-90),
          });
        } else {
          // 180 deg
          const drawW = sig.wPct * width;
          const drawH = sig.hPct * height;
          const drawX = width - sig.xPct * width;
          const drawY = (sig.yPct + sig.hPct) * height;
          page.drawImage(pngImage, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
            rotate: degrees(180),
          });
        }
      }

      return await pdfDoc.save();
    }

    if (fileKind === 'image' && imageUrl) {
      const pdfDoc = await PDFDocument.create();
      let embeddedBase;

      if (imageMime === 'image/jpeg' || imageMime === 'image/jpg') {
        embeddedBase = await pdfDoc.embedJpg(imageUrl);
      } else if (imageMime === 'image/png') {
        embeddedBase = await pdfDoc.embedPng(imageUrl);
      } else {
        // Convert WebP or other image format to PNG via offscreen canvas
        const img = new Image();
        img.src = imageUrl;
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
        });
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d')?.drawImage(img, 0, 0);
        embeddedBase = await pdfDoc.embedPng(c.toDataURL('image/png'));
      }

      const { width, height } = embeddedBase.scale(1);
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(embeddedBase, { x: 0, y: 0, width, height });

      for (const sig of signatures) {
        const pngImage = await pdfDoc.embedPng(sig.dataUrl);
        const drawW = sig.wPct * width;
        const drawH = sig.hPct * height;
        const drawX = sig.xPct * width;
        const drawY = height - (sig.yPct + sig.hPct) * height;
        page.drawImage(pngImage, { x: drawX, y: drawY, width: drawW, height: drawH });
      }

      return await pdfDoc.save();
    }

    throw new Error('No hay documento cargado.');
  };

  const handleDownloadSigned = async () => {
    if (signatures.length === 0) {
      alert('Primero dibuja e inserta al menos una firma en el documento.');
      return;
    }
    setExporting(true);
    try {
      const bytes = await buildSignedPdfBytes();
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const baseName = fileName.replace(/\.[^.]+$/, '') || 'documento';
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_firmado.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err: any) {
      console.error('Error exportando PDF firmado:', err);
      alert('Error al generar el PDF firmado: ' + (err.message || 'Error desconocido'));
    } finally {
      setExporting(false);
    }
  };

  const handlePrintSigned = async () => {
    setExporting(true);
    try {
      const bytes = await buildSignedPdfBytes();
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        // Fallback if popups are blocked: download directly
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      console.error('Error preparando impresión:', err);
      alert('No se pudo preparar el archivo para imprimir.');
    } finally {
      setExporting(false);
    }
  };

  const currentPageSignatures = signatures.filter((s) => s.page === currentPage);

  if (authorized === null) {
    return (
      <div className="firmas-wrapper" style={{ alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.6rem', marginBottom: '10px' }}></i>
        <p>Verificando acceso...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="firmas-wrapper">
        <div className="firmas-restricted-card">
          <h2 style={{ margin: '0 0 8px 0', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-lock"></i> Acceso Restringido
          </h2>
          <p style={{ margin: 0, color: '#4b5563' }}>
            Este módulo es exclusivo para <strong>almacen@contexsas.com</strong> y administradores autorizados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="firmas-wrapper">
      {/* Hidden native Windows File Explorer input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />

      {!fileKind ? (
        /* Initial clean view: ONLY the button to select the file to sign */
        <div className="firmas-picker-center">
          <div
            className={`firmas-dropzone-card ${isDraggingFile ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={handleDropFile}
          >
            <div className="firmas-dropzone-icon">
              <i className="fa-solid fa-file-signature"></i>
            </div>

            <h2>Firmar Documento</h2>
            <p>
              Selecciona el archivo de salida de insumos desde tu computador para agregarle la firma digital.
            </p>

            <button
              type="button"
              className="btn-elegir-archivo"
              onClick={() => fileInputRef.current?.click()}
              disabled={loadingFile}
            >
              {loadingFile ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Cargando archivo...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-folder-open"></i> Elegir archivo a firmar
                </>
              )}
            </button>

            <span className="firmas-hint-formats">
              Compatible con archivos PDF e imágenes (PNG, JPG) — o arrastra el archivo aquí
            </span>

            {errorMsg && (
              <div className="firmas-error-banner" style={{ width: '100%', textAlign: 'left' }}>
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Active signing workspace */
        <div className="firmas-workspace">
          <div className="firmas-toolbar">
            <div className="firmas-file-info">
              <div className="firmas-file-badge" title={fileName}>
                <i
                  className={`fa-solid ${fileKind === 'pdf' ? 'fa-file-pdf' : 'fa-file-image'}`}
                  style={{ color: fileKind === 'pdf' ? '#dc2626' : '#2563eb' }}
                ></i>
                <span>{fileName}</span>
              </div>

              {fileKind === 'pdf' && numPages > 1 && (
                <div className="firmas-page-nav">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    title="Página anterior"
                  >
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>
                  <span style={{ padding: '0 6px' }}>
                    Página {currentPage} de {numPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= numPages}
                    onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                    title="Página siguiente"
                  >
                    <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              )}
            </div>

            <div className="firmas-toolbar-actions">
              <button
                type="button"
                className="btn-ws btn-ws-sign"
                onClick={openSignModal}
              >
                <i className="fa-solid fa-pen-nib"></i> Dibujar Firma
              </button>

              <button
                type="button"
                className="btn-ws"
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="fa-solid fa-folder-open"></i> Cambiar archivo
              </button>

              <button
                type="button"
                className="btn-ws"
                onClick={handlePrintSigned}
                disabled={exporting}
                title="Abrir PDF firmado para imprimir"
              >
                <i className="fa-solid fa-print"></i> Imprimir
              </button>

              <button
                type="button"
                className="btn-ws btn-ws-download"
                onClick={handleDownloadSigned}
                disabled={exporting || signatures.length === 0}
              >
                <i className={`fa-solid ${exporting ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
                {exporting ? 'Generando...' : 'Descargar Firmado'}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="firmas-error-banner">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="firmas-tip-bar">
            <span>
              <i className="fa-solid fa-circle-info" style={{ marginRight: '6px' }}></i>
              {signatures.length === 0
                ? 'Haz clic en "Dibujar Firma" para agregar una firma sobre el documento.'
                : 'Arrastra la firma para ubicarla sobre la línea y ajusta su tamaño desde la esquina verde. Luego haz clic en "Descargar Firmado".'}
            </span>
            {signatures.length > 0 && (
              <span style={{ fontWeight: 700 }}>
                {signatures.length} {signatures.length === 1 ? 'firma agregada' : 'firmas agregadas'}
              </span>
            )}
          </div>

          {/* Document Preview & Draggable Signatures */}
          <div
            className="firmas-stage-scroll"
            onClick={() => setActiveSigId(null)}
          >
            <div ref={docContainerRef} className="firmas-doc-container">
              {fileKind === 'pdf' ? (
                <canvas ref={pdfCanvasRef} className="firmas-doc-canvas" />
              ) : (
                imageUrl && <img src={imageUrl} alt={fileName} className="firmas-doc-image" />
              )}

              {currentPageSignatures.map((sig) => (
                <div
                  key={sig.id}
                  className={`placed-signature ${activeSigId === sig.id ? 'active' : ''}`}
                  style={{
                    left: `${sig.xPct * 100}%`,
                    top: `${sig.yPct * 100}%`,
                    width: `${sig.wPct * 100}%`,
                    height: `${sig.hPct * 100}%`,
                  }}
                  onPointerDown={(e) => startSigInteraction(e, sig, 'move')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <img src={sig.dataUrl} alt="Firma" draggable={false} />
                  <button
                    type="button"
                    className="sig-delete-btn"
                    title="Quitar firma"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSignatures((prev) => prev.filter((item) => item.id !== sig.id));
                    }}
                  >
                    ✕
                  </button>
                  <div
                    className="sig-resize-handle"
                    title="Arrastra para cambiar el tamaño"
                    onPointerDown={(e) => startSigInteraction(e, sig, 'resize')}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Draw Signature Overlay */}
      {showSignModal && (
        <div className="firmas-modal-overlay">
          <div className="firmas-modal-content">
            <div className="firmas-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h3>
                  <i className="fa-solid fa-pen-nib" style={{ color: '#209D88' }}></i>
                  Área de Firma — Pantalla Completa
                </h3>
                {padError && (
                  <span style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '4px' }}></i>
                    {padError}
                  </span>
                )}
              </div>

              <div className="firmas-modal-footer">
                <button
                  type="button"
                  className="btn-ws"
                  onClick={() => {
                    sigPadRef.current?.clear();
                    setPadError('');
                  }}
                >
                  <i className="fa-solid fa-eraser"></i> Limpiar
                </button>
                <button
                  type="button"
                  className="btn-ws btn-ws-download"
                  onClick={handleInsertSignature}
                >
                  <i className="fa-solid fa-check"></i> Insertar Firma en el Documento
                </button>
                <button
                  type="button"
                  className="firmas-modal-close"
                  onClick={closeSignModal}
                  title="Cerrar"
                >
                  ✕
                </button>
              </div>
            </div>

            <div ref={sigPadWrapRef} className="signature-canvas-wrapper">
              <SignatureCanvas
                ref={sigPadRef}
                penColor="#111827"
                minWidth={2.2}
                maxWidth={4.5}
                clearOnResize={false}
                canvasProps={{
                  width: padSize.width,
                  height: padSize.height,
                  style: {
                    display: 'block',
                    width: `${padSize.width}px`,
                    height: `${padSize.height}px`,
                    cursor: 'crosshair',
                  },
                }}
              />
              <div className="signature-guide-line" />
              <div className="signature-guide-text">
                Firme en cualquier lugar de la pantalla con la tableta de firmas, mouse o dedo
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
