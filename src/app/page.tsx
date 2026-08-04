"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const doLogin = async () => {
    // Check state first, fallback to direct DOM element value in case of mobile autofill
    const domEmail = (document.getElementById('email') as HTMLInputElement)?.value || '';
    const domPass = (document.getElementById('password') as HTMLInputElement)?.value || '';

    const cleanEmail = (email || domEmail).trim();
    const cleanPass = (password || domPass).trim();

    if (!cleanEmail || !cleanPass) {
      setError('Por favor ingresa tu correo y contraseña.');
      return;
    }
    if (loading || success) return;
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
      }
      
      const fbUser = userCredential.user;
      
      let role = 'Empleado';
      let name = fbUser.email?.split('@')[0] || 'Usuario';
      
      try {
        const userDocRef = doc(db, 'users', fbUser.uid);
        // Timeout getDoc after 3.5s so login never hangs indefinitely
        const userDoc = await Promise.race([
          getDoc(userDocRef),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 3500))
        ]);

        if (userDoc && userDoc.exists && userDoc.exists()) {
          const data = userDoc.data();
          role = data.role || role;
          name = data.name || name;
        } else {
          if (fbUser.email === 'jcamilo2907@gmail.com' || fbUser.email === 'admin@contexsas.com') {
            role = 'Admin';
            name = 'Administrador';
          }
          await setDoc(userDocRef, { role, name, email: fbUser.email }).catch(() => {});
        }
      } catch (docErr) {
        console.warn('Firestore fetch timeout or fallback:', docErr);
        if (fbUser.email === 'jcamilo2907@gmail.com' || fbUser.email === 'admin@contexsas.com') {
          role = 'Admin';
          name = 'Administrador';
        }
      }

      const sessionUser = { uid: fbUser.uid, name, role, email: fbUser.email || cleanEmail };
      localStorage.setItem('user', JSON.stringify(sessionUser));
      
      setSuccess(true);
      setLoading(false);
      router.push('/dashboard');

    } catch (err: any) {
      console.error('Login error:', err.code, err.message);
      let msg = 'Error desconocido. Código: ' + (err.code || err.message || 'N/A');
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        msg = 'Correo o contraseña incorrectos.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'El correo ya está registrado.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'La contraseña debe tener al menos 6 caracteres.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Sin conexión. Verifica tu red WiFi o de datos.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Demasiados intentos. Espera unos minutos.';
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = 'Dominio no autorizado en Firebase. Agrega esta IP en Firebase Console → Authentication → Authorized Domains.';
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Avoid registering mousemove on touch devices to prevent performance/freeze issues
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;

    const handleMouseMove = (e: MouseEvent) => {
      const shapes = document.querySelectorAll('.shape') as NodeListOf<HTMLElement>;
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      
      shapes.forEach((shape, index) => {
        const speed = (index + 1) * 20;
        const moveX = (x - 0.5) * speed;
        const moveY = (y - 0.5) * speed;
        
        shape.style.transform = `translate(${moveX}px, ${moveY}px)`;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    doLogin();
  };

  return (
    <div className="login-page-wrapper">
      <div className="background-shapes" style={{ pointerEvents: 'none' }}>
        <div className="shape shape-1" style={{ pointerEvents: 'none' }}></div>
        <div className="shape shape-2" style={{ pointerEvents: 'none' }}></div>
        <div className="shape shape-3" style={{ pointerEvents: 'none' }}></div>
      </div>

      <div className="login-container">
        <div className="glass-panel">
          <div className="login-header">
            <Image 
              src="/img/LOGO CONTEXSAS.png" 
              alt="Contexsas Logo" 
              width={200} 
              height={60} 
              className="logo-img" 
              style={{ objectFit: 'contain' }}
            />
            <h2>{isSignUp ? 'Crear Cuenta' : 'Bienvenido'}</h2>
            <p>{isSignUp ? 'Registra un usuario administrador' : 'Ingresa a tu cuenta para continuar'}</p>
          </div>
          
          <form className="login-form" noValidate action="javascript:void(0);" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="email">Correo Electrónico</label>
              <div className="input-wrapper">
                <i className="fa-regular fa-envelope"></i>
                <input 
                  type="email" 
                  id="email" 
                  placeholder="ejemplo@correo.com" 
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="password">Contraseña</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-lock"></i>
                <input 
                  type={showPassword ? "text" : "password"} 
                  id="password" 
                  placeholder="Tu contraseña" 
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button" 
                  className="toggle-password" 
                  id="togglePassword" 
                  aria-label="Mostrar contraseña"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div className="form-actions">
              {!isSignUp && (
                <label className="remember-me">
                  <input type="checkbox" id="remember" />
                  <span className="checkmark"></span>
                  Recordarme
                </label>
              )}
              <button 
                type="button"
                className="toggle-mode-btn"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsSignUp(!isSignUp); setError(''); }}
                style={{ marginLeft: isSignUp ? 'auto' : '0' }}
              >
                {isSignUp ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate'}
              </button>
            </div>

            <button 
              type="submit" 
              className="submit-btn" 
              disabled={loading || success}
              style={{
                opacity: loading || success ? '0.8' : '1',
                background: success ? 'linear-gradient(135deg, #10b981, #059669)' : ''
              }}
            >
              {loading && !success && (
                <><i className="fa-solid fa-spinner fa-spin"></i><span>{isSignUp ? 'Creando cuenta...' : 'Iniciando sesión...'}</span></>
              )}
              {success && (
                <><i className="fa-solid fa-check"></i><span>{isSignUp ? '¡Cuenta creada!' : '¡Ingreso exitoso!'}</span></>
              )}
              {!loading && !success && (
                <><span>{isSignUp ? 'Registrarse' : 'Iniciar Sesión'}</span><i className="fa-solid fa-arrow-right"></i></>
              )}
            </button>

            {/* Error banner — persistent y visible en móvil */}
            {error && (
              <div style={{
                marginTop: '16px',
                padding: '14px 18px',
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '10px',
                color: '#dc2626',
                fontSize: '0.9rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginTop: '2px', flexShrink: 0 }}></i>
                <span>{error}</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

