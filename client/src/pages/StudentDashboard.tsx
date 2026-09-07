import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, User, FileText, Settings, LogOut, Search, Bell, HelpCircle, Book, Building, Dumbbell, Briefcase, AlertCircle, Clock, CheckCircle2, Send, ShieldCheck, FlaskConical, Microscope, Monitor, Award, UserCog, Lock } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, writeBatch, limit, setDoc } from 'firebase/firestore';
import emailjs from '@emailjs/browser';
import NoDueCertificate from '../components/NoDueCertificate';
import FeeReceipt from '../components/FeeReceipt';

const EMAILJS_SERVICE_ID = 'service_yato66e';
const EMAILJS_PUBLIC_KEY = 'uX0TI21Zg8bha0FM0';
// TODO: Replace this with your new Template ID for the submission email
const EMAILJS_SUBMISSION_TEMPLATE_ID = 'template_zdq3aos';

const PUC_DEPARTMENTS = [
  'Hostel', 'Sports', 'Physics Lab', 'Chemistry Lab', 'Biology Lab',
  'COE', 'Library', 'IT Infra', 'Scholarship Office',
  'FO', 'AO', 'Director', 'Dean of Academics'
];

const BTECH_DEPARTMENTS = [
  'Hostel', 'Sports', 'Physics Lab', 'Chemistry Lab', 'Biology Lab',
  'COE', 'HOD', 'Library', 'IT Infra', 'Scholarship Office',
  'FO', 'AO', 'Director', 'Dean of Academics'
];

