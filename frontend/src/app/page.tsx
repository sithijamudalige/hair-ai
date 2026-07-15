"use client";

import Link from "next/link";
import { Camera, Image as ImageIcon } from "lucide-react";

export default function Home() {
  return (
    <div className="container fade-in" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '80vh',
      textAlign: 'center'
    }}>
      
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '4rem', fontWeight: 700, marginBottom: '1rem' }}>
          Discover Your <span className="text-gradient">Aura</span>
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
          Experience our advanced AI that instantly analyzes your face type, skin color, and hair type with high precision.
        </p>
      </div>

      <div className="grid-3" style={{ maxWidth: '800px', width: '100%' }}>
        
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ 
            width: '80px', height: '80px', borderRadius: '50%', 
            background: 'rgba(99, 102, 241, 0.1)', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' 
          }}>
            <Camera size={40} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Live Cam Mode</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Real-time analysis using your device's camera for instant results.
            </p>
          </div>
          <Link href="/live" className="btn-primary" style={{ width: '100%', textDecoration: 'none' }}>
            Start Camera <Camera size={18} />
          </Link>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ 
            width: '80px', height: '80px', borderRadius: '50%', 
            background: 'rgba(168, 85, 247, 0.1)', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', color: '#a855f7' 
          }}>
            <ImageIcon size={40} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Photo Mode</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Upload 3 detailed photos (front, left, right) for a comprehensive report.
            </p>
          </div>
          <Link href="/photo" className="btn-secondary" style={{ width: '100%', textDecoration: 'none' }}>
            Upload Photos <ImageIcon size={18} />
          </Link>
        </div>

      </div>
    </div>
  );
}
