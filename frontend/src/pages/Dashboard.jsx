import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { generateProposal } from '../api';
import { LogOut, PlusCircle, FileText, Loader, Send, Trash2, Download, Check, X } from 'lucide-react';
import { jsPDF } from 'jspdf';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

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

  const handleDelete = async (id, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!db) {
      alert("Database not initialized.");
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'proposals', id));
      setProposals(prev => prev.filter(p => p.id !== id));
      if (selectedProposal?.id === id) setSelectedProposal(null);
      setDeletingId(null);
    } catch (error) {
      console.error("CRITICAL: Error deleting proposal:", error);
      alert("Failed to delete proposal: " + error.message);
    }
  };

  const handleEditClick = () => {
    setEditedContent(selectedProposal.content);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'proposals', selectedProposal.id), {
        content: editedContent,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setProposals(prev => prev.map(p => 
        p.id === selectedProposal.id ? { ...p, content: editedContent } : p
      ));
      setSelectedProposal(prev => ({ ...prev, content: editedContent }));
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating proposal:", error);
      alert("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const exportToPDF = () => {
    try {
      console.log("Starting PDF export for:", selectedProposal.title);
      const pdfDoc = new jsPDF();
      const margin = 20;
      const pageWidth = pdfDoc.internal.pageSize.getWidth();
      const pageHeight = pdfDoc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - (2 * margin);
      
      // Title
      pdfDoc.setFontSize(22);
      pdfDoc.setTextColor(51, 65, 85);
      pdfDoc.text(selectedProposal.title || "Proposal", margin, 30);
      
      // Metadata
      pdfDoc.setFontSize(12);
      pdfDoc.setTextColor(100, 116, 139);
      pdfDoc.text(`Client: ${selectedProposal.clientName || 'N/A'}`, margin, 40);
      
      let dateStr = "N/A";
      if (selectedProposal.createdAt) {
        try {
          const date = selectedProposal.createdAt.toDate ? selectedProposal.createdAt.toDate() : new Date(selectedProposal.createdAt);
          dateStr = date.toLocaleDateString();
        } catch (e) {
          console.warn("Date conversion failed", e);
        }
      }
      pdfDoc.text(`Date: ${dateStr}`, margin, 47);
      
      // Line
      pdfDoc.setDrawColor(226, 232, 240);
      pdfDoc.line(margin, 55, pageWidth - margin, 55);
      
      // Content
      pdfDoc.setFontSize(11);
      pdfDoc.setTextColor(30, 41, 59);
      
      const splitText = pdfDoc.splitTextToSize(selectedProposal.content || "", contentWidth);
      
      let cursorY = 65;
      const lineHeight = 7;
      
      splitText.forEach(line => {
        if (cursorY + lineHeight > pageHeight - margin) {
          pdfDoc.addPage();
          cursorY = margin;
        }
        pdfDoc.text(line, margin, cursorY);
        cursorY += lineHeight;
      });
      
      const fileName = `${(selectedProposal.title || 'Proposal').replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      
      // Manual download trigger for better compatibility
      const blob = pdfDoc.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log("PDF download triggered successfully.");
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Check console for details.");
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: 'var(--primary)' }}>{selectedProposal.title}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!isEditing ? (
                  <>
                    <button 
                      className="btn btn-outline" 
                      onClick={handleEditClick}
                      title="Edit Proposal"
                      style={{ padding: '0.5rem' }}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      className="btn btn-primary" 
                      onClick={exportToPDF}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      <Download size={16} /> Export PDF
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      className="btn btn-primary" 
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      {isSaving ? <Loader className="spin" size={16} /> : <Check size={16} />}
                      Save
                    </button>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => setIsEditing(false)}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      <X size={16} /> Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
              For: {selectedProposal.clientName}
            </p>
            <hr style={{ marginBottom: '1.5rem', border: '0', borderTop: '1px solid #eee' }} />
            
            {isEditing ? (
              <textarea
                style={{ 
                  ...inputStyle, 
                  height: '400px', 
                  fontSize: '1rem', 
                  lineHeight: '1.6',
                  padding: '1rem'
                }}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
              />
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', textAlign: 'left', lineHeight: '1.6' }}>
                {selectedProposal.content}
              </div>
            )}
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
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {deletingId === proposal.id ? (
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', backgroundColor: '#fee2e2', padding: '0.3rem 0.6rem', borderRadius: 'var(--border-radius)', border: '1px solid #fecaca' }}>
                          <span style={{ fontSize: '0.8rem', color: '#991b1b', fontWeight: 'bold' }}>Delete?</span>
                          <button 
                            className="btn btn-primary" 
                            onClick={(e) => handleDelete(proposal.id, e)}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#ef4444' }}
                          >
                            Yes
                          </button>
                          <button 
                            className="btn btn-outline" 
                            onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <button className="btn btn-outline" onClick={() => setSelectedProposal(proposal)}>
                            View
                          </button>
                          <button 
                            className="btn btn-outline" 
                            onClick={(e) => { e.stopPropagation(); setDeletingId(proposal.id); }}
                            style={{ color: '#ef4444', borderColor: '#fee2e2' }}
                            title="Delete Proposal"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
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
