"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface User {
  name: string;
  role: string;
  email: string;
  uid: string;
}

interface Metrics {
  totalEquipos: number;
  equiposDentro: number;
  equiposFuera: number;
  movimientosHoy: number;
  misEquiposCount: number;
  miEquipoEstado: 'Dentro' | 'Fuera' | 'Ninguno';
  miUltimoRegistro: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [employeeIdNumber, setEmployeeIdNumber] = useState<string>('');
  const [metrics, setMetrics] = useState<Metrics>({
    totalEquipos: 0,
    equiposDentro: 0,
    equiposFuera: 0,
    movimientosHoy: 0,
    misEquiposCount: 0,
    miEquipoEstado: 'Ninguno',
    miUltimoRegistro: 'Sin registros'
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const storedUser = localStorage.getItem('user');
        let role = 'Empleado';
        let name = fbUser.email?.split('@')[0] || 'Usuario';

        if (storedUser) {
          const cached = JSON.parse(storedUser);
          role = cached.role || role;
          name = cached.name || name;
        }

        const userDocRef = doc(db, 'users', fbUser.uid);
        const userDoc = await getDoc(userDocRef);
        
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

        try {
          if (fbUser.email) {
            const q = query(collection(db, 'personas'), where('email', '==', fbUser.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              setEmployeeIdNumber(querySnapshot.docs[0].data().idNumber || '');
            } else {
              const qName = query(collection(db, 'personas'), where('name', '==', name));
              const qSnapName = await getDocs(qName);
              if (!qSnapName.empty) {
                setEmployeeIdNumber(qSnapName.docs[0].data().idNumber || '');
              }
            }
          }
        } catch (err) {
          console.error("Error fetching persona:", err);
        }
      } else {
        localStorage.removeItem('user');
        setUser(null);
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const unsubEq = onSnapshot(collection(db, 'equipos'), (snapshot) => {
      let total = 0;
      let dentro = 0;
      let fuera = 0;
      snapshot.forEach((docSnap) => {
        total++;
        const status = docSnap.data().status;
        if (status === 'Dentro') {
          dentro++;
        } else {
          fuera++;
        }
      });
      setMetrics((prev) => ({
        ...prev,
        totalEquipos: total,
        equiposDentro: dentro,
        equiposFuera: fuera
      }));
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const unsubReg = onSnapshot(collection(db, 'registros'), (snapshot) => {
      let countHoy = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.timestamp) {
          const date = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
          if (date >= startOfToday) {
            countHoy++;
          }
        }
      });
      setMetrics((prev) => ({
        ...prev,
        movimientosHoy: countHoy
      }));
    });

    return () => {
      unsubEq();
      unsubReg();
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'Empleado' || !employeeIdNumber) return;

    const q = query(
      collection(db, 'registros'),
      where('idNumber', '==', employeeIdNumber)
    );

    const unsubEmpReg = onSnapshot(q, (snapshot) => {
      const userRegistries: any[] = [];
      snapshot.forEach((docSnap) => {
        userRegistries.push(docSnap.data());
      });

      userRegistries.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });

      const uniqueEquips = new Map<string, string>();
      let lastRegText = 'Sin registros';

      if (userRegistries.length > 0) {
        const latest = userRegistries[0];
        const date = latest.timestamp?.toDate ? latest.timestamp.toDate() : new Date(latest.timestamp);
        const formattedDate = date.toLocaleString('es-ES', { 
          day: '2-digit', 
          month: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        lastRegText = `${latest.type} - ${formattedDate}`;

        for (const reg of userRegistries) {
          const key = reg.serialNumber || reg.assetCode;
          if (key && !uniqueEquips.has(key)) {
            uniqueEquips.set(key, reg.type === 'Entrada' ? 'Dentro' : 'Fuera');
          }
        }
      }

      let activeStatus: 'Dentro' | 'Fuera' | 'Ninguno' = 'Ninguno';
      if (uniqueEquips.size > 0) {
        const statuses = Array.from(uniqueEquips.values());
        if (statuses.includes('Dentro')) {
          activeStatus = 'Dentro';
        } else {
          activeStatus = 'Fuera';
        }
      }

      setMetrics((prev) => ({
        ...prev,
        misEquiposCount: uniqueEquips.size,
        miEquipoEstado: activeStatus,
        miUltimoRegistro: lastRegText
      }));
    });

    return () => unsubEmpReg();
  }, [user, employeeIdNumber]);

