import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { generateProposal, regenerateSection } from '../api';
import { 
  LogOut, PlusCircle, FileText, Loader, Send, Trash2, 
  Download, Check, X, User, Briefcase, AlignLeft, 
  Layers, Clock, DollarSign, MessageSquare, Search,
  Eye, FileEdit, LayoutDashboard, ChevronRight, Copy, RefreshCcw, Save
} from 'lucide-react';
import { jsPDF } from 'jspdf';

const Dashboard = ({ user }) => {
  const [formData, setFormData] = useState({
    title: '',
    clientName: '',
    projectType: 'General Proposal',
    description: '',
    deliverables: '',
    timeline: '',
    budget: '',
    additionalNotes: '',
    tone: 'Professional'
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
  const [currentStep, setCurrentStep] = useState(1);
  const [generationPhase, setGenerationPhase] = useState(0);
  const [proposalSections, setProposalSections] = useState([]);
  const [editingSectionIndex, setEditingSectionIndex] = useState(null);
  const [isRegeneratingSection, setIsRegeneratingSection] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const loadingMessages = [
    "Analyzing your project...",
    "Crafting proposal structure...",
    "Finalizing professional output..."
  ];

  const sectionHeaders = [
    "Introduction", "Project Understanding", "Proposed Solution", 
    "Scope of Work", "Timeline", "Pricing / Budget", 
    "Terms & Conditions", "Closing Statement",
    "Design Concept", "Site Analysis", "Technical Stack",
    "Target Audience", "KPIs & Reporting", "Material Specification",
    "Safety Standards", "Maintenance & Support"
  ];

  const typeSpecificInstructions = {
    "General Proposal": "Create a standard professional business proposal.",
    "Freelance Proposal": "Focus on personal expertise, individual milestones, and flexible project terms.",
    "Architecture Proposal": "Include sections for 'Design Concept' and 'Site Analysis'. Focus on spatial planning and structural integrity.",
    "Interior Design Proposal": "Include sections for 'Design Concept' and 'Material Specification'. Focus on aesthetics, lighting, and mood.",
    "Web Development Proposal": "Include sections for 'Technical Stack' and 'Maintenance & Support'. Focus on user experience, performance, and security.",
    "Digital Marketing Proposal": "Include sections for 'Target Audience' and 'KPIs & Reporting'. Focus on ROI, growth strategies, and channel optimization.",
    "Construction Proposal": "Include sections for 'Safety Standards' and 'Material Sourcing'. Focus on compliance, durability, and timeline precision."
  };

  const parseProposal = (content) => {
    if (!content) return [];
    
    // Check if it's already an object (from Firestore Map) or JSON string
    try {
      const data = typeof content === 'object' ? content : JSON.parse(content);
      return Object.entries(data).map(([title, content]) => ({ title, content }));
    } catch (e) {
      // Fallback to legacy parsing if not JSON
      const sections = [];
      let currentTitle = "Overview";
      let currentContent = "";
      
      const lines = content.split('\n');
      lines.forEach(line => {
        const cleanLine = line.trim();
        const matchedHeader = sectionHeaders.find(h => 
          cleanLine.toLowerCase() === h.toLowerCase() || 
          cleanLine.match(new RegExp(`^\\d+\\.?\\s*${h.toLowerCase()}$`, 'i'))
        );
        
        if (matchedHeader) {
          if (currentContent.trim()) {
            sections.push({ title: currentTitle, content: currentContent.trim() });
          }
          currentTitle = matchedHeader;
          currentContent = "";
        } else {
          currentContent += line + "\n";
        }
      });
      
      if (currentContent.trim()) {
        sections.push({ title: currentTitle, content: currentContent.trim() });
      }
      return sections;
    }
  };

  const handleNextStep = () => setCurrentStep(prev => Math.min(prev + 1, 3));
  const handlePrevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

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
    setGenerationPhase(0);
    const interval = setInterval(() => {
      setGenerationPhase(prev => (prev + 1) % 3);
    }, 2500);

    try {
      const result = await generateProposal({
        title: formData.title,
        client_name: formData.clientName,
        proposal_type: formData.projectType,
        description: formData.description,
        deliverables: formData.deliverables,
        timeline: formData.timeline,
        budget: formData.budget,
        additional_notes: formData.additionalNotes,
        tone: formData.tone
      });

      if (!result || !result.proposal) {
        throw new Error("AI failed to generate content. Please try again.");
      }

      const contentToStore = result.proposal;
      
      // Ensure content is not empty object
      if (typeof contentToStore === 'object' && Object.keys(contentToStore).length === 0) {
        throw new Error("AI returned empty content. Please refine your description.");
      }
      
      // Attempt to clean/verify JSON if needed, but we'll store as is
      // and let the parser handle it.

      const docRef = await addDoc(collection(db, 'proposals'), {
        userId: user.uid,
        title: formData.title,
        clientName: formData.clientName,
        prompt: "Generated via Backend",
        content: contentToStore,
        createdAt: serverTimestamp()
      });

      setSelectedProposal({
        id: docRef.id,
        title: formData.title,
        clientName: formData.clientName,
        content: contentToStore,
        createdAt: { toDate: () => new Date() }
      });

      setFormData({
        title: '',
        clientName: '',
        projectType: 'General Proposal',
        description: '',
        deliverables: '',
        budget: '',
        additionalNotes: '',
        tone: 'Professional'
      });
      setCurrentStep(1);

      fetchProposals();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error) {
      console.error("Error generating proposal:", error);
      alert("Failed to generate proposal: " + error.message);
    } finally {
      clearInterval(interval);
      setIsGenerating(false);
    }
  };

  const handleRegenerateSection = async (index) => {
    setIsRegeneratingSection(index);
    try {
      const sectionToRegenerate = proposalSections[index].title;
      const prompt = `
        Regenerate ONLY the "${sectionToRegenerate}" section for the following project:
        Title: ${selectedProposal.title}
        Client: ${selectedProposal.clientName}
        
        Keep it professional and aligned with the rest of the proposal.
        Return ONLY the content of this section, no headers.
      `;
      
      const result = await regenerateSection(prompt);
      const updatedSections = [...proposalSections];
      
      // Handle potential object response from backend fallback
      const newContent = typeof result.proposal === 'object' && result.proposal.content 
        ? result.proposal.content 
        : result.proposal;

      updatedSections[index].content = newContent;
      setProposalSections(updatedSections);
      
      // Auto-save the update
      await updateDoc(doc(db, 'proposals', selectedProposal.id), {
        content: updatedSections.map(s => `${s.title}\n${s.content}`).join('\n\n'),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error regenerating section:", error);
      alert("Failed to regenerate section.");
    } finally {
      setIsRegeneratingSection(null);
    }
  };

  const copySectionToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  const handleSectionUpdate = (index, newContent) => {
    const updatedSections = [...proposalSections];
    updatedSections[index].content = newContent;
    setProposalSections(updatedSections);
  };

  useEffect(() => {
    if (selectedProposal) {
      setProposalSections(parseProposal(selectedProposal.content));
    } else {
      setProposalSections([]);
    }
  }, [selectedProposal]);

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

  const filteredProposals = proposals.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Ensure proposal has content before showing it
    const hasContent = p.content && (
      typeof p.content === 'object' 
        ? Object.keys(p.content).length > 0 
        : p.content.trim().length > 0
    );
    
    return matchesSearch && hasContent;
  });

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
          
          {/* Left: Input Form Card (Wizard) */}
          <div className="card" style={{ position: 'sticky', top: '5rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.5rem', margin: 0 }}>Create Proposal</h3>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent)', background: 'rgba(79, 70, 229, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>
                  Step {currentStep} of 3
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {currentStep === 1 && "Let's start with the basics."}
                {currentStep === 2 && "Tell us about the project."}
                {currentStep === 3 && "Final details for the perfect proposal."}
              </p>
              
              {/* Progress Bar */}
              <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '3px', marginTop: '1rem', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(currentStep / 3) * 100}%`, background: 'var(--accent-gradient)', transition: 'width 0.3s ease' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gap: '1.25rem', minHeight: '340px' }}>
              {isGenerating ? (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: '1.5rem', padding: '2rem 0' }}>
                  <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                    <div className="loader-ring"></div>
                    <div className="loader-ring" style={{ animationDelay: '-0.5s', width: '60px', height: '60px', top: '10px', left: '10px' }}></div>
                    <FileText size={32} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <h4 className="animate-pulse" style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--accent)' }}>
                      {loadingMessages[generationPhase]}
                    </h4>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>AI is working its magic...</p>
                  </div>
                  <div style={{ width: '100%', maxWidth: '200px', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${((generationPhase + 1) / 3) * 100}%`, 
                      background: 'var(--accent-gradient)', 
                      transition: 'width 0.5s ease' 
                    }} />
                  </div>
                </div>
              ) : (
                <>
                  {/* Step 1 */}
                  {currentStep === 1 && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
                      <div className="form-group">
                        <label style={labelStyle}>Proposal Title</label>
                        <div style={inputWrapperStyle}>
                          <Briefcase size={16} style={iconStyle} />
                          <input style={inputStyle} name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g. Complete E-Commerce Redesign" />
                        </div>
                      </div>
                      <div className="form-group">
                        <label style={labelStyle}>Client Name</label>
                        <div style={inputWrapperStyle}>
                          <User size={16} style={iconStyle} />
                          <input style={inputStyle} name="clientName" value={formData.clientName} onChange={handleInputChange} placeholder="e.g. Acme Corp" />
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '1rem' }}>
                        <button 
                          className="btn btn-primary" 
                          onClick={handleNextStep} 
                          disabled={!formData.title || !formData.clientName}
                        >
                          Next Step <ChevronRight size={16} style={{ marginLeft: '0.5rem' }} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 2 */}
                  {currentStep === 2 && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
                      <div className="form-group">
                        <label style={labelStyle}>Project Category</label>
                        <div style={inputWrapperStyle}>
                          <Layers size={16} style={iconStyle} />
                          <select style={inputStyle} name="projectType" value={formData.projectType} onChange={handleInputChange}>
                            <option>General Proposal</option>
                            <option>Freelance Proposal</option>
                            <option>Architecture Proposal</option>
                            <option>Interior Design Proposal</option>
                            <option>Web Development Proposal</option>
                            <option>Digital Marketing Proposal</option>
                            <option>Construction Proposal</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label style={labelStyle}>Project Description</label>
                        <textarea 
                          style={{ ...inputStyle, height: '120px', padding: '0.75rem', resize: 'none' }} 
                          name="description" 
                          value={formData.description} 
                          onChange={handleInputChange} 
                          placeholder="e.g. A complete overhaul of the existing platform focusing on modern UI and better conversion..." 
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '1rem' }}>
                        <button className="btn btn-outline" onClick={handlePrevStep}>Back</button>
                        <button 
                          className="btn btn-primary" 
                          onClick={handleNextStep}
                          disabled={!formData.description}
                        >
                          Next Step <ChevronRight size={16} style={{ marginLeft: '0.5rem' }} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3 */}
                  {currentStep === 3 && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label style={labelStyle}>Timeline</label>
                          <div style={inputWrapperStyle}>
                            <Clock size={16} style={iconStyle} />
                            <input style={inputStyle} name="timeline" value={formData.timeline} onChange={handleInputChange} placeholder="e.g. 6-8 Weeks" />
                          </div>
                        </div>
                        <div className="form-group">
                          <label style={labelStyle}>Budget (Optional)</label>
                          <div style={inputWrapperStyle}>
                            <DollarSign size={16} style={iconStyle} />
                            <input style={inputStyle} name="budget" value={formData.budget} onChange={handleInputChange} placeholder="e.g. $15,000" />
                          </div>
                        </div>
                      </div>

                      <div className="form-group">
                        <label style={labelStyle}>Proposal Tone</label>
                        <div style={inputWrapperStyle}>
                          <MessageSquare size={16} style={iconStyle} />
                          <select style={inputStyle} name="tone" value={formData.tone} onChange={handleInputChange}>
                            <option>Professional</option>
                            <option>Formal</option>
                            <option>Friendly</option>
                            <option>Premium / High-end</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label style={labelStyle}>Additional Notes (Optional)</label>
                        <textarea 
                          style={{ ...inputStyle, height: '80px', padding: '0.75rem', resize: 'none' }} 
                          name="additionalNotes" 
                          value={formData.additionalNotes} 
                          onChange={handleInputChange} 
                          placeholder="Any specific requests or conditions?" 
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto', paddingTop: '1rem' }}>
                        <button className="btn btn-outline" onClick={handlePrevStep} style={{ width: '30%' }}>Back</button>
                        <button
                          className="btn btn-primary"
                          onClick={handleGenerate}
                          disabled={isGenerating}
                          style={{ width: '70%', height: '48px', fontSize: '1rem', background: 'var(--accent-gradient)', border: 'none', color: 'white' }}
                        >
                          {isGenerating ? <Loader className="spin" size={20} /> : <Send size={20} />}
                          {isGenerating ? 'Crafting with AI...' : 'Generate Instantly'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
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
              <div className="card" style={{ 
                textAlign: 'center', 
                padding: '6rem 2rem', 
                borderStyle: 'dashed', 
                background: 'rgba(255, 255, 255, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{ 
                  background: 'white', 
                  width: '80px', 
                  height: '80px', 
                  borderRadius: '24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginBottom: '1.5rem',
                  boxShadow: 'var(--shadow-md)'
                }}>
                  <PlusCircle size={40} style={{ color: 'var(--accent)' }} />
                </div>
                <h4 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Start Your Journey</h4>
                <p style={{ color: 'var(--text-muted)', maxWidth: '320px', margin: '0 auto', lineHeight: '1.6' }}>
                  Create your first professional proposal in seconds using our AI-powered wizard. 
                </p>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setCurrentStep(1)} 
                  style={{ marginTop: '2rem', padding: '0.75rem 2rem' }}
                >
                  Create Now
                </button>
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

      {selectedProposal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '2rem'
        }}>
          <div className="card animate-fade-in" style={{ maxWidth: '1000px', width: '100%', height: '90vh', display: 'flex', flexDirection: 'column', padding: 0, border: 'none', boxShadow: 'var(--shadow-premium)', overflow: 'hidden' }}>
            
            {/* Header */}
            <div className="glass" style={{ padding: '1.5rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, zIndex: 10 }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>{selectedProposal.title}</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <User size={14} /> {selectedProposal.clientName}
                  </span>
                  <span style={{ width: '4px', height: '4px', background: 'var(--border)', borderRadius: '50%' }}></span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock size={14} /> Generated on {selectedProposal.createdAt?.toDate().toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-outline" onClick={exportToPDF} style={{ padding: '0.625rem 1rem' }}>
                  <Download size={16} /> Export PDF
                </button>
                <button 
                  onClick={() => setSelectedProposal(null)}
                  style={{ background: 'var(--background)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'all 0.2s' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Document Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '3rem 4rem', backgroundColor: '#fff' }}>
              <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                {proposalSections.length > 0 ? (
                  proposalSections.map((section, idx) => (
                    <div key={idx} className="proposal-section" style={{ 
                      marginBottom: '2.5rem', 
                      position: 'relative',
                      padding: '1rem',
                      borderRadius: '8px',
                      marginLeft: '-1rem',
                      marginRight: '-1rem',
                      transition: 'all 0.2s ease'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', fontWeight: 800 }}>
                          {idx + 1}. {section.title}
                        </h4>
                        <div className="section-actions" style={{ display: 'flex', gap: '0.5rem', opacity: 0, transition: 'opacity 0.2s' }}>
                          <button 
                            onClick={() => copySectionToClipboard(section.content)}
                            className="btn-icon" 
                            title="Copy Section"
                          >
                            <Copy size={14} />
                          </button>
                          <button 
                            onClick={() => handleRegenerateSection(idx)}
                            className="btn-icon" 
                            disabled={isRegeneratingSection === idx}
                            title="Regenerate Section"
                          >
                            <RefreshCcw size={14} className={isRegeneratingSection === idx ? 'spin' : ''} />
                          </button>
                        </div>
                      </div>
                      
                      {editingSectionIndex === idx ? (
                        <textarea
                          autoFocus
                          style={{ 
                            width: '100%', 
                            minHeight: '100px', 
                            border: 'none', 
                            outline: 'none', 
                            fontSize: '1.05rem', 
                            lineHeight: '1.7', 
                            color: 'var(--text)',
                            fontFamily: 'inherit',
                            resize: 'none',
                            backgroundColor: 'rgba(79, 70, 229, 0.03)',
                            padding: '0.5rem',
                            borderRadius: '4px'
                          }}
                          value={section.content}
                          onChange={(e) => handleSectionUpdate(idx, e.target.value)}
                          onBlur={async () => {
                            setEditingSectionIndex(null);
                            // Save to DB when blur
                            await updateDoc(doc(db, 'proposals', selectedProposal.id), {
                              content: proposalSections.map(s => `${s.title}\n${s.content}`).join('\n\n'),
                              updatedAt: serverTimestamp()
                            });
                          }}
                        />
                      ) : (
                        <div 
                          onClick={() => setEditingSectionIndex(idx)}
                          style={{ 
                            fontSize: '1.05rem', 
                            lineHeight: '1.8', 
                            color: 'var(--text)', 
                            whiteSpace: 'pre-wrap',
                            cursor: 'text',
                            minHeight: '20px'
                          }}
                        >
                          {section.content || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Click to add content...</span>}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '5rem' }}>
                    <Loader className="spin" size={32} style={{ color: 'var(--accent)' }} />
                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Preparing document layout...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Status */}
            <div className="glass" style={{ padding: '0.75rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Click any section to edit inline. Changes save automatically.</span>
              <span>{proposalSections.length} Sections</span>
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
      {/* Success Feedback Notification */}
      {showSuccess && (
        <div className="animate-fade-in" style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--primary)',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '50px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          zIndex: 1000,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ background: 'var(--success)', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={14} color="white" strokeWidth={3} />
          </div>
          <span style={{ fontWeight: 600, letterSpacing: '0.01em' }}>Your proposal is ready!</span>
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

