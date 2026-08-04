"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
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
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-header">
        <div className="nav-brand">
          <Link href="/dashboard/registros">
            <Image 
              src="/img/logo-contexsas.png" 
              alt="Contexsas Logo"
              width={160}
              height={50}
              style={{ objectFit: 'contain' }}
            />
          </Link>
        </div>

        <div className="mobile-header-right">
          <div className="avatar" title={user.name}>{user.name.charAt(0).toUpperCase()}</div>
          <button 
            className="mobile-menu-toggle"
            aria-label="Abrir menú"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <i className={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
          </button>
        </div>
      </div>

      <div className={`nav-menu-content ${menuOpen ? 'open' : ''}`}>
        <div className="nav-links">
          {user.role === 'Admin' && (
            <>
              <Link 
                href="/dashboard/personas" 
                className={isActive('/dashboard/personas') ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                <i className="fa-solid fa-address-book"></i> Personas
              </Link>
              <Link 
                href="/dashboard/equipos" 
                className={isActive('/dashboard/equipos') ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                <i className="fa-solid fa-server"></i> Equipos
              </Link>
              <Link 
                href="/dashboard/registros" 
                className={isActive('/dashboard/registros') ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                <i className="fa-solid fa-clock-rotate-left"></i> Registros
              </Link>
            </>
          )}

          {user.role === 'Recepción' && (
            <>
              <Link 
                href="/dashboard/registros" 
                className={isActive('/dashboard/registros') ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                <i className="fa-solid fa-door-open"></i> Entradas / Salidas
              </Link>
              <Link 
                href="/dashboard/equipos" 
                className={isActive('/dashboard/equipos') ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                <i className="fa-solid fa-server"></i> Equipos
              </Link>
              <Link 
                href="/dashboard/personas" 
                className={isActive('/dashboard/personas') ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                <i className="fa-solid fa-address-book"></i> Personas
              </Link>
            </>
          )}

          {user.role === 'Empleado' && (
            <>
              <Link 
                href="/dashboard/registros" 
                className={isActive('/dashboard/registros') ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                <i className="fa-solid fa-clock-rotate-left"></i> Mis Registros
              </Link>
            </>
          )}
        </div>

        <div className="user-profile">
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-role">{user.role}</span>
          </div>
          <div className="avatar desktop-avatar" title={user.name}>{user.name.charAt(0).toUpperCase()}</div>
          <button onClick={handleLogout} className="logout-btn" title="Cerrar Sesión / Salir">
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
            <span className="logout-text-mobile">Salir</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

