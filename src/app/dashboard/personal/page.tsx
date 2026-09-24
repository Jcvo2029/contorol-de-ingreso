"use client";
import React, { useState } from 'react';
import PersonasTab from './PersonasTab';
import UsuariosTab from './UsuariosTab';
import AreasTab from './AreasTab';

export default function PersonalPage() {
  const [activeTab, setActiveTab] = useState('Personas');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', height: '100%' }}>
      <div style={{ display: 'flex', gap: '10px', background: 'white', padding: '15px 20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <button 
          onClick={() => setActiveTab('Personas')}
          style={{ 
            padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', 
            background: activeTab === 'Personas' ? '#4f46e5' : '#fff', 
            color: activeTab === 'Personas' ? '#fff' : '#374151', 
            cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s' 
          }}>
          <i className="fa-solid fa-address-book" style={{ marginRight: '8px' }}></i> Personas
        </button>
        <button 
          onClick={() => setActiveTab('Usuarios')}
          style={{ 
            padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', 
            background: activeTab === 'Usuarios' ? '#4f46e5' : '#fff', 
            color: activeTab === 'Usuarios' ? '#fff' : '#374151', 
            cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s' 
          }}>
          <i className="fa-solid fa-users-gear" style={{ marginRight: '8px' }}></i> Usuarios del Sistema
        </button>
        <button 
          onClick={() => setActiveTab('Areas')}
          style={{ 
            padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', 
            background: activeTab === 'Areas' ? '#4f46e5' : '#fff', 
            color: activeTab === 'Areas' ? '#fff' : '#374151', 
            cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s' 
          }}>
          <i className="fa-solid fa-building" style={{ marginRight: '8px' }}></i> Áreas
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {activeTab === 'Personas' && <PersonasTab />}
        {activeTab === 'Usuarios' && <UsuariosTab />}
        {activeTab === 'Areas' && <AreasTab />}
      </div>
    </div>
  );
}
