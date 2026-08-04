"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface User {
  name: string;
  role: string;
  email: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Try getting cached user first for faster render
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        // Fetch fresh role from Firestore
        const userDocRef = doc(db, 'users', fbUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        let role = 'Empleado';
        let name = fbUser.email?.split('@')[0] || 'Usuario';
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          role = data.role || role;
          name = data.name || name;
        }

        const sessionUser = {
          uid: fbUser.uid,
          name: name,
          role: role,
          email: fbUser.email || ''
        };

        setUser(sessionUser);
        localStorage.setItem('user', JSON.stringify(sessionUser));
      } else {
        localStorage.removeItem('user');
        setUser(null);
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (!user) return null;

  return (
    <main className="main-content">
      <div className="welcome-card" style={{ marginBottom: '24px' }}>
        <h1>Bienvenido, {user.name}</h1>
        <p>Has iniciado sesión como <strong>{user.role}</strong>.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        
        {/* Admin Dashboard Metrics */}
        {user.role === 'Admin' && (
          <>
            <div className="welcome-card" style={{ borderLeftColor: '#4f46e5' }}>
              <h3 style={{ marginBottom: '10px' }}>Total Empleados</h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#4f46e5' }}>124</p>
            </div>
            <div className="welcome-card" style={{ borderLeftColor: '#10b981' }}>
              <h3 style={{ marginBottom: '10px' }}>Registros Hoy</h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>98</p>
            </div>
            <div className="welcome-card" style={{ borderLeftColor: '#ef4444' }}>
              <h3 style={{ marginBottom: '10px' }}>Ausencias / Tardanzas</h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#ef4444' }}>5</p>
            </div>
          </>
        )}

        {/* Recepción Dashboard Metrics */}
        {user.role === 'Recepción' && (
          <>
            <div className="welcome-card" style={{ borderLeftColor: '#10b981' }}>
              <h3 style={{ marginBottom: '10px' }}>Personal en Edificio</h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>85</p>
            </div>
            <div className="welcome-card" style={{ borderLeftColor: '#f59e0b' }}>
              <h3 style={{ marginBottom: '10px' }}>Visitantes Activos</h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>12</p>
            </div>
          </>
        )}

        {/* Empleado Dashboard Metrics */}
        {user.role === 'Empleado' && (
          <>
            <div className="welcome-card" style={{ borderLeftColor: '#10b981' }}>
              <h3 style={{ marginBottom: '10px' }}>Hora de Entrada (Hoy)</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>07:55 AM</p>
            </div>
            <div className="welcome-card" style={{ borderLeftColor: '#6366f1' }}>
              <h3 style={{ marginBottom: '10px' }}>Horas Trabajadas (Semana)</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#6366f1' }}>32 hrs</p>
            </div>
          </>
        )}

      </div>
    </main>
  );
}