export default function StudentDashboard() {
  const [data, setData] = useState<any>(null);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [isInitiating, setIsInitiating] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [confirmCancelDept, setConfirmCancelDept] = useState<string | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<'PUC' | 'B.Tech'>('PUC');
  const [showScholarshipModal, setShowScholarshipModal] = useState(false);
  const [scholarshipId, setScholarshipId] = useState('');
  const [pendingDepartments, setPendingDepartments] = useState<string[]>([]);
  const [showFeeBreakdown, setShowFeeBreakdown] = useState(false);
  const [showFeeReceipt, setShowFeeReceipt] = useState(false);
  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login');
      return;
    }
    const user = JSON.parse(userStr);
    
    try {
      const studentData: any = { id: user.id, ...user };
      
      const studentDocRef = doc(db, 'students', user.id);
      const studentSnap = await getDoc(studentDocRef);
      if (studentSnap.exists()) {
        const sData = studentSnap.data();
        if (sData.studentId) studentData.studentId = sData.studentId;
        if (sData.program) studentData.program = sData.program;
      }
      
      const crQuery = query(collection(db, 'clearanceRequests'), where('studentId', '==', user.id), limit(1));
      const crSnap = await getDocs(crQuery);
      
      if (!crSnap.empty) {
        const crDoc = crSnap.docs[0];
        studentData.clearanceRequest = { id: crDoc.id, ...crDoc.data(), departmentClearances: [] };
        
        const dcQuery = query(collection(db, 'departmentClearances'), where('requestId', '==', crDoc.id));
        const dcSnap = await getDocs(dcQuery);
        const deps = dcSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        studentData.clearanceRequest.departmentClearances = deps;

        // Automatically show popup if there's a rejected department
        const rejectedDept = deps.find((d: any) => d.status === 'REJECTED');
        if (rejectedDept) {
          setSelectedDept(rejectedDept);
        }
      }
      
      setData(studentData);
    } catch(err) {
      console.error(err);
      navigate('/login');
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [navigate]);

  const handleSendRequest = (departments: string[], programType?: string) => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : {};
    
    if (departments.includes('Scholarship Office') && !user.scholarshipId) {
      setPendingDepartments(departments);
      setShowScholarshipModal(true);
    } else {
      requestClearance(departments, programType);
    }
  };

  const handleScholarshipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scholarshipId) return;
    
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : {};
    
    try {
      const userRef = doc(db, 'students', user.id);
      await setDoc(userRef, { scholarshipId }, { merge: true });
      
      const updatedUser = { ...user, scholarshipId };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      setShowScholarshipModal(false);
      requestClearance(pendingDepartments, data?.clearanceRequest?.programType || selectedProgram);
    } catch(err) {
      alert('Failed to save Scholarship ID');
    }
  };

  const requestClearance = async (departments: string[], programType?: string) => {
    try {
      setIsSubmitting(true);
      await new Promise(resolve => setTimeout(resolve, 800));

      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      const crQuery = query(collection(db, 'clearanceRequests'), where('studentId', '==', user.id), limit(1));
      const crSnap = await getDocs(crQuery);
      
      const batch = writeBatch(db);
      
      if (crSnap.empty) {
        const crRef = doc(collection(db, 'clearanceRequests'));
        batch.set(crRef, {
          studentId: user.id,
          programType: programType || 'PUC',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        
        for (const d of departments) {
          const dcRef = doc(collection(db, 'departmentClearances'));
          batch.set(dcRef, {
            requestId: crRef.id,
            departmentName: d,
            status: d === (programType === 'B.Tech' ? BTECH_DEPARTMENTS[0] : PUC_DEPARTMENTS[0]) ? 'PENDING' : 'LOCKED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        const crId = crSnap.docs[0].id;
        const dcQuery = query(collection(db, 'departmentClearances'), where('requestId', '==', crId));
        const dcSnap = await getDocs(dcQuery);
        const existingDeps = dcSnap.docs.map(d => d.data().departmentName);
        
        const newDeps = departments.filter(d => !existingDeps.includes(d));
        for (const d of newDeps) {
          const dcRef = doc(collection(db, 'departmentClearances'));
          batch.set(dcRef, {
            requestId: crId,
            departmentName: d,
            status: d === (crSnap.docs[0].data().programType === 'B.Tech' ? BTECH_DEPARTMENTS[0] : PUC_DEPARTMENTS[0]) ? 'PENDING' : 'LOCKED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
      
      await batch.commit();

      // Generate Beautiful HTML Email Notification with Green Theme
      const htmlMessage = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 0; border: 1px solid #dcfce7; border-radius: 12px; background-color: #ffffff; overflow: hidden; box-shadow: 0 4px 15px rgba(22, 163, 74, 0.1);">
          
          <!-- Header with Green Gradient and Animation -->
          <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 24px 20px; text-align: center; color: white;">
            <!-- Simple CSS for email animation (works in modern clients like Apple Mail, fallback to static in Gmail) -->
            <style>
              @keyframes popIn {
                0% { transform: scale(0); opacity: 0; }
                80% { transform: scale(1.1); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
              }
            </style>
            <table width="72" height="72" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px auto; background-color: white; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.1); animation: popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;">
              <tr>
                <td align="center" valign="middle" style="height: 72px;">
                  <div style="width:72px; height:72px; line-height:72px; text-align:center; border-radius:50%; font-size:40px; color:#16a34a; font-weight:bold;">
                    &#10003;
                  </div>
                </td>
              </tr>
            </table>
            <h2 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Application Submitted!</h2>
          </div>
          
          <div style="padding: 30px;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
              Hello <strong>${user.name}</strong>,<br><br>
              Great news! Your clearance application has been successfully initiated and is now in the system.
            </p>
            
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;"><strong>Student Name:</strong> ${user.name}</p>
              <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;"><strong>Student ID:</strong> ${data?.studentId || user.id}</p>
              <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;"><strong>Email:</strong> ${user.email}</p>
              <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;"><strong>Program:</strong> ${programType || data?.program || 'PUC'}</p>
              <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;"><strong>Submitted On:</strong> ${new Date().toLocaleString()}</p>
              <p style="margin: 0; color: #334155; font-size: 14px;"><strong>Current Status:</strong> <span style="background-color: #dcfce7; padding: 2px 8px; border-radius: 12px; font-weight: 600; color: #16a34a;">Pending at ${departments[0]}</span></p>
            </div>
            
            <div style="margin-bottom: 24px;">
              <p style="margin: 0 0 8px 0; color: #475569; font-size: 14px; font-weight: 600;">Your Clearance Path:</p>
              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; padding: 12px; background-color: #f8fafc; border-radius: 6px;">
                ${departments.join(' &rarr; ')}
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://rguktclearance.vercel.app/" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(22, 163, 74, 0.2);">Track Application Status</a>
            </div>
          </div>
          
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              RGUKT Clearance Hub<br>
              This is an automated message, please do not reply.
            </p>
          </div>
        </div>
      `;

      // Send EmailJS Notification
      try {
        if (user.email) {
          await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_SUBMISSION_TEMPLATE_ID,
            {
              to_name: user.name,
              to_email: user.email,
              html_message: htmlMessage
            },
            EMAILJS_PUBLIC_KEY
          );
          console.log('Submission email sent successfully!');
        } else {
          console.error("User email is missing");
        }
      } catch (emailErr: any) {
        console.error('Failed to send submission email:', emailErr);
        alert('Email sending failed! Error: ' + (emailErr.text || emailErr.message || JSON.stringify(emailErr)));
      }
      
      setIsSubmitting(false);
      setSubmitSuccess(true);
      
      setTimeout(async () => {
        await fetchDashboardData();
        setSubmitSuccess(false);
        setIsInitiating(false);
      }, 1500);
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
      alert('Failed to request clearance');
    }
  };

  const confirmCancelClearance = async () => {
    if (!confirmCancelDept) return;
    
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      const crQuery = query(collection(db, 'clearanceRequests'), where('studentId', '==', user.id), limit(1));
      const crSnap = await getDocs(crQuery);
      if (crSnap.empty) return;
      
      const crId = crSnap.docs[0].id;
      
      const dcQuery = query(collection(db, 'departmentClearances'), where('requestId', '==', crId), where('departmentName', '==', confirmCancelDept), limit(1));
      const dcSnap = await getDocs(dcQuery);
      
      if (!dcSnap.empty) {
        const batch = writeBatch(db);
        batch.delete(dcSnap.docs[0].ref);
        
        const allDcQuery = query(collection(db, 'departmentClearances'), where('requestId', '==', crId));
        const allDcSnap = await getDocs(allDcQuery);
        
        if (allDcSnap.size === 1) { 
          batch.delete(crSnap.docs[0].ref);
        }
        
        await batch.commit();
      }
      
      setConfirmCancelDept(null);
      await fetchDashboardData();
    } catch (e: any) {
      alert('Failed to cancel clearance');
      setConfirmCancelDept(null);
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!data) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary"></div>
    </div>
  );

  const request = data.clearanceRequest;
  const currentProgram = request?.programType || selectedProgram;
  const currentDepartments = currentProgram === 'B.Tech' ? BTECH_DEPARTMENTS : PUC_DEPARTMENTS;
  const deps = request ? request.departmentClearances : [];
  
  
  
  
  

  const getIcon = (name: string) => {
    const n = name.toUpperCase();
    if (n.includes('LIBRARY')) return <Book className="w-6 h-6" />;
    if (n.includes('HOSTEL')) return <Building className="w-6 h-6" />;
    if (n.includes('SPORTS')) return <Dumbbell className="w-6 h-6" />;
    if (n.includes('FO') || n.includes('ACCOUNT')) return <Briefcase className="w-6 h-6" />;
    if (n.includes('CHEMISTRY') || n.includes('PHYSICS')) return <FlaskConical className="w-6 h-6" />;
    if (n.includes('BIOLOGY')) return <Microscope className="w-6 h-6" />;
    if (n.includes('IT INFRA')) return <Monitor className="w-6 h-6" />;
    if (n.includes('SCHOLARSHIP')) return <Award className="w-6 h-6" />;
    if (n.includes('DEAN') || n.includes('DIRECTOR') || n.includes('AO') || n.includes('COE') || n.includes('HOD')) return <UserCog className="w-6 h-6" />;
    return <CheckSquare className="w-6 h-6" />;
  };

  return (
    <div className="flex min-h-screen text-on-background font-body-md antialiased">
      
      {/* SideNavBar Component */}
      <aside className="bg-primary-container h-full w-64 fixed left-0 top-0 rounded-r-3xl border-r border-outline-variant/10 shadow-xl flex flex-col py-8 z-50">
        <div className="px-6 mb-8 flex flex-col items-center">
          <div className="w-24 h-24 mb-4 flex items-center justify-center">
            <img src="/logo.png" alt="RGUKT Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-headline-sm text-lg font-bold text-surface-container-lowest text-center">RGUKT CLEARANCE HUB</h1>
          <p className="font-label-sm text-on-primary-container mt-1">Digital Campus Portal</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${activeTab === 'dashboard' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('clearance')}
            className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${activeTab === 'clearance' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
          >
            <CheckSquare className="w-5 h-5" />
            Clearance
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${activeTab === 'profile' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
          >
            <User className="w-5 h-5" />
            Profile
          </button>
        </nav>
        
        <div className="mt-auto px-4 space-y-2 border-t border-outline-variant/10 pt-4">

          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2 text-on-primary-container/70 font-label-md hover:bg-surface-variant/20 hover:text-red-400 transition-all duration-300 rounded-lg">
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        
        {/* TopNavBar Component */}
        {activeTab !== 'profile' && (
          <header className="bg-surface/80 top-0 sticky backdrop-blur-md border-b border-outline-variant/20 shadow-sm flex justify-between items-center h-16 px-8 z-40">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                <input className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant/50 rounded-lg text-sm focus:outline-none focus:border-secondary-container focus:ring-1 focus:ring-secondary-container transition-colors" placeholder="Search departments, documents..." type="text" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-on-surface-variant hover:text-secondary p-2 rounded-full hover:bg-surface-variant/50">
                <Bell className="w-5 h-5" />
              </button>
              <button className="text-on-surface-variant hover:text-secondary p-2 rounded-full hover:bg-surface-variant/50">
                <HelpCircle className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-full bg-primary-fixed overflow-hidden border border-outline-variant/30 ml-2 cursor-pointer flex items-center justify-center text-primary font-bold">
                {data.user?.name?.charAt(0) || 'S'}
              </div>
            </div>
          </header>
        )}

        {/* Page Content */}
        <main className="flex-1 p-8 max-w-[1440px] mx-auto w-full overflow-hidden">
          <div key={activeTab} className="animate-in fade-in slide-in-from-right-8 duration-500 fill-mode-both">
          {activeTab === 'dashboard' && (
            <>
          {!request && !isInitiating && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center bg-surface-container-lowest rounded-3xl border border-surface-variant shadow-lg p-10 animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <CheckSquare className="w-10 h-10 text-blue-500" />
              </div>
              <h2 className="font-headline-md text-3xl font-bold text-primary mb-4">Start Your Clearance Journey</h2>
              <p className="font-body-md text-on-surface-variant max-w-md mb-8 text-lg">You haven't initiated your clearance process yet. Send a request to all departments simultaneously to kick off your No-Dues certificate generation.</p>
              <button 
                onClick={() => setShowProgramModal(true)} 
                className="bg-blue-600 text-white px-8 py-4 rounded-xl font-label-md text-lg font-bold shadow-lg hover:bg-blue-700 hover:scale-105 hover:shadow-blue-500/25 transition-all duration-300 flex items-center gap-3"
              >
                <Send className="w-5 h-5" />
                Initiate Clearance Now
              </button>
            </div>
          )}

          {/* Clearance Flow */}
          {request && (
            <div className="mb-12 bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-surface-variant animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-end mb-10">
                <div>
                  <h3 className="font-headline-md text-xl font-bold text-primary mb-1">Clearance Flow</h3>
                  <p className="font-body-md text-on-surface-variant text-sm">
                    Track your clearance journey across all departments.
                  </p>
                </div>
              </div>
              
              <div className="w-full pb-10 pt-2 flex justify-center">
                <div className="flex items-center w-full justify-between px-2">
                  {currentDepartments.map((deptName: string, index: number) => {
                    const dept = deps.find((d: any) => d.departmentName === deptName);
                    const isApproved = dept?.status === 'APPROVED';
                    const isSent = !!dept;
                    const isRejected = dept?.status === 'REJECTED';
                    
                    return (
                      <div key={deptName} className={`flex items-center ${index < currentDepartments.length - 1 ? 'flex-1' : ''}`}>
                        {/* Step Circle */}
                        <div className="flex flex-col items-center relative group">
                          <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center z-10 transition-all duration-300 border-[3px] shadow-sm group-hover:scale-110 shrink-0 ${
                            isApproved ? 'bg-green-500 border-green-100 text-white' : 
                            isRejected ? 'bg-red-500 border-red-100 text-white' :
                            isSent ? 'bg-amber-400 border-amber-100 text-white' :
                            'bg-surface border-surface-variant text-outline-variant'
                          }`}>
                            <div className="scale-75 lg:scale-90 flex items-center justify-center">
                              {getIcon(deptName)}
                            </div>
                          </div>
                          
                          {/* Status Badge */}
                          <div className="absolute -top-2 -right-2 z-20">
                            {isApproved ? (
                              <div className="bg-white rounded-full text-green-500 shadow-sm"><CheckCircle2 className="w-4 h-4" /></div>
                            ) : isRejected ? (
                              <div className="bg-white rounded-full text-red-500 shadow-sm"><AlertCircle className="w-4 h-4" /></div>
                            ) : isSent ? (
                              <div className="bg-white rounded-full text-amber-500 shadow-sm"><Clock className="w-4 h-4" /></div>
                            ) : null}
                          </div>
                          
                          <div className="absolute top-12 lg:top-14 w-16 lg:w-20 text-center">
                            <span className={`text-[8px] lg:text-[9px] font-bold uppercase tracking-wider leading-tight line-clamp-2 ${
                              isApproved ? 'text-green-700' : 
                              isRejected ? 'text-red-700' :
                              isSent ? 'text-amber-700' : 
                              'text-outline'
                            }`}>
                              {deptName}
                            </span>
                          </div>
                        </div>
                        
                        {/* Connecting Line */}
                        {index < currentDepartments.length - 1 && (
                          <div className={`flex-1 h-1 mx-1 lg:mx-2 rounded-full transition-colors duration-500 ${
                            isApproved ? 'bg-green-400' : 'bg-surface-variant'
                          }`}></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Grid Content */}
          {(request || isInitiating) && (
            <div className="animate-in fade-in duration-500">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h3 className="font-headline-md text-2xl font-bold text-primary">Department Status</h3>
                  {request && request.totalFeeDue > 0 && (
                    request.paymentReferenceId ? (
                      <button 
                        onClick={() => setShowFeeBreakdown(true)}
                        className="font-label-sm font-bold text-green-700 bg-green-100 hover:bg-green-200 transition-colors px-3 py-1 rounded-full border border-green-300 flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Fee Paid & Verified (Ref: {request.paymentReferenceId})
                        <span className="text-[10px] bg-green-700 text-green-100 px-1.5 rounded-full ml-1">View Details</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => setShowFeeBreakdown(true)}
                        className="font-label-sm font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors px-3 py-1 rounded-full border border-amber-300 flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        Total Dues: ₹{request.totalFeeDue}
                        <span className="text-[10px] bg-amber-700 text-amber-100 px-1.5 rounded-full ml-1">View Details</span>
                      </button>
                    )
                  )}
                </div>
                {request && (
                  <span className={`font-label-md font-medium ${
                    deps.length === currentDepartments.length && deps.every((d: any) => d.status === 'APPROVED')
                      ? 'text-green-600 font-bold'
                      : 'text-secondary'
                  }`}>
                    Overall Status: {
                      deps.length === currentDepartments.length && deps.every((d: any) => d.status === 'APPROVED') 
                        ? 'APPROVED' 
                        : request.status
                    }
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {currentDepartments.map((deptName, index) => {
                  const dept = deps.find((d: any) => d.departmentName === deptName);
                  return (
                    <div key={deptName} style={{ animationDelay: `${index * 100}ms` }} className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_-2px_rgba(10,25,47,0.05)] hover:-translate-y-1 hover:shadow-[0_8px_24px_-4px_rgba(10,25,47,0.08)] transition-all duration-300 border border-surface-variant flex flex-col h-full animate-in slide-in-from-bottom-8 fade-in fill-mode-both">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant">
                          {getIcon(deptName)}
                        </div>
                        
                        {dept ? (
                          dept.status === 'APPROVED' ? (
                            <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 font-label-sm text-xs font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                            </span>
                          ) : dept.status === 'REJECTED' ? (
                            <span className="px-3 py-1 rounded-full bg-error-container text-on-error-container font-label-sm text-xs font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Action Required
                            </span>
                          ) : dept.status === 'LOCKED' ? (
                            <span className="px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant font-label-sm text-xs font-semibold flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" /> Locked
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-label-sm text-xs font-semibold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> Pending
                            </span>
                          )
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant font-label-sm text-xs font-semibold flex items-center gap-1">
                            Not Sent
                          </span>
                        )}
                      </div>
                      
                      <h4 className="font-headline-sm text-base font-bold text-primary mb-1.5">{deptName}</h4>
                      <p className="font-body-sm text-[13px] leading-relaxed text-on-surface-variant mb-4 flex-1">
                        {dept?.remarks || (dept ? (dept.status === 'LOCKED' ? `Waiting for previous departments to approve.` : `Awaiting confirmation from ${deptName.toLowerCase()} manager.`) : `Ready to initiate clearance.`)}
                      </p>
                      
                      <div className="pt-3 border-t border-surface-variant flex items-center justify-between mt-auto">
                        {dept ? (
                          <>
                            <span className="font-label-sm text-xs text-outline font-medium">Ref: {dept.id.substring(0,6)}</span>
                            <button 
                              onClick={() => setSelectedDept(dept)}
                              className="px-4 py-2 border border-outline text-primary rounded-lg font-label-sm text-xs font-semibold hover:bg-surface-variant/50 transition-colors"
                            >
                              View Details
                            </button>
                          </>
                        ) : (
                          <span className="font-label-sm text-xs text-outline font-medium">Pending Initiation</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {deps.length === currentDepartments.length && deps.every((d: any) => d.status === 'APPROVED') ? (
                <div className="mt-8 flex justify-center animate-in fade-in zoom-in duration-500 delay-300 fill-mode-both">
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-6 md:p-8 w-full max-w-2xl text-center shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Award className="w-8 h-8" />
                    </div>
                    <h4 className="text-2xl font-bold text-green-900 mb-2">Clearance Completed!</h4>
                    <p className="text-green-700 mb-6 font-medium">Congratulations! You have successfully completed the clearance process for all departments.</p>
                    <button 
                      onClick={() => setShowCertificate(true)}
                      className="px-8 py-3 bg-green-600 text-white rounded-xl font-label-md text-sm font-bold shadow-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2 mx-auto"
                    >
                      <FileText className="w-5 h-5" />
                      View No Due Certificate
                    </button>
                  </div>
                </div>
              ) : currentDepartments.filter(d => !deps.find((rd: any) => rd.departmentName === d)).length > 0 && (
                <div className="mt-8 flex justify-end animate-in fade-in zoom-in duration-500 delay-300 fill-mode-both">
                  <button 
                    onClick={() => {
                      const unsent = currentDepartments.filter(d => !deps.find((rd: any) => rd.departmentName === d));
                      handleSendRequest(unsent);
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-label-md text-sm font-bold shadow hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    Initiate Clearance Flow
                  </button>
                </div>
              )}
            </div>
          )}
          </>
          )}

          {activeTab === 'clearance' && (
            <div className="flex flex-col h-full bg-surface-container-lowest rounded-3xl border border-surface-variant shadow-sm p-6 lg:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CheckSquare className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-headline-md text-2xl font-bold text-on-surface">Clearance Center</h2>
                  <p className="font-body-md text-on-surface-variant text-sm mt-1">Your approved department clearances</p>
                </div>
              </div>
              
              {deps.filter((d: any) => d.status === 'APPROVED').length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
                  <ShieldCheck className="w-16 h-16 text-outline-variant mb-4" />
                  <h3 className="font-headline-sm text-lg font-bold text-on-surface mb-2">No Clearances Yet</h3>
                  <p className="font-body-md text-on-surface-variant max-w-md">Once a department approves your clearance request, it will appear here along with any remarks from the department head.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {deps
                    .filter((d: any) => d.status === 'APPROVED')
                    .sort((a: any, b: any) => currentDepartments.indexOf(a.departmentName) - currentDepartments.indexOf(b.departmentName))
                    .map((dept: any) => (
                    <div key={dept.id} className="bg-surface border border-surface-variant rounded-2xl p-5 hover:border-primary/30 transition-colors shadow-sm flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600">
                            {getIcon(dept.departmentName)}
                          </div>
                          <div>
                            <h3 className="font-label-lg text-base font-bold text-on-surface">{dept.departmentName}</h3>
                            <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">Department Head</p>
                          </div>
                        </div>
                        <span className="px-3 py-1.5 bg-green-500/10 text-green-700 text-xs font-bold rounded-full flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
                        </span>
                      </div>
                      
                      <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-surface-variant/50 flex-1">
                        <p className="font-label-sm text-[11px] text-outline mb-1.5 uppercase tracking-wider">Official Remarks</p>
                        <p className="font-body-sm text-on-surface text-sm leading-relaxed">{dept.remarks || "No pending dues. Clearance granted successfully."}</p>
                      </div>
                      
                      <div className="mt-4 flex items-center justify-between text-xs font-label-sm text-outline px-1">
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Approved on</span>
                        <span className="font-medium text-on-surface-variant">
                          {dept.updatedAt ? new Date(dept.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recently'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="flex flex-col h-full bg-surface-container-lowest rounded-3xl border border-surface-variant shadow-sm p-6 lg:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-headline-md text-2xl font-bold text-on-surface">Student Profile</h2>
                  <p className="font-body-md text-on-surface-variant text-sm mt-1">Your personal information and academic details</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface rounded-2xl p-6 border border-surface-variant shadow-sm">
                  <div className="w-24 h-24 bg-primary text-on-primary rounded-full flex items-center justify-center text-4xl font-bold mb-8 mx-auto shadow-md">
                    {((data.name || data.email?.split('@')[0])
                        .replace(new RegExp(`^${data.studentId || data.id}\\s*`, 'i'), '')
                        .trim().charAt(0) || 'S').toUpperCase()}
                  </div>
                  <div className="space-y-5 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center sm:border-b sm:border-surface-variant sm:pb-3">
                      <p className="text-xs font-label-sm text-outline uppercase tracking-wider mb-1 sm:mb-0">Full Name</p>
                      <p className="font-headline-sm text-lg font-bold text-primary">
                        {(data.name || data.email?.split('@')[0])
                          .replace(new RegExp(`^${data.studentId || data.id}\\s*`, 'i'), '')
                          .trim()}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center sm:border-b sm:border-surface-variant sm:pb-3">
                      <p className="text-xs font-label-sm text-outline uppercase tracking-wider mb-1 sm:mb-0">Student ID</p>
                      <p className="font-body-md text-on-surface-variant font-medium">{data.studentId || data.id}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center sm:border-b sm:border-surface-variant sm:pb-3">
                      <p className="text-xs font-label-sm text-outline uppercase tracking-wider mb-1 sm:mb-0">Email Address</p>
                      <p className="font-body-md text-on-surface-variant font-medium">{data.email}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="bg-surface rounded-2xl p-6 border border-surface-variant shadow-sm">
                    <h3 className="font-headline-sm text-lg font-bold text-primary mb-4 border-b border-surface-variant pb-3">Academic Details</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-label-md text-outline">Program</span>
                        <span className="font-bold text-primary">{data?.clearanceRequest?.programType || 'Not Registered'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-label-md text-outline">Status</span>
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Active</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-label-md text-outline">Scholarship ID</span>
                        <span className="font-bold text-primary">{data.scholarshipId || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-primary-container text-on-primary-container rounded-2xl p-6 border border-primary-container/20 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-secondary/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                    <h3 className="font-headline-sm text-lg font-bold text-surface-container-lowest mb-2">Need to update your details?</h3>
                    <p className="font-body-sm text-sm opacity-80 mb-4">Contact the academic section with valid proof to update your registered profile information.</p>
                    <button className="bg-surface-container-lowest text-primary px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:scale-105 transition-transform duration-200">
                      Contact Admin
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </main>
      </div>

      {/* Department Details Modal */}
      {selectedDept && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-surface-variant animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant">
                  {getIcon(selectedDept.departmentName)}
                </div>
                <div>
                  <h3 className="font-headline-md text-xl font-bold text-primary">{selectedDept.departmentName}</h3>
                  <span className="font-label-sm text-xs text-outline font-medium">Ref: {selectedDept.id.substring(0,6)}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDept(null)}
                className="text-on-surface-variant hover:text-primary transition-colors p-1"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center py-3 border-b border-surface-variant">
                <span className="text-on-surface-variant font-label-md">Status</span>
                {selectedDept.status === 'APPROVED' && (
                  <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 font-label-sm text-sm font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Approved
                  </span>
                )}
                {selectedDept.status === 'REJECTED' && (
                  <span className="px-3 py-1 rounded-full bg-error-container text-on-error-container font-label-sm text-sm font-semibold flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Rejected
                  </span>
                )}
                {selectedDept.status === 'PENDING' && (
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-label-sm text-sm font-semibold flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Pending
                  </span>
                )}
              </div>
              
              <div className="py-3">
                <span className="block text-on-surface-variant font-label-md mb-2">Remarks / Notes</span>
                <p className="font-body-md text-primary bg-surface-variant/20 p-4 rounded-xl border border-surface-variant/50">
                  {selectedDept.remarks || "No remarks provided by the department yet."}
                </p>
              </div>
            </div>

            {selectedDept.status === 'PENDING' ? (
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmCancelDept(selectedDept.departmentName)} 
                  className="flex-1 bg-red-50 text-red-600 border border-red-200 py-3 rounded-xl font-label-md font-semibold hover:bg-red-100 transition-colors shadow-sm"
                >
                  Cancel Request
                </button>
                <button 
                  onClick={() => setSelectedDept(null)} 
                  className="flex-1 bg-primary-container text-on-primary py-3 rounded-xl font-label-md font-semibold hover:scale-[1.02] transition-transform duration-300 shadow-md"
                >
                  Close
                </button>
              </div>
            ) : selectedDept.status === 'REJECTED' ? (
              <div className="flex gap-4">
                <button 
                  onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      const { updateDoc } = await import('firebase/firestore');
                      const dcRef = doc(db, 'departmentClearances', selectedDept.id);
                      await updateDoc(dcRef, { status: 'PENDING' });
                      await fetchDashboardData();
                      setSelectedDept(null);
                    } catch (err) {
                      console.error(err);
                      alert('Failed to request again');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-label-md font-semibold hover:bg-blue-700 transition-colors shadow-md"
                >
                  Request Again
                </button>
                <button 
                  onClick={() => setSelectedDept(null)} 
                  className="flex-1 bg-surface-variant text-on-surface-variant py-3 rounded-xl font-label-md font-semibold hover:bg-outline-variant/30 transition-colors shadow-sm"
                >
                  Close
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setSelectedDept(null)} 
                className="w-full bg-primary-container text-on-primary py-3 rounded-xl font-label-md font-semibold hover:scale-[1.02] transition-transform duration-300 shadow-md"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* No Due Certificate Modal */}
      {showCertificate && data && (
        <NoDueCertificate 
          student={{
            name: data.name,
            studentId: data.studentId,
            program: data.program
          }}
          onClose={() => setShowCertificate(false)}
        />
      )}

      {/* Confirmation Modal */}
      {confirmCancelDept && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-surface-variant animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="font-headline-md text-xl font-bold text-primary mb-2">Cancel Request</h3>
            <p className="font-body-md text-on-surface-variant mb-8">
              Are you sure you want to cancel the request for <span className="font-bold">{confirmCancelDept}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmCancelDept(null)} 
                className="flex-1 bg-surface-variant text-on-surface-variant py-3 rounded-xl font-label-md font-semibold hover:bg-outline-variant/30 transition-colors"
              >
                Go Back
              </button>
              <button 
                onClick={confirmCancelClearance} 
                className="flex-1 bg-red-500 text-white py-3 rounded-xl font-label-md font-semibold hover:bg-red-600 transition-colors shadow-md"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Program Selection Modal */}
      {showProgramModal && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-[300]">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-surface-variant animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-headline-md text-xl font-bold text-primary text-center mb-2">Select Your Program</h3>
            <p className="font-body-md text-on-surface-variant text-center mb-6">
              Please confirm your academic program to generate the correct clearance flow.
            </p>
            <div className="space-y-4 mb-6">
              <label className="flex items-center gap-3 p-4 border border-outline-variant rounded-xl cursor-pointer hover:bg-surface-variant/20 transition-colors">
                <input type="radio" name="program" value="PUC" checked={selectedProgram === 'PUC'} onChange={() => setSelectedProgram('PUC')} className="w-5 h-5 text-blue-600 focus:ring-blue-500" />
                <span className="font-label-md font-bold text-primary">PUC (Pre-University Course)</span>
              </label>
              <label className="flex items-center gap-3 p-4 border border-outline-variant rounded-xl cursor-pointer hover:bg-surface-variant/20 transition-colors">
                <input type="radio" name="program" value="B.Tech" checked={selectedProgram === 'B.Tech'} onChange={() => setSelectedProgram('B.Tech')} className="w-5 h-5 text-blue-600 focus:ring-blue-500" />
                <span className="font-label-md font-bold text-primary">B.Tech (Engineering)</span>
              </label>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowProgramModal(false)} className="flex-1 bg-surface-variant text-on-surface-variant py-3 rounded-xl font-label-md font-semibold hover:bg-outline-variant/30 transition-colors">Cancel</button>
              <button 
                onClick={async () => { 
                  setShowProgramModal(false); 
                  try {
                    const user = JSON.parse(localStorage.getItem('user') || '{}');
                    const crRef = doc(collection(db, 'clearanceRequests'));
                    await setDoc(crRef, {
                      studentId: user.id,
                      programType: selectedProgram,
                      status: 'PENDING',
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    });
                    await fetchDashboardData();
                  } catch(e) {
                    console.error(e);
                  }
                }} 
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-label-md font-semibold hover:bg-blue-700 transition-colors shadow-md"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submitting Overlay */}
      {(isSubmitting || submitSuccess) && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-[300]">
          <div className="bg-surface-container-lowest rounded-3xl p-10 flex flex-col items-center justify-center shadow-2xl animate-in fade-in zoom-in duration-300">
            {isSubmitting ? (
              <>
                <div className="w-20 h-20 mb-6 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <h3 className="font-headline-md text-2xl font-bold text-primary">Submitting Requests...</h3>
                <p className="text-on-surface-variant mt-2">Please wait while we notify the departments.</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mb-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="font-headline-md text-2xl font-bold text-green-600">Requests Sent!</h3>
                <p className="text-on-surface-variant mt-2">Redirecting to status page...</p>
              </>
            )}
          </div>
        </div>
      )}
      {/* Scholarship Modal */}
      {showScholarshipModal && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-surface-variant animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-headline-md text-xl font-bold text-primary text-center mb-2">Scholarship Details</h3>
            <p className="font-body-md text-on-surface-variant text-center mb-6">
              The Scholarship Office requires your unique Scholarship ID to process your clearance.
            </p>
            <form onSubmit={handleScholarshipSubmit}>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-primary mb-2">Scholarship ID <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required
                  autoFocus
                  minLength={12}
                  maxLength={12}
                  placeholder="e.g. SCH202412345"
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  value={scholarshipId}
                  onChange={(e) => setScholarshipId(e.target.value)}
                />
                <p className="text-xs text-on-surface-variant mt-2">Must be exactly 12 characters.</p>
              </div>
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowScholarshipModal(false)} 
                  className="flex-1 bg-surface-variant text-on-surface-variant py-3 rounded-xl font-label-md font-semibold hover:bg-outline-variant/30 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={scholarshipId.length !== 12}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-label-md font-semibold hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50"
                >
                  Save & Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Fee Breakdown Modal */}
      {showFeeBreakdown && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-md w-full shadow-2xl border border-surface-variant animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className={`font-headline-md text-2xl font-bold mb-1 ${data?.clearanceRequest?.paymentReferenceId ? 'text-green-700' : 'text-primary'}`}>
                  {data?.clearanceRequest?.paymentReferenceId ? 'Fee Payment Receipt' : 'Fee Dues Breakdown'}
                </h3>
                <p className="font-body-sm text-on-surface-variant">
                  {data?.clearanceRequest?.paymentReferenceId ? 'Official record of your paid department dues' : 'Departments that have issued pending dues'}
                </p>
              </div>
              {data?.clearanceRequest?.paymentReferenceId ? (
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="text-green-600 w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <span className="text-amber-700 font-bold text-lg">₹</span>
                </div>
              )}
            </div>
            
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
              {data?.clearanceRequest?.departmentClearances
                ?.filter((d: any) => d.feeDue > 0)
                .map((d: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-surface-variant/30 rounded-xl border border-surface-variant/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-primary shadow-sm border border-outline-variant/30">
                      {getIcon(d.departmentName)}
                    </div>
                    <span className="font-bold text-slate-700">{d.departmentName}</span>
                  </div>
                  <span className="font-bold text-amber-700">₹{d.feeDue}</span>
                </div>
              ))}
              
              {(!data?.clearanceRequest?.departmentClearances || data.clearanceRequest.departmentClearances.filter((d: any) => d.feeDue > 0).length === 0) && (
                <p className="text-center text-slate-500 py-4 text-sm font-medium">No active fee dues found.</p>
              )}
            </div>

            <div className={`flex justify-between items-center p-4 rounded-xl border mb-6 ${data?.clearanceRequest?.paymentReferenceId ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <div>
                <span className={`block font-bold ${data?.clearanceRequest?.paymentReferenceId ? 'text-green-900' : 'text-amber-900'}`}>Total Due:</span>
                {data?.clearanceRequest?.paymentReferenceId && (
                  <span className="text-xs font-semibold text-green-700 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Paid (Ref: {data.clearanceRequest.paymentReferenceId})
                  </span>
                )}
              </div>
              <span className={`text-xl font-bold ${data?.clearanceRequest?.paymentReferenceId ? 'text-green-700' : 'text-amber-700'}`}>₹{data?.clearanceRequest?.totalFeeDue || 0}</span>
            </div>

            {data?.clearanceRequest?.paymentReferenceId ? (
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowFeeBreakdown(false)} 
                  className="flex-1 bg-surface-variant text-on-surface-variant py-3 rounded-xl font-label-md font-semibold hover:bg-outline-variant/30 transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={() => {
                    setShowFeeBreakdown(false);
                    setShowFeeReceipt(true);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-label-md font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  Download Receipt
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowFeeBreakdown(false)} 
                className="w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-xl font-label-md font-semibold transition-colors shadow-sm"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fee Receipt Component */}
      {showFeeReceipt && data?.clearanceRequest && (
        <FeeReceipt
          student={{
            name: data.name || data.email?.split('@')[0],
            studentId: data.id,
            program: data.clearanceRequest.programType || 'PUC'
          }}
          clearances={data.clearanceRequest.departmentClearances || []}
          totalFeeDue={data.clearanceRequest.totalFeeDue || 0}
          paymentReferenceId={data.clearanceRequest.paymentReferenceId}
          onClose={() => setShowFeeReceipt(false)}
        />
      )}

    </div>
  );
}
