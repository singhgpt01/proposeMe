import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';
import { generateProposal } from '../api';
import { LogOut, PlusCircle, FileText, Loader, Send } from 'lucide-react';

const Dashboard = ({ user }) => {
  const [formData, setFormData] = useState({
    title: '',
    clientName: '',
    projectType: 'Freelance',
    description: '',
    deliverables: '',
    timeline: '',
    budget: '',
    additionalNotes: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState(null);

  useEffect(() => {
    fetchProposals();
  }, [user]);

  const fetchProposals = async () => {
    if (!user || !db) return;
    setLoadingProposals(true);
    try {
      const q = query(
        collection(db, 'proposals'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const fetchedProposals = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProposals(fetchedProposals);
    } catch (error) {
      console.error("Error fetching proposals:", error);
    } finally {
      setLoadingProposals(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async () => {
    const { title, clientName, description } = formData;
    if (!title || !clientName || !description) {
      alert("Please fill in the Title, Client Name, and Project Description.");
      return;
    }

    if (!db) {
      alert("Database is not initialized.");
      return;
    }

    setIsGenerating(true);
    try {
      // Build structured prompt
      const structuredPrompt = `
        Generate a professional business proposal with the following details:
        - Proposal Title: ${formData.title}
        - Client Name: ${formData.clientName}
        - Project Type: ${formData.projectType}
        - Project Description: ${formData.description}
        - Deliverables: ${formData.deliverables}
        - Timeline: ${formData.timeline}
        - Budget: ${formData.budget || 'Not specified'}
        - Additional Notes: ${formData.additionalNotes}

        The output MUST be divided into these exact sections:
        1. Introduction
        2. Project Understanding
        3. Proposed Solution
        4. Scope of Work
        5. Timeline
        6. Pricing / Budget
        7. Terms & Conditions
        8. Closing Statement

        Use professional, persuasive language. Use plain text ONLY. DO NOT use markdown, bolding (**), or special symbols. Use clear, simple headings.
      `;

      const result = await generateProposal(structuredPrompt);

      await addDoc(collection(db, 'proposals'), {
        userId: user.uid,
        title: formData.title,
        clientName: formData.clientName,
        prompt: structuredPrompt,
        content: result.proposal,
        createdAt: serverTimestamp()
      });

      // Reset form
      setFormData({
        title: '',
        clientName: '',
        projectType: 'Freelance',
        description: '',
        deliverables: '',
        timeline: '',
        budget: '',
        additionalNotes: ''
      });

      fetchProposals();
    } catch (error) {
      console.error("Error generating proposal:", error);
      alert("Failed to generate proposal: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogout = () => signOut(auth);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--surface)' }}>
      {/* Modal for viewing proposal */}
      {selectedProposal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '2rem'
        }}>
          <div className="card" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', padding: '2.5rem' }}>
            <button
              onClick={() => setSelectedProposal(null)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', fontWeight: 'bold' }}
            >
              ×
            </button>
            <h2 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>{selectedProposal.title}</h2>
            <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
              For: {selectedProposal.clientName}
            </p>
            <hr style={{ marginBottom: '1.5rem', border: '0', borderTop: '1px solid #eee' }} />
            <div style={{ whiteSpace: 'pre-wrap', textAlign: 'left', lineHeight: '1.6' }}>
              {selectedProposal.content}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ backgroundColor: 'var(--white)', padding: '1rem 0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--primary)' }}>Proposeme</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>{user.email}</span>
            <button className="btn btn-outline" onClick={handleLogout} style={{ padding: '0.5rem 1rem' }}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="container" style={{ padding: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

          {/* Form Section */}
          <div className="card">
            <h3 style={{ marginBottom: '1.5rem' }}>Generate New Proposal</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Proposal Title *</label>
                  <input style={inputStyle} name="title" value={formData.title} onChange={handleInputChange} placeholder="Website Redesign" />
                </div>
                <div>
                  <label style={labelStyle}>Client Name *</label>
                  <input style={inputStyle} name="clientName" value={formData.clientName} onChange={handleInputChange} placeholder="Acme Corp" />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Project Type</label>
                <select style={inputStyle} name="projectType" value={formData.projectType} onChange={handleInputChange}>
                  <option>Freelance</option>
                  <option>Business</option>
                  <option>Marketing</option>
                  <option>Design</option>
                  <option>Software Development</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Project Description *</label>
                <textarea style={{ ...inputStyle, height: '80px' }} name="description" value={formData.description} onChange={handleInputChange} placeholder="What is the project about?" />
              </div>

              <div>
                <label style={labelStyle}>Deliverables</label>
                <textarea style={{ ...inputStyle, height: '60px' }} name="deliverables" value={formData.deliverables} onChange={handleInputChange} placeholder="What will you deliver?" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Timeline</label>
                  <input style={inputStyle} name="timeline" value={formData.timeline} onChange={handleInputChange} placeholder="3 Months" />
                </div>
                <div>
                  <label style={labelStyle}>Budget (Optional)</label>
                  <input style={inputStyle} name="budget" value={formData.budget} onChange={handleInputChange} placeholder="$5,000" />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Additional Notes</label>
                <textarea style={{ ...inputStyle, height: '60px' }} name="additionalNotes" value={formData.additionalNotes} onChange={handleInputChange} placeholder="Any specific requirements?" />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={isGenerating}
                style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
              >
                {isGenerating ? <Loader className="spin" size={20} /> : <Send size={20} />}
                {isGenerating ? 'Generating Proposal...' : 'Generate Proposal'}
              </button>
            </div>
          </div>

          {/* List Section */}
          <div>
            <h3 style={{ marginBottom: '1.5rem' }}>Your Proposals</h3>
            {loadingProposals ? (
              <p>Loading...</p>
            ) : proposals.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: 'var(--text-light)' }}>No proposals yet.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {proposals.map(proposal => (
                  <div key={proposal.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '1.1rem' }}>{proposal.title}</strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Client: {proposal.clientName}</span>
                    </div>
                    <button className="btn btn-outline" onClick={() => setSelectedProposal(proposal)}>
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

const labelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: '600',
  marginBottom: '0.4rem',
  color: 'var(--primary)'
};

const inputStyle = {
  width: '100%',
  padding: '0.6rem',
  borderRadius: 'var(--border-radius)',
  border: '1px solid #ddd',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  outline: 'none'
};

export default Dashboard;
