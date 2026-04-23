import React from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { LogIn } from 'lucide-react';

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
      backgroundColor: 'var(--surface)'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '1rem' }}>Proposeme</h1>
        <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>
          Generate professional business proposals in seconds with AI.
        </p>
        <button className="btn btn-primary" onClick={handleLogin} style={{ width: '100%', justifyContent: 'center' }}>
          <LogIn size={20} />
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default Login;
