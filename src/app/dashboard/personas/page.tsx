"use client";
import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import './personas.css';

interface Persona {
  id: string;
  idNumber: string;
  name: string;
  area: string;
  visitorType: 'Empleado' | 'Proveedor/Cliente';
  company?: string;
  phone?: string;
  email?: string;
  createdAt: any;
}

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');

  // Form state
  const [idNumber, setIdNumber] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [visitorType, setVisitorType] = useState<'Empleado' | 'Proveedor/Cliente'>('Empleado');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'personas'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data: Persona[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Persona);
      });
      setPersonas(data);
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!idNumber.trim() || !name.trim()) {
      alert('El número de identificación y el nombre son obligatorios.');
      return;
    }

    // Check for duplicate ID
    const exists = personas.find(p => p.idNumber === idNumber.trim());
    if (exists) {
      alert(`Ya existe una persona registrada con el ID: ${idNumber}`);
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'personas'), {
        idNumber: idNumber.trim(),
        name: name.trim(),
        area: area.trim(),
        visitorType,
        company: company.trim(),
        phone: phone.trim(),
        email: email.trim(),
        createdAt: serverTimestamp(),
      });
      resetForm();
      setShowForm(false);
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Seguro que deseas eliminar a "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'personas', id));
    } catch (error: any) {
      alert('Error al eliminar: ' + error.message);
    }
  };

  const resetForm = () => {
    setIdNumber(''); setName(''); setArea('');
    setVisitorType('Empleado'); setCompany('');
    setPhone(''); setEmail('');
  };

  const filtered = personas.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.idNumber.includes(search) ||
    (p.area || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="personas-container">
      <div className="personas-header-card">
        <h2><i className="fa-solid fa-address-book"></i> Directorio de Personas</h2>
        <button className="btn-add-persona" onClick={() => setShowForm(!showForm)}>
          <i className={`fa-solid ${showForm ? 'fa-xmark' : 'fa-plus'}`}></i>
          {showForm ? 'Cancelar' : 'Nueva Persona'}
        </button>
      </div>

      {showForm && (
        <div className="persona-form-card">
          <h3>Registrar Persona</h3>

          <div className="form-row">
            <div className="form-group" style={{ flex: '0.8' }}>
              <label>Tipo *</label>
              <select value={visitorType} onChange={(e) => setVisitorType(e.target.value as any)}
                style={{ padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit', width: '100%' }}>
                <option value="Empleado">Empleado</option>
                <option value="Proveedor/Cliente">Proveedor / Cliente</option>
              </select>
            </div>
            <div className="form-group">
              <label>N° Identificación (CC/ID) *</label>
              <input type="text" placeholder="Ej: 123456789" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: '2' }}>
              <label>Nombre Completo *</label>
              <input type="text" placeholder="Ej: Juan Carlos Pérez" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{visitorType === 'Empleado' ? 'Área / Departamento' : 'Empresa / Organización'}</label>
              <input type="text" placeholder={visitorType === 'Empleado' ? "Ej: Tecnología" : "Ej: Microsoft"} value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
            {visitorType === 'Proveedor/Cliente' && (
              <div className="form-group">
                <label>Empresa</label>
                <input type="text" placeholder="Ej: Cisco Systems" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
            )}
            <div className="form-group">
              <label>Teléfono</label>
              <input type="text" placeholder="Ej: +57 300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" placeholder="Ej: juan@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button onClick={() => { resetForm(); setShowForm(false); }}
              style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={loading}
              style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#4f46e5', color: 'white', fontWeight: '600', cursor: 'pointer' }}>
              <i className="fa-solid fa-floppy-disk"></i> Guardar Persona
            </button>
          </div>
        </div>
      )}

      <div className="personas-list-card">
        <div className="personas-search-bar">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder="Buscar por nombre, cédula o área..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="table-responsive">
          <table className="personas-table">
            <thead>
              <tr>
                <th>Identificación</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Área / Empresa</th>
                <th>Contacto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    {search ? 'No se encontraron coincidencias.' : 'No hay personas registradas aún. Haz clic en "Nueva Persona" para agregar.'}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '3px 8px', borderRadius: '6px', fontSize: '13px' }}>
                        {p.idNumber}
                      </span>
                    </td>
                    <td><strong>{p.name}</strong></td>
                    <td>
                      <span style={{
                        fontSize: '12px', fontWeight: '600', padding: '3px 10px', borderRadius: '20px',
                        background: p.visitorType === 'Empleado' ? '#d1fae5' : '#fef3c7',
                        color: p.visitorType === 'Empleado' ? '#065f46' : '#92400e'
                      }}>
                        {p.visitorType}
                      </span>
                    </td>
                    <td>{p.area || p.company || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td style={{ fontSize: '12px', color: '#6b7280' }}>
                      {p.phone && <div><i className="fa-solid fa-phone" style={{ marginRight: '4px' }}></i>{p.phone}</div>}
                      {p.email && <div><i className="fa-solid fa-envelope" style={{ marginRight: '4px' }}></i>{p.email}</div>}
                      {!p.phone && !p.email && <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td>
                      <button onClick={() => handleDelete(p.id, p.name)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}
                        title="Eliminar persona">
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
