import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { generateProposal } from '../api';
import { 
  LogOut, PlusCircle, FileText, Loader, Send, Trash2, 
  Download, Check, X, User, Briefcase, AlignLeft, 
  Layers, Clock, DollarSign, MessageSquare, Search,
  Eye, FileEdit, LayoutDashboard, ChevronRight
} from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');

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

    setIsGenerating(true);
    try {
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
    if (e) e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'proposals', id));
      setProposals(prev => prev.filter(p => p.id !== id));
      if (selectedProposal?.id === id) setSelectedProposal(null);
      setDeletingId(null);
    } catch (error) {
      console.error("Error deleting proposal:", error);
      alert("Failed to delete proposal.");
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
      const pdfDoc = new jsPDF();
      const margin = 20;
      const pageWidth = pdfDoc.internal.pageSize.getWidth();
      const contentWidth = pageWidth - (2 * margin);
      
      pdfDoc.setFontSize(22);
      pdfDoc.setTextColor(15, 23, 42);
      pdfDoc.text(selectedProposal.title || "Proposal", margin, 30);
      
      pdfDoc.setFontSize(12);
      pdfDoc.setTextColor(100, 116, 139);
      pdfDoc.text(`Client: ${selectedProposal.clientName || 'N/A'}`, margin, 40);
      
      pdfDoc.setDrawColor(226, 232, 240);
      pdfDoc.line(margin, 55, pageWidth - margin, 55);
      
      pdfDoc.setFontSize(11);
      pdfDoc.setTextColor(30, 41, 59);
      const splitText = pdfDoc.splitTextToSize(selectedProposal.content || "", contentWidth);
      pdfDoc.text(splitText, margin, 65);
      
      pdfDoc.save(`${(selectedProposal.title || 'Proposal').replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF.");
    }
  };

  const filteredProposals = proposals.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
      {/* Premium Navbar */}
      <nav className="glass" style={{ position: 'sticky', top: 0, zIndex: 50, padding: '0.75rem 0' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              background: 'var(--accent-gradient)', 
              width: '32px', height: '32px', 
              borderRadius: '8px', display: 'flex', 
              alignItems: 'center', justifyContent: 'center',
              color: 'white'
            }}>
              <FileText size={18} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', letterSpacing: '-0.025em' }}>
              Propose<span className="gradient-text">Me</span>
            </h2>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ textAlign: 'right', display: 'none', sm: 'block' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.displayName || 'User'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</div>
            </div>
            <button className="btn btn-ghost" onClick={() => signOut(auth)} style={{ padding: '0.5rem' }}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      <main className="container" style={{ padding: '2rem 0', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 450px) 1fr', gap: '2.5rem', alignItems: 'start' }}>
          
          {/* Left: Input Form Card */}
          <div className="card" style={{ position: 'sticky', top: '5rem' }}>
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Create Proposal</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Fill in the details to generate an AI proposal.</p>
            </div>

            <div style={{ display: 'grid', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label style={labelStyle}>Proposal Title</label>
                  <div style={inputWrapperStyle}>
                    <Briefcase size={16} style={iconStyle} />
                    <input style={inputStyle} name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g. UX Audit" />
                  </div>
                </div>
                <div className="form-group">
                  <label style={labelStyle}>Client Name</label>
                  <div style={inputWrapperStyle}>
                    <User size={16} style={iconStyle} />
                    <input style={inputStyle} name="clientName" value={formData.clientName} onChange={handleInputChange} placeholder="e.g. Acme Inc" />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label style={labelStyle}>Project Category</label>
                <div style={inputWrapperStyle}>
                  <Layers size={16} style={iconStyle} />
                  <select style={inputStyle} name="projectType" value={formData.projectType} onChange={handleInputChange}>
                    <option>Freelance</option>
                    <option>Business</option>
                    <option>Marketing</option>
                    <option>Software Development</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label style={labelStyle}>Description</label>
                <textarea style={{ ...inputStyle, height: '100px', padding: '0.75rem' }} name="description" value={formData.description} onChange={handleInputChange} placeholder="Describe the project goal..." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label style={labelStyle}>Timeline</label>
                  <div style={inputWrapperStyle}>
                    <Clock size={16} style={iconStyle} />
                    <input style={inputStyle} name="timeline" value={formData.timeline} onChange={handleInputChange} placeholder="e.g. 4 weeks" />
                  </div>
                </div>
                <div className="form-group">
                  <label style={labelStyle}>Budget</label>
                  <div style={inputWrapperStyle}>
                    <DollarSign size={16} style={iconStyle} />
                    <input style={inputStyle} name="budget" value={formData.budget} onChange={handleInputChange} placeholder="Optional" />
                  </div>
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={isGenerating}
                style={{ width: '100%', marginTop: '1rem', height: '48px', fontSize: '1rem' }}
              >
                {isGenerating ? <Loader className="spin" size={20} /> : <Send size={20} />}
                {isGenerating ? 'Crafting with AI...' : 'Generate Proposal'}
              </button>
            </div>
          </div>

          {/* Right: Saved Proposals List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Saved Proposals</h3>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  style={{ ...inputStyle, paddingLeft: '2.5rem', width: '250px', backgroundColor: 'var(--surface)' }} 
                  placeholder="Search proposals..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {loadingProposals ? (
              <div style={{ textAlign: 'center', padding: '4rem' }}>
                <Loader className="spin" size={32} style={{ color: 'var(--accent)' }} />
                <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Fetching your masterpieces...</p>
              </div>
            ) : filteredProposals.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '5rem', borderStyle: 'dashed' }}>
                <div style={{ background: 'var(--background)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                  <PlusCircle size={32} style={{ color: 'var(--text-muted)' }} />
                </div>
                <h4>No proposals found</h4>
                <p style={{ color: 'var(--text-muted)', maxWidth: '300px', margin: '0.5rem auto' }}>
                  Generate your first proposal using the form on the left.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {filteredProposals.map(proposal => (
                  <div key={proposal.id} className="card card-hover" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem' }}>
                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                      <div style={{ background: 'rgba(79, 70, 229, 0.1)', color: 'var(--accent)', padding: '0.75rem', borderRadius: '12px' }}>
                        <FileText size={24} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>{proposal.title}</h4>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <User size={14} /> {proposal.clientName}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={14} /> {proposal.createdAt?.toDate().toLocaleDateString() || 'Just now'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button className="btn btn-outline" onClick={() => setSelectedProposal(proposal)} style={{ padding: '0.5rem 1rem' }}>
                        <Eye size={16} /> View
                      </button>
                      <button 
                        className="btn btn-outline" 
                        onClick={(e) => { e.stopPropagation(); setDeletingId(proposal.id); }}
                        style={{ color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modern Modal for viewing proposal */}
      {selectedProposal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '2rem'
        }}>
          <div className="card" style={{ maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 0, border: 'none', boxShadow: 'var(--shadow-premium)' }}>
            <div className="glass" style={{ padding: '1.5rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{selectedProposal.title}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Client: {selectedProposal.clientName}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {!isEditing ? (
                  <>
                    <button className="btn btn-outline" onClick={handleEditClick}>
                      <FileEdit size={16} /> Edit
                    </button>
                    <button className="btn btn-primary" onClick={exportToPDF}>
                      <Download size={16} /> Export PDF
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-primary" onClick={handleSaveEdit} disabled={isSaving}>
                      {isSaving ? <Loader className="spin" size={16} /> : <Check size={16} />}
                      Save Changes
                    </button>
                    <button className="btn btn-outline" onClick={() => setIsEditing(false)}>
                      <X size={16} /> Cancel
                    </button>
                  </>
                )}
                <button 
                  onClick={() => setSelectedProposal(null)}
                  style={{ background: 'var(--background)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ padding: '2.5rem' }}>
              {isEditing ? (
                <textarea
                  style={{ 
                    ...inputStyle, 
                    height: '500px', 
                    fontSize: '1rem', 
                    lineHeight: '1.7',
                    padding: '1.5rem',
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)'
                  }}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', color: 'var(--text)', fontSize: '1.05rem' }}>
                  {selectedProposal.content}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Overlay */}
      {deletingId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '350px', textAlign: 'center' }}>
            <div style={{ color: 'var(--error)', marginBottom: '1rem' }}><Trash2 size={40} style={{ margin: '0 auto' }} /></div>
            <h4>Delete Proposal?</h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-primary" style={{ backgroundColor: 'var(--error)', flex: 1 }} onClick={() => handleDelete(deletingId)}>Delete</button>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setDeletingId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.5rem',
  color: 'var(--text-muted)'
};

const inputWrapperStyle = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center'
};

const iconStyle = {
  position: 'absolute',
  left: '0.75rem',
  color: 'var(--text-muted)',
  pointerEvents: 'none'
};

const inputStyle = {
  width: '100%',
  padding: '0.625rem 0.75rem 0.625rem 2.5rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  fontSize: '0.9rem',
  outline: 'none',
  backgroundColor: 'var(--input-bg)',
  color: 'var(--text)',
};

export default Dashboard;

