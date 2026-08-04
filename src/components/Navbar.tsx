"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface User {
  name: string;
  role: string;
  email: string;
}

export default function Navbar() {
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

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut(auth);
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Image 
          src="/img/LOGO CONTEXSAS.png" 
          alt="Contexsas Logo"
          width={200}
          height={60}
          style={{ objectFit: 'contain' }}
        />
      </div>

      <div className="nav-links">
        <Link href="/dashboard" className="active"><i className="fa-solid fa-house"></i> Inicio</Link>
        
        {user.role === 'Admin' && (
          <>
            <Link href="/dashboard/personas"><i className="fa-solid fa-address-book"></i> Personas</Link>
            <Link href="/dashboard/equipos"><i className="fa-solid fa-server"></i> Equipos</Link>
            <Link href="/dashboard/registros"><i className="fa-solid fa-clock-rotate-left"></i> Registros</Link>
            <Link href="#"><i className="fa-solid fa-gear"></i> Configuración</Link>
          </>
        )}

        {user.role === 'Recepción' && (
          <>
            <Link href="/dashboard/registros"><i className="fa-solid fa-door-open"></i> Entradas / Salidas</Link>
            <Link href="/dashboard/equipos"><i className="fa-solid fa-server"></i> Equipos</Link>
            <Link href="/dashboard/personas"><i className="fa-solid fa-address-book"></i> Personas</Link>
          </>
        )}

        {user.role === 'Empleado' && (
          <>
            <Link href="#"><i className="fa-solid fa-clock-rotate-left"></i> Mis Registros</Link>
            <Link href="#"><i className="fa-regular fa-id-badge"></i> Mi Perfil</Link>
          </>
        )}
      </div>

      <div className="user-profile">
        <div className="user-info">
          <span className="user-name">{user.name}</span>
          <span className="user-role">{user.role}</span>
        </div>
        <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
        <a href="#" onClick={handleLogout} className="logout-btn">
          <i className="fa-solid fa-arrow-right-from-bracket"></i> Salir
        </a>
      </div>
    </nav>
  );
}