  if (!user) return null;

  return (
    <>
      <div className="welcome-card" style={{ marginBottom: '24px' }}>
        <h1>Bienvenido, {user.name}</h1>
        <p>Has iniciado sesión como <strong>{user.role}</strong>.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        
        {/* Admin Dashboard Metrics */}
        {user.role === 'Admin' && (
          <>
            <div className="welcome-card" style={{ borderLeftColor: 'var(--secondary)' }}>
              <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-laptop" style={{ color: 'var(--secondary)' }}></i> Total Equipos
              </h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--secondary)' }}>{metrics.totalEquipos}</p>
            </div>
            <div className="welcome-card" style={{ borderLeftColor: '#209D88' }}>
              <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#209D88' }}></i> Equipos en Planta (Dentro)
              </h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#209D88' }}>{metrics.equiposDentro}</p>
            </div>
            <div className="welcome-card" style={{ borderLeftColor: 'var(--primary)' }}>
              <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-circle-right" style={{ color: 'var(--primary-hover)' }}></i> Equipos Fuera
              </h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary-hover)' }}>{metrics.equiposFuera}</p>
            </div>
            <div className="welcome-card" style={{ borderLeftColor: 'var(--bg-dark)' }}>
              <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-clipboard-list" style={{ color: 'var(--bg-dark)' }}></i> Movimientos Hoy
              </h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--bg-dark)' }}>{metrics.movimientosHoy}</p>
            </div>
          </>
        )}

        {/* Recepción Dashboard Metrics */}
        {user.role === 'Recepción' && (
          <>
            <div className="welcome-card" style={{ borderLeftColor: '#209D88' }}>
              <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#209D88' }}></i> Equipos Dentro
              </h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#209D88' }}>{metrics.equiposDentro}</p>
            </div>
            <div className="welcome-card" style={{ borderLeftColor: 'var(--primary)' }}>
              <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-circle-right" style={{ color: 'var(--primary-hover)' }}></i> Equipos Fuera
              </h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary-hover)' }}>{metrics.equiposFuera}</p>
            </div>
            <div className="welcome-card" style={{ borderLeftColor: 'var(--secondary)' }}>
              <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-clipboard-list" style={{ color: 'var(--secondary)' }}></i> Registros Hoy
              </h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--secondary)' }}>{metrics.movimientosHoy}</p>
            </div>
          </>
        )}

        {/* Empleado Dashboard Metrics */}
        {user.role === 'Empleado' && (
          <>
            <div className="welcome-card" style={{ borderLeftColor: 'var(--secondary)' }}>
              <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-laptop" style={{ color: 'var(--secondary)' }}></i> Mis Equipos
              </h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--secondary)' }}>{metrics.misEquiposCount}</p>
            </div>
            <div className="welcome-card" style={{ 
              borderLeftColor: metrics.miEquipoEstado === 'Dentro' ? '#209D88' : metrics.miEquipoEstado === 'Fuera' ? 'var(--primary)' : '#9ca3af' 
            }}>
              <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-signal" style={{ 
                  color: metrics.miEquipoEstado === 'Dentro' ? '#209D88' : metrics.miEquipoEstado === 'Fuera' ? 'var(--primary-hover)' : '#9ca3af' 
                }}></i> Estado Actual
              </h3>
              <p style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                color: metrics.miEquipoEstado === 'Dentro' ? '#209D88' : metrics.miEquipoEstado === 'Fuera' ? 'var(--primary-hover)' : '#9ca3af' 
              }}>
                {metrics.miEquipoEstado === 'Ninguno' ? 'Sin Equipos' : metrics.miEquipoEstado}
              </p>
            </div>
            <div className="welcome-card" style={{ borderLeftColor: 'var(--bg-dark)' }}>
              <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--bg-dark)' }}></i> Último Registro
              </h3>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#4b5563', marginTop: '8px' }}>
                {metrics.miUltimoRegistro}
              </p>
            </div>
          </>
        )}

      </div>
    </>
  );
}
