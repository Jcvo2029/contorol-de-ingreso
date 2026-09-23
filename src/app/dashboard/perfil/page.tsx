"use client";
import React, { useState, useEffect } from 'react';
import { updateProfile } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import './perfil.css';

export default function PerfilPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cedula, setCedula] = useState('');
  const [area, setArea] = useState('');
  const [linkedPersona, setLinkedPersona] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setEmail(user.email || '');

        // Load from localStorage first (fast)
        const stored = localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          setName(parsed.name || user.displayName || '');
          setCedula(parsed.cedula || '');
          setArea(parsed.area || '');
        }

        // Then look up in personas collection by email (source of truth)
        try {
          const qPersona = query(collection(db, 'personas'), where('email', '==', user.email));
          const snapPersona = await getDocs(qPersona);
          if (!snapPersona.empty) {
            const personaData = snapPersona.docs[0].data();
            setLinkedPersona(personaData);
            setName(personaData.name || '');
            setCedula(personaData.idNumber || '');
            setArea(personaData.area || '');

            // Sync to localStorage
            const stored2 = localStorage.getItem('user');
            const parsed2 = stored2 ? JSON.parse(stored2) : {};
            parsed2.name = personaData.name || parsed2.name;
            parsed2.cedula = personaData.idNumber || parsed2.cedula;
            parsed2.area = personaData.area || parsed2.area;
            localStorage.setItem('user', JSON.stringify(parsed2));
          }
        } catch (err) {
          console.error('Error fetching persona:', err);
        }
        
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No hay sesión activa.");

      // Update displayName in Firebase Auth
      if (name.trim()) {
        await updateProfile(user, { displayName: name.trim() });
      }

      // Update local storage
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.name = name.trim();
        parsed.cedula = cedula.trim();
        localStorage.setItem('user', JSON.stringify(parsed));
      }

      setSuccess('Perfil guardado correctamente.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Hubo un error al actualizar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="perfil-container">
      <div className="perfil-card">
        <h2><i className="fa-solid fa-id-badge"></i> Mi Perfil</h2>
        <p>Información de tu cuenta. Los datos personales (nombre, cédula, área) se sincronizan automáticamente desde el registro de empleados.</p>

        {success && <div className="alert-success">{success}</div>}
        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleUpdate} className="perfil-form">
          <div className="form-group">
            <label>Correo Electrónico (Solo Lectura)</label>
            <input type="email" value={email} disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }} />
          </div>

          <div className="form-group">
            <label>
              Nombre Completo
              {linkedPersona && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#10b981', fontWeight: 'normal' }}><i className="fa-solid fa-link"></i> Vinculado al registro de empleados</span>}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre completo"
              style={linkedPersona ? { backgroundColor: '#f0fdf4', borderColor: '#86efac' } : {}}
              readOnly={!!linkedPersona}
            />
          </div>

          <div className="form-group">
            <label>Cédula de Ciudadanía (C.C.)</label>
            <input
              type="text"
              value={cedula}
              disabled={!!linkedPersona}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="Ej: 123456789"
              style={linkedPersona ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {}}
            />
            {linkedPersona && <small style={{ color: '#6b7280' }}>Para modificar la cédula, contacta al administrador del sistema.</small>}
          </div>

          {area && (
            <div className="form-group">
              <label>Área / Departamento</label>
              <input
                type="text"
                value={area}
                disabled
                style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
              />
            </div>
          )}

          {!linkedPersona && (
            <button type="submit" className="btn-save" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          )}

          {linkedPersona && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
              <p style={{ color: '#065f46', fontSize: '0.9rem', margin: 0 }}>
                <i className="fa-solid fa-circle-check" style={{ marginRight: '8px' }}></i>
                Tu perfil está vinculado a tu registro como empleado. Los datos se actualizan automáticamente cuando el administrador los modifica.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
