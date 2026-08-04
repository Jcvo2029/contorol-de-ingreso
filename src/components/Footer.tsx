import React from 'react';

export default function Footer() {
  return (
    <footer style={{
      textAlign: 'center',
      padding: '20px',
      color: 'var(--text-muted)',
      fontSize: '14px',
      marginTop: 'auto',
      borderTop: '1px solid rgba(0,0,0,0.05)'
    }}>
      <p>&copy; {new Date().getFullYear()} Contexsas. Todos los derechos reservados.</p>
    </footer>
  );
}
