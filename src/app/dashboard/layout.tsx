import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-page-wrapper" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <main className="main-content" style={{ flex: 1, width: '100%' }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
