"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
  totalPersonal: number;
  usuariosSiesa: number;
  licenciasOffice: number;
  mantenimientosPendientes: number;
  mantenimientosRealizados: number;
  equiposAsignados: number;
  entradasHoy: number;
  salidasHoy: number;
  equiposPorTipo: { name: string, value: number }[];
  personalPorArea: { name: string, value: number }[];
  licenciasBreakdown: { name: string, value: number }[];
  impresorasBreakdown: { name: string, value: number }[];
  pcBreakdown: { name: string, value: number }[];
  totalCamaras: number;
  totalImpresiones: number;
  usuariosSiesaConAsignacion: number;
  usuariosDominioConAsignacion: number;
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
    totalPersonal: 0,
    usuariosSiesa: 0,
    licenciasOffice: 0,
    mantenimientosPendientes: 0,
    mantenimientosRealizados: 0,
    equiposAsignados: 0,
    entradasHoy: 0,
    salidasHoy: 0,
    equiposPorTipo: [],
    personalPorArea: [],
    licenciasBreakdown: [],
    impresorasBreakdown: [],
    pcBreakdown: [],
    totalCamaras: 0,
    totalImpresiones: 0,
    usuariosSiesaConAsignacion: 0,
    usuariosDominioConAsignacion: 0,
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
        let cedula = '';

        if (storedUser) {
          const cached = JSON.parse(storedUser);
          role = cached.role || role;
          name = cached.name || name;
          cedula = cached.cedula || '';
        }

        // Try getting from Firestore users collection by email
        const qUsers = query(collection(db, 'users'), where('email', '==', fbUser.email));
        const snapUsers = await getDocs(qUsers);
        if (!snapUsers.empty) {
          const data = snapUsers.docs[0].data();
          role = data.role || role;
          name = data.name || name;
          cedula = data.cedula || cedula;
        }

        // Also look up in personas collection by email (takes priority for name/cedula)
        let personaIdNumber = '';
        let personaArea = '';
        try {
          if (fbUser.email) {
            // Search by email exact match first, then by email containing (e.g. with [Inactivo] suffix)
            const qPersona = query(collection(db, 'personas'), where('email', '==', fbUser.email));
            const snapPersona = await getDocs(qPersona);
            if (!snapPersona.empty) {
              const personaData = snapPersona.docs[0].data();
              // Persona data takes priority over users collection
              name = personaData.name || name;
              cedula = personaData.idNumber || cedula;
              personaIdNumber = personaData.idNumber || '';
              personaArea = personaData.area || '';
            }
          }
        } catch (err) {
          console.error('Error fetching persona:', err);
        }

        const sessionUser = {
          uid: fbUser.uid,
          name: name,
          role: role,
          email: fbUser.email || '',
          cedula: cedula,
          idNumber: personaIdNumber,
          area: personaArea
        };

        setUser(sessionUser);
        localStorage.setItem('user', JSON.stringify(sessionUser));
        setEmployeeIdNumber(personaIdNumber);
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
      let total = 0, dentro = 0, fuera = 0, camaras = 0, impresiones = 0;
      const typesMap: Record<string, number> = {};
      const pcMap: Record<string, number> = {};
      const printerMap: Record<string, number> = {};

      snapshot.forEach((docSnap) => {
        total++;
        const d = docSnap.data();
        if (d.status === 'Fuera') fuera++; else dentro++;

        const t = d.equipmentType || d.type || 'Otro';
        typesMap[t] = (typesMap[t] || 0) + 1;

        if (t.includes('CCTV') || t.includes('Cámara')) camaras++;

        if (['Portátil', 'Computador de Mesa', 'All in One', 'Mini PC', 'PC Escritorio'].includes(t)) {
          pcMap[t] = (pcMap[t] || 0) + 1;
        }

        if (t === 'Impresora') {
          const pt = d.tipoImpresora || 'Otra';
          printerMap[pt] = (printerMap[pt] || 0) + 1;

          if (d.toners && Array.isArray(d.toners)) {
            d.toners.forEach((toner: any) => {
              if (toner.tonerFinal && toner.tonerInitial) {
                impresiones += (parseInt(toner.tonerFinal) - parseInt(toner.tonerInitial)) || 0;
              }
            });
          }
        }
      });
      
      setMetrics((prev) => ({
        ...prev,
        totalEquipos: total,
        equiposDentro: dentro,
        equiposFuera: fuera,
        equiposPorTipo: Object.keys(typesMap).map(k => ({ name: k, value: typesMap[k] })),
        pcBreakdown: Object.keys(pcMap).map(k => ({ name: k, value: pcMap[k] })),
        impresorasBreakdown: Object.keys(printerMap).map(k => ({ name: k, value: printerMap[k] })),
        totalCamaras: camaras,
        totalImpresiones: impresiones
      }));
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const unsubReg = onSnapshot(collection(db, 'registros'), (snapshot) => {
      let countHoy = 0, ent = 0, sal = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.timestamp) {
          const date = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
          if (date >= startOfToday) {
            countHoy++;
            if (data.type === 'Entrada') ent++;
            else if (data.type === 'Salida') sal++;
          }
        }
      });
      setMetrics((prev) => ({
        ...prev,
        movimientosHoy: countHoy,
        entradasHoy: ent,
        salidasHoy: sal
      }));
    });

    const unsubPer = onSnapshot(collection(db, 'personas'), (snapshot) => {
      let total = 0, siesa = 0, licencias = 0;
      let siesaAsig = 0, dominioAsig = 0;
      const areaMap: Record<string, number> = {};
      const licMap: Record<string, number> = {};

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.status !== 'Inactivo') {
          total++;
          if (d.siesaUser) {
            siesa++;
            if (d.assignedEquipmentCount > 0 || (d.asignaciones && d.asignaciones.length > 0)) siesaAsig++;
          }
          if (d.domainUser) {
            if (d.assignedEquipmentCount > 0 || (d.asignaciones && d.asignaciones.length > 0)) dominioAsig++;
          }
          
          if (d.office365License || d.office365Email || d.office365Key) {
            licencias++;
            const licType = d.office365License || 'Genérica';
            licMap[licType] = (licMap[licType] || 0) + 1;
          }
          
          const a = d.area || 'Sin Área';
          areaMap[a] = (areaMap[a] || 0) + 1;
        }
      });
      
      setMetrics(prev => ({ 
        ...prev, 
        totalPersonal: total, 
        usuariosSiesa: siesa, 
        licenciasOffice: licencias, 
        personalPorArea: Object.keys(areaMap).map(k => ({ name: k, value: areaMap[k] })).sort((a,b)=>b.value-a.value).slice(0, 5),
        licenciasBreakdown: Object.keys(licMap).map(k => ({ name: k, value: licMap[k] })),
        usuariosSiesaConAsignacion: siesaAsig,
        usuariosDominioConAsignacion: dominioAsig
      }));
    });

    const unsubMant = onSnapshot(collection(db, 'mantenimientos'), (snapshot) => {
      let pendientes = 0, realizados = 0;
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.estado === 'Realizado') realizados++;
        else pendientes++;
      });
      setMetrics(prev => ({ ...prev, mantenimientosPendientes: pendientes, mantenimientosRealizados: realizados }));
    });

    const unsubAsig = onSnapshot(collection(db, 'asignaciones'), (snapshot) => {
      let count = 0;
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.estado === 'Activa' || !d.fechaDevolucion) count++;
      });
      setMetrics(prev => ({ ...prev, equiposAsignados: count }));
    });

    return () => {
      unsubEq();
      unsubReg();
      unsubPer();
      unsubMant();
      unsubAsig();
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', gridColumn: '1 / -1' }}>
            
            <div>
              <h2 style={{ fontSize: '18px', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', marginBottom: '15px' }}>
                <i className="fa-solid fa-laptop" style={{ marginRight: '8px' }}></i> Módulo de Equipos ({metrics.totalEquipos} Total)
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                
                <div className="welcome-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', color: '#374151', marginBottom: '10px' }}>Tipos de Computadores</h3>
                  <div style={{ width: '100%', height: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={metrics.pcBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" label>
                          {metrics.pcBreakdown.map((e, i) => <Cell key={i} fill={['#3b82f6', '#8b5cf6', '#0ea5e9', '#6366f1'][i % 4]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="welcome-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', color: '#374151', marginBottom: '10px' }}>Tipos de Impresoras</h3>
                  <div style={{ width: '100%', height: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={metrics.impresorasBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" label>
                          {metrics.impresorasBreakdown.map((e, i) => <Cell key={i} fill={['#f97316', '#f59e0b', '#ef4444', '#10b981'][i % 4]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="welcome-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ marginBottom: '20px', borderLeft: '4px solid #10b981', paddingLeft: '15px' }}>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>TOTAL CÁMARAS CCTV</p>
                    <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#10b981' }}>{metrics.totalCamaras}</p>
                  </div>
                  <div style={{ borderLeft: '4px solid #8b5cf6', paddingLeft: '15px' }}>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>TOTAL IMPRESIONES REGISTRADAS</p>
                    <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#8b5cf6' }}>{metrics.totalImpresiones}</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: '18px', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', marginBottom: '15px' }}>
                <i className="fa-solid fa-users" style={{ marginRight: '8px' }}></i> Módulo de Personal ({metrics.totalPersonal} Activos)
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                
                <div className="welcome-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', color: '#374151', marginBottom: '10px' }}>Tipos de Licencia Office 365</h3>
                  <div style={{ width: '100%', height: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.licenciasBreakdown} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <XAxis dataKey="name" fontSize={11} interval={0} angle={-30} textAnchor="end" height={60} />
                        <YAxis allowDecimals={false} fontSize={12} />
                        <Tooltip cursor={{fill: '#f3f4f6'}} />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="welcome-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', color: '#374151', marginBottom: '10px' }}>Usuarios con Equipos Asignados</h3>
                  <div style={{ width: '100%', height: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'En SIESA', value: metrics.usuariosSiesaConAsignacion, fill: '#f59e0b' },
                        { name: 'En Dominio', value: metrics.usuariosDominioConAsignacion, fill: '#10b981' }
                      ]}>
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis allowDecimals={false} fontSize={12} />
                        <Tooltip cursor={{fill: '#f3f4f6'}} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: '18px', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', marginBottom: '15px' }}>
                <i className="fa-solid fa-clipboard-check" style={{ marginRight: '8px' }}></i> Asignaciones y Registros
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div className="welcome-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', color: '#374151', marginBottom: '10px' }}>Asignados vs Disponibles (Stock)</h3>
                  <div style={{ width: '100%', height: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Asignados', value: metrics.equiposAsignados },
                            { name: 'Stock (Libres)', value: metrics.totalEquipos - metrics.equiposAsignados }
                          ]}
                          cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label
                        >
                          <Cell fill="#0ea5e9" />
                          <Cell fill="#6366f1" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', gap: '15px', fontSize: '12px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: '#0ea5e9', borderRadius: '50%' }}></div>Asignados ({metrics.equiposAsignados})</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: '#6366f1', borderRadius: '50%' }}></div>Libres ({metrics.totalEquipos - metrics.equiposAsignados})</div>
                  </div>
                </div>

                <div className="welcome-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', color: '#374151', marginBottom: '10px' }}>Movimientos de Hoy ({metrics.movimientosHoy} Total)</h3>
                  <div style={{ width: '100%', height: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Entradas', value: metrics.entradasHoy, fill: '#10b981' },
                        { name: 'Salidas', value: metrics.salidasHoy, fill: '#ef4444' }
                      ]}>
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis allowDecimals={false} fontSize={12} />
                        <Tooltip cursor={{fill: '#f3f4f6'}} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: '18px', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', marginBottom: '15px' }}>
                <i className="fa-solid fa-screwdriver-wrench" style={{ marginRight: '8px' }}></i> Módulo de Mantenimientos
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div className="welcome-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', color: '#374151', marginBottom: '10px' }}>Estado Mantenimientos (Total: {metrics.mantenimientosPendientes + metrics.mantenimientosRealizados})</h3>
                  <div style={{ width: '100%', height: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Pendientes', value: metrics.mantenimientosPendientes },
                            { name: 'Completados', value: metrics.mantenimientosRealizados }
                          ]}
                          cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label
                        >
                          <Cell fill="#ef4444" />
                          <Cell fill="#10b981" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', gap: '15px', fontSize: '12px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%' }}></div>Pendientes ({metrics.mantenimientosPendientes})</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '50%' }}></div>Completados ({metrics.mantenimientosRealizados})</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
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
