import React from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { LogIn, FileText, Sparkles } from 'lucide-react';

const Login = () => {
  const handleLogin = async () => {
    if (!auth) {
      alert("Firebase authentication is not initialized. Please check your .env configuration.");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Please check your Firebase configuration.");
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--background)',
      backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.02) 1px, transparent 0)',
      backgroundSize: '32px 32px'
    }}>
      <div className="card" style={{ 
        maxWidth: '440px', 
        width: '100%', 
        textAlign: 'center', 
        padding: '3.5rem 2.5rem',
        boxShadow: 'var(--shadow-premium)',
        border: 'none'
      }}>
        <div style={{ 
          background: 'var(--accent-gradient)', 
          width: '64px', height: '64px', 
          borderRadius: '16px', display: 'flex', 
          alignItems: 'center', justifyContent: 'center',
          color: 'white',
          margin: '0 auto 1.5rem',
          boxShadow: '0 8px 16px -4px rgba(79, 70, 229, 0.4)'
        }}>
          <FileText size={32} />
        </div>
        
        <h1 style={{ fontSize: '2rem', marginBottom: '0.75rem', letterSpacing: '-0.025em' }}>
          Propose<span className="gradient-text">Me</span>
        </h1>
        
        <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', fontSize: '1rem', lineHeight: '1.6' }}>
          Craft professional, high-converting business proposals in seconds with AI.
        </p>

        <button 
          className="btn btn-primary" 
          onClick={handleLogin} 
          style={{ width: '100%', height: '52px', fontSize: '1rem', gap: '0.75rem' }}
        >
          <LogIn size={20} />
          Sign in with Google
        </button>

        <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          <Sparkles size={16} style={{ color: 'var(--warning)' }} />
          <span>Powered by Gemini AI</span>
        </div>
      </div>
    </div>
  );
};

export default Login;

