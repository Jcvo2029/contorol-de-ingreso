"use client";
import React, { useState, useEffect } from 'react';
import { updateProfile, updatePassword } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import './perfil.css';

export default function PerfilPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cedula, setCedula] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        setEmail(user.email || '');
        // Try to get name from local storage first
        const stored = localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          setName(parsed.name || user.displayName || '');
          setCedula(parsed.cedula || '');
        } else {
          setName(user.displayName || '');
        }
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

      // Update name in Firebase Auth
      if (name.trim()) {
        await updateProfile(user, { displayName: name.trim() });
      }
        
      // Update name and cedula in Firestore users collection
      try {
        const q = query(collection(db, 'users'), where('email', '==', user.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(doc(db, 'users', snap.docs[0].id), {
            name: name.trim(),
            cedula: cedula.trim()
          });
        } else {
          await addDoc(collection(db, 'users'), {
            email: user.email,
            name: name.trim(),
            cedula: cedula.trim(),
            role: 'Empleado',
            createdAt: serverTimestamp()
          });
        }
      } catch (e) {
        console.error('Error updating Firestore user doc:', e);
      }

      // Update local storage
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.name = name.trim();
        parsed.cedula = cedula.trim();
        localStorage.setItem('user', JSON.stringify(parsed));
      } else {
        localStorage.setItem('user', JSON.stringify({ name: name.trim(), cedula: cedula.trim(), email: user.email }));
      }

      // Removed password update logic
      
      setSuccess('Perfil actualizado correctamente.');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setError('Por seguridad, debes cerrar sesión y volver a entrar para cambiar la contraseña.');
      } else {
        setError(err.message || 'Hubo un error al actualizar el perfil.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="perfil-container">
      <div className="perfil-card">
        <h2><i className="fa-solid fa-id-badge"></i> Mi Perfil</h2>
        <p>Actualiza tu información personal y contraseña.</p>

        {success && <div className="alert-success">{success}</div>}
        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleUpdate} className="perfil-form">
          <div className="form-group">
            <label>Correo Electrónico (Solo Lectura)</label>
            <input type="email" value={email} disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }} />
          </div>

          <div className="form-group">
            <label>Nombre de Usuario</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Tu nombre completo"
            />
          </div>

          <div className="form-group">
            <label>Cédula de Ciudadanía (C.C.)</label>
            <input 
              type="text" 
              value={cedula} 
              onChange={(e) => setCedula(e.target.value)} 
              placeholder="Ej: 123456789"
            />
          </div>

          <button type="submit" className="btn-save" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>
      </div>
    </div>
  );
}
