"use client";
import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import './usuarios.css';

interface Usuario {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Guarda' | 'Empleado';
  status: 'Activo' | 'Inactivo';
  createdAt: any;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Admin' | 'Guarda' | 'Empleado'>('Empleado');
  const [status, setStatus] = useState<'Activo' | 'Inactivo'>('Activo');
  const [password, setPassword] = useState(''); // Solo para visualización o si luego se usa Auth

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserRole(parsed.role || 'Empleado');
      } catch (err) {
        console.error("Error parsing user from localStorage:", err);
      }
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data: Usuario[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Usuario);
      });
      setUsuarios(data);
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      alert('El nombre y el correo son obligatorios.');
      return;
    }

    setLoading(true);
    try {
      if (editingUsuario) {
        // Update existing user
        await updateDoc(doc(db, 'users', editingUsuario.id), {
          name: name.trim(),
          email: email.trim(),
          role,
          status,
          // No actualizamos la contraseña aquí por seguridad, sería mejor usar Firebase Auth
        });
        setEditingUsuario(null);
      } else {
        // Check for duplicate email
        const exists = usuarios.find(u => u.email === email.trim());
        if (exists) {
          alert(`Ya existe un usuario registrado con el correo: ${email}`);
          setLoading(false);
          return;
        }

        await addDoc(collection(db, 'users'), {
          name: name.trim(),
          email: email.trim(),
          role,
          status,
          createdAt: serverTimestamp(),
        });
        // NOTA: Para autenticación real se debería usar Firebase Authentication
      }
      resetForm();
      setShowForm(false);
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Seguro que deseas eliminar al usuario "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (error: any) {
      alert('Error al eliminar: ' + error.message);
    }
  };

  const startEditUsuario = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setName(usuario.name || '');
    setEmail(usuario.email || '');
    setRole(usuario.role || 'Empleado');
    setStatus(usuario.status || 'Activo');
    setPassword('');
    setShowForm(true);
  };

  const resetForm = () => {
    setName(''); setEmail(''); setRole('Empleado'); setStatus('Activo'); setPassword('');
    setEditingUsuario(null);
  };

  const filtered = usuarios.filter(u =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  if (userRole !== 'Admin') {
    return (
      <div className="usuarios-container">
        <div className="usuarios-header-card">
          <h2>Acceso Denegado</h2>
          <p>No tienes permisos de administrador para ver esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="usuarios-container">
      <div className="usuarios-header-card">
        <div>
          <h2><i className="fa-solid fa-users-gear"></i> Administrador de Usuarios</h2>
          <p>Gestiona los usuarios que tienen acceso al sistema, sus roles y estados.</p>
        </div>
        <button className="btn-add-usuario" onClick={() => setShowForm(!showForm)}>
          <i className={`fa-solid ${showForm ? 'fa-xmark' : 'fa-plus'}`}></i>
          {showForm ? 'Cancelar' : 'Nuevo Usuario'}
        </button>
      </div>

      {showForm && (
        <div className="usuario-form-card">
          <h3>{editingUsuario ? 'Editar Usuario' : 'Registrar Usuario'}</h3>
          
          <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group" style={{ flex: '1' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>Nombre Completo *</label>
              <input type="text" placeholder="Ej: Administrador Principal" value={name} onChange={(e) => setName(e.target.value)} 
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }}/>
            </div>
            <div className="form-group" style={{ flex: '1' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>Correo Electrónico *</label>
              <input type="email" placeholder="Ej: admin@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} 
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }}/>
            </div>
          </div>

          <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div className="form-group" style={{ flex: '1' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>Rol *</label>
              <select value={role} onChange={(e) => setRole(e.target.value as any)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', outline: 'none' }}>
                <option value="Admin">Administrador</option>
                <option value="Guarda">Guarda</option>
                <option value="Empleado">Empleado</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: '1' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>Estado *</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', outline: 'none' }}>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={() => { resetForm(); setShowForm(false); }}
              style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#374151' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={loading}
              style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
              {loading ? 'Guardando...' : 'Guardar Usuario'}
            </button>
          </div>
        </div>
      )}

      <div className="usuarios-list-card">
        <div className="usuarios-search-bar">
          <i className="fa-solid fa-search"></i>
          <input type="text" placeholder="Buscar por nombre o correo..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="usuarios-table-container">
          <table className="usuarios-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map(usuario => (
                  <tr key={usuario.id}>
                    <td><strong>{usuario.name}</strong></td>
                    <td>{usuario.email}</td>
                    <td>
                      <span className={`badge-role role-${(usuario.role || 'Empleado').toLowerCase()}`}>
                        {usuario.role || 'Empleado'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-status status-${(usuario.status || 'Activo').toLowerCase()}`}>
                        {usuario.status || 'Activo'}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns" style={{ justifyContent: 'center' }}>
                        <button className="btn-edit" onClick={() => startEditUsuario(usuario)} title="Editar">
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button className="btn-delete" onClick={() => handleDelete(usuario.id, usuario.name)} title="Eliminar">
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>
                    No se encontraron usuarios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
