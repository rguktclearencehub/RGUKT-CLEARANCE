import { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc, limit, increment } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, LogOut, Search, Bell, CheckCircle2, AlertCircle, Clock, ShieldCheck, CheckSquare, Printer, Building2 } from 'lucide-react';
import emailjs from '@emailjs/browser';
import NoDueCertificate from '../components/NoDueCertificate';
import HostelPenaltyManager from '../components/HostelPenaltyManager';

// EmailJS credentials for sending fee due notifications
const EMAILJS_SERVICE_ID = 'service_yato66e';
const EMAILJS_TEMPLATE_ID = 'template_zdq3aos';
const EMAILJS_PUBLIC_KEY = 'uX0TI21Zg8bha0FM0';

export default function DepartmentDashboard() {
  const [clearances, setClearances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClearance, setSelectedClearance] = useState<any>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [fetchedFee, setFetchedFee] = useState<number | null>(null);
  const [fetchedPenalties, setFetchedPenalties] = useState<any[] | null>(null);
  const [isFetchingFee, setIsFetchingFee] = useState(false);
  const [isDuesAdded, setIsDuesAdded] = useState(false);
  const [isAddingDues, setIsAddingDues] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [forwardingAnim, setForwardingAnim] = useState<{ isAnimating: boolean; nextDept: string | null; progress: boolean; completed: boolean }>({ isAnimating: false, nextDept: null, progress: false, completed: false });
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [departmentName, setDepartmentName] = useState('Department');
  const [currentTab, setCurrentTab] = useState<'requests' | 'hostelPenalty'>('requests');
  const navigate = useNavigate();
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatName = (name: string, id: string) => {
    if (!name) return 'Unknown';
    return name.replace(new RegExp(`^${id}\\s*`, 'i'), '').trim();
  };

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

  // Keep a combined list just for getExactDeptName
  const DEPARTMENTS = [...new Set([...PUC_DEPARTMENTS, ...BTECH_DEPARTMENTS])];

  const getExactDeptName = (rawName: string) => {
    const normalized = rawName.replace(/\s+/g, '').toLowerCase();
    if (normalized === 'accounts' || normalized === 'fo') return 'FO';
    return DEPARTMENTS.find(d => d.replace(/\s+/g, '').toLowerCase() === normalized) || rawName;
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login');
      return;
    }
    const user = JSON.parse(userStr);
    const exactName = getExactDeptName(user.name);
    setDepartmentName(exactName);

    fetchClearances(exactName);

    // Setup Real-time Listener for incoming applications
    const mountTime = Date.now();
    const qListener = query(
      collection(db, 'departmentClearances'),
      where('departmentName', '==', exactName)
    );

    import('firebase/firestore').then(({ onSnapshot }) => {
      const unsubscribe = onSnapshot(qListener, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            
            // Only trigger if it was updated AFTER we opened the page
            const updatedTime = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
            const isNewlyUpdated = updatedTime > mountTime;

            if (data.status === 'PENDING' && isNewlyUpdated) {
              setClearances(prev => {
                const existing = prev.find(c => c.id === change.doc.id);
                // If we already have it in state as PENDING, don't show popup again
                if (existing && existing.status === 'PENDING') {
                  return prev;
                }
                
                // Fetch related data asynchronously
                const fetchAndShow = async () => {
                  const crRef = doc(db, 'clearanceRequests', data.requestId);
                  const crSnap = await getDoc(crRef);
                  if (crSnap.exists()) {
                    const studentId = crSnap.data().studentId;
                    const studentRef = doc(db, 'students', studentId);
                    const studentSnap = await getDoc(studentRef);
                    
                    let studentDetails: any = { studentId: 'Unknown' };
                    if (studentSnap.exists()) studentDetails = studentSnap.data();
                    
                    const userRef = doc(db, 'users', studentId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                      studentDetails.name = userSnap.data().name;
                      studentDetails.email = userSnap.data().email;
                    }
                    
                    const newClearance = {
                      id: change.doc.id,
                      ...data,
                      student: studentDetails,
                      totalFeeDue: crSnap.data().totalFeeDue || 0
                    };
                    
                    // Add to list and show notification dot
                    setClearances(curr => {
                      if (curr.find(c => c.id === change.doc.id)) {
                         // Update existing with new data
                         return curr.map(c => c.id === change.doc.id ? newClearance : c);
                      }
                      return [newClearance, ...curr];
                    });
                    
                    setIncomingRequests(curr => {
                      if (curr.find(c => c.id === change.doc.id)) return curr;
                      return [newClearance, ...curr];
                    });
                  }
                };
                
                fetchAndShow();
                return prev;
              });
            }
          }
        });
      });
      return unsubscribe;
    });

  }, [navigate]);

  async function fetchClearances(deptName: string) {
    setLoading(true);
    try {
      const q = query(collection(db, 'departmentClearances'), where('departmentName', '==', deptName));
      const snap = await getDocs(q);
      
      const requests = [];
      for (const d of snap.docs) {
        const data = d.data();
        
        const crRef = doc(db, 'clearanceRequests', data.requestId);
        const crSnap = await getDoc(crRef);
        if (crSnap.exists()) {
          const studentId = crSnap.data().studentId;
          const studentRef = doc(db, 'students', studentId);
          const studentSnap = await getDoc(studentRef);
          
          let studentDetails: any = { studentId: 'Unknown' };
          if (studentSnap.exists()) studentDetails = studentSnap.data();
          
          const userRef = doc(db, 'users', studentId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            studentDetails.name = userSnap.data().name;
            studentDetails.email = userSnap.data().email;
          }
          
          requests.push({
            id: d.id,
            ...data,
            student: studentDetails,
            totalFeeDue: crSnap.data().totalFeeDue || 0
          });
        }
      }
      
      const visibleRequests = requests.filter((r: any) => r.status !== 'LOCKED');
      setClearances(visibleRequests);
    } catch (err) {
      console.error(err);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedClearance || !actionType) return;

    if (actionType === 'APPROVE' && departmentName === 'FO' && selectedClearance.totalFeeDue > 0 && !referenceId.trim()) {
      alert("Please enter the Payment Reference ID to approve this request.");
      return;
    }

    setIsConfirming(true);
    try {
      const dcRef = doc(db, 'departmentClearances', selectedClearance.id);
      const newStatus = actionType === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const feeNum = parseFloat(feeAmount) || 0;
      
      const dcUpdateData: any = {
        status: newStatus,
        remarks: remarks || '',
        updatedAt: new Date().toISOString()
      };
      if (feeNum > 0) dcUpdateData.feeDue = feeNum;
      if (departmentName === 'FO' && referenceId.trim()) dcUpdateData.referenceId = referenceId;
      
      await updateDoc(dcRef, dcUpdateData);
      
      const crRef = doc(db, 'clearanceRequests', selectedClearance.requestId);
      const programType = selectedClearance.student?.program || 'PUC';
      const currentSequence = programType === 'B.Tech' ? BTECH_DEPARTMENTS : PUC_DEPARTMENTS;
      const currentIndex = currentSequence.indexOf(departmentName);
      const isLast = currentIndex === currentSequence.length - 1;

      const crUpdateData: any = { updatedAt: new Date().toISOString() };
      
      if (newStatus === 'REJECTED') {
        crUpdateData.status = 'REJECTED';
      } else if (newStatus === 'APPROVED' && isLast) {
        crUpdateData.status = 'APPROVED';
      }

      if (feeNum > 0 && newStatus === 'APPROVED') {
        crUpdateData.totalFeeDue = increment(feeNum);
      }

      if (departmentName === 'FO' && referenceId.trim() && newStatus === 'APPROVED') {
        crUpdateData.paymentReferenceId = referenceId;
      }
      
      await updateDoc(crRef, crUpdateData);
      
      setIsConfirming(false);
      setIsConfirmed(true);
      
      setTimeout(() => {
        setSelectedClearance((prev: any) => prev ? { ...prev, status: newStatus } : null);
        setActionType(null);
        setRemarks('');
        setFeeAmount('');
        setReferenceId('');
        setFetchedFee(null);
        setIsConfirmed(false);
        fetchClearances(departmentName);
      }, 1000);
      
    } catch (e) {
      console.error(e);
      setIsConfirming(false);
      alert('Action failed. Please try again.');
    }
  };

  const handleFetchMaintenanceFee = async () => {
    if (!selectedClearance?.student?.studentId) return;
    setIsFetchingFee(true);
    setFetchedFee(null);
    setFetchedPenalties(null);
    setIsDuesAdded(false);
    setIsAddingDues(false);
    setShowToast(false);
    try {
      if (departmentName === 'Hostel') {
        const q = query(collection(db, 'hostelPenalties'), where('studentId', '==', selectedClearance.student.studentId));
        const snap = await getDocs(q);
        const penalties = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const total = penalties.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        setFetchedPenalties(penalties);
        setFetchedFee(total);
      } else {
        const feeDocRef = doc(db, 'maintenanceFees', selectedClearance.student.studentId);
        const feeSnap = await getDoc(feeDocRef);
        if (feeSnap.exists()) {
          const data = feeSnap.data();
          setFetchedFee(data.pendingFee || 0);
        } else {
          setFetchedFee(0);
        }
      }
    } catch (err) {
      console.error('Error fetching maintenance fee:', err);
      alert('Failed to fetch dues.');
    } finally {
      setIsFetchingFee(false);
    }
  };

  const handleForward = async () => {
    if (!selectedClearance) return;
    
    // Determine next department
    let nextDeptName: string | null = null;
    try {
      // Get the master request to determine program and get FRESH fee due
      const crRef = doc(db, 'clearanceRequests', selectedClearance.requestId);
      const crSnap = await getDoc(crRef);
      const programType = crSnap.exists() ? crSnap.data().programType : 'PUC';
      const latestTotalFeeDue = crSnap.exists() ? (crSnap.data().totalFeeDue || 0) : 0;
      
      const currentSequence = programType === 'B.Tech' ? BTECH_DEPARTMENTS : PUC_DEPARTMENTS;
      const currentIndex = currentSequence.indexOf(departmentName);
      nextDeptName = currentIndex >= 0 && currentIndex < currentSequence.length - 1 ? currentSequence[currentIndex + 1] : null;
      
      if (!nextDeptName) return;
      
      // If we are forwarding to FO and there are dues, send an email to the student
      if (nextDeptName === 'FO' && latestTotalFeeDue > 0 && selectedClearance.student?.email) {
        try {
          await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            {
              to_name: selectedClearance.student.name,
              to_email: selectedClearance.student.email,
              fee_amount: latestTotalFeeDue,
              department: departmentName
            },
            EMAILJS_PUBLIC_KEY
          );
          console.log('Fee due notification email sent to student!');
        } catch (emailErr) {
          console.error('Failed to send EmailJS notification:', emailErr);
          // We don't block the forwarding process if the email fails
        }
      }
      
      // Start animation
      setForwardingAnim({ isAnimating: true, nextDept: nextDeptName, progress: false, completed: false });
      
      // Trigger the slide after a tiny delay
      setTimeout(() => {
        setForwardingAnim(prev => ({ ...prev, progress: true }));
      }, 100);
      
      // Show success text when file arrives
      setTimeout(() => {
        setForwardingAnim(prev => ({ ...prev, completed: true }));
      }, 1500);

      const nextQ = query(
        collection(db, 'departmentClearances'), 
        where('requestId', '==', selectedClearance.requestId), 
        where('departmentName', '==', nextDeptName),
        limit(1)
      );
      const nextSnap = await getDocs(nextQ);
      if (!nextSnap.empty) {
        await updateDoc(nextSnap.docs[0].ref, {
          status: 'PENDING',
          updatedAt: new Date().toISOString()
        });
      } else {
        const newDcRef = doc(collection(db, 'departmentClearances'));
        await setDoc(newDcRef, {
          requestId: selectedClearance.requestId,
          departmentName: nextDeptName,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      await updateDoc(doc(db, 'departmentClearances', selectedClearance.id), {
        forwarded: true,
        updatedAt: new Date().toISOString()
      });
      
      // Wait for animation to finish before updating UI and closing
      setTimeout(() => {
        setSelectedClearance((prev: any) => ({ ...prev, forwarded: true }));
        fetchClearances(departmentName);
        setForwardingAnim({ isAnimating: false, nextDept: null, progress: false, completed: false });
      }, 5000);

    } catch (e) {
      console.error(e);
      setForwardingAnim({ isAnimating: false, nextDept: null, progress: false, completed: false });
      alert('Failed to forward the request.');
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    navigate('/login');
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
          <p className="font-label-sm text-on-primary-container mt-1">Department Portal</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => setCurrentTab('requests')}
            className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${currentTab === 'requests' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-l-none rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Requests
          </button>
          
          {departmentName === 'Hostel' && (
            <button 
              onClick={() => setCurrentTab('hostelPenalty')}
              className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${currentTab === 'hostelPenalty' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-l-none rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
            >
              <AlertCircle className="w-5 h-5" />
              Hostel Penalty
            </button>
          )}

          <button className="w-full flex items-center gap-3 px-4 py-3 text-on-primary-container/70 font-label-md hover:bg-surface-variant/20 hover:text-surface-container-lowest transition-all duration-300 rounded-lg">
            <Users className="w-5 h-5" />
            Students
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-on-primary-container/70 font-label-md hover:bg-surface-variant/20 hover:text-surface-container-lowest transition-all duration-300 rounded-lg">
            <FileText className="w-5 h-5" />
            Reports
          </button>
        </nav>
        
        <div className="mt-8 px-4 space-y-2 border-t border-outline-variant/10 pt-4">

          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2 text-on-primary-container/70 font-label-md hover:bg-surface-variant/20 hover:text-red-400 transition-all duration-300 rounded-lg">
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        
        {/* TopNavBar Component */}
        <header className="bg-surface/80 top-0 sticky backdrop-blur-md border-b border-outline-variant/20 shadow-sm flex justify-between items-center h-16 px-8 z-40">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
              <input className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant/50 rounded-lg text-sm focus:outline-none focus:border-secondary-container focus:ring-1 focus:ring-secondary-container transition-colors" placeholder="Search student IDs, names..." type="text" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-on-surface-variant hover:text-secondary p-2 rounded-full hover:bg-surface-variant/50 relative"
              >
                <Bell className="w-5 h-5" />
                {incomingRequests.length > 0 && (
                  <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface-container-lowest animate-pulse"></span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-outline-variant/30 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-3 bg-surface-container/50 border-b border-outline-variant/30 flex justify-between items-center">
                    <span className="font-bold text-sm text-primary">Notifications</span>
                    {incomingRequests.length > 0 && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{incomingRequests.length} New</span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {incomingRequests.length === 0 ? (
                      <div className="p-6 text-sm text-on-surface-variant text-center flex flex-col items-center gap-2">
                        <Bell className="w-8 h-8 text-outline-variant/50" />
                        <span>No new notifications</span>
                      </div>
                    ) : (
                      incomingRequests.map((req, idx) => (
                        <div key={idx} className="p-3 border-b border-outline-variant/10 hover:bg-surface-variant/30 cursor-pointer flex flex-col gap-1 transition-colors" onClick={() => {
                          setSelectedClearance(req);
                          setIncomingRequests(curr => curr.filter(c => c.id !== req.id));
                          setShowNotifications(false);
                        }}>
                          <span className="text-sm font-semibold text-primary">{req.student?.name}</span>
                          <span className="text-xs text-on-surface-variant">Application forwarded to your department.</span>
                          <span className="text-[10px] text-blue-600 font-medium mt-1">Click to view &rarr;</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3 ml-2 pl-4 border-l border-outline-variant/30">
              <span className="font-label-md font-bold text-primary">{departmentName}</span>
              <div className="w-9 h-9 rounded-full bg-secondary overflow-hidden border border-outline-variant/30 flex items-center justify-center text-white font-bold">
                {departmentName.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 max-w-[1440px] mx-auto w-full">
          {currentTab === 'hostelPenalty' ? (
            <HostelPenaltyManager />
          ) : (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="font-headline-lg text-3xl font-bold text-primary">Clearance Requests</h2>
                  <p className="font-body-md text-on-surface-variant mt-1">Manage and process student clearance requests for your department.</p>
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_-2px_rgba(10,25,47,0.05)] border border-surface-variant overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-container/50 border-b border-surface-variant">
                    <tr>
                      <th className="px-6 py-4 font-headline-sm font-semibold text-on-surface-variant">Student ID</th>
                      <th className="px-6 py-4 font-headline-sm font-semibold text-on-surface-variant">Name</th>
                      <th className="px-6 py-4 font-headline-sm font-semibold text-on-surface-variant">Program</th>
                      <th className="px-6 py-4 font-headline-sm font-semibold text-on-surface-variant">Status</th>
                      <th className="px-6 py-4 font-headline-sm font-semibold text-on-surface-variant text-right">Action</th>
                    </tr>
                  </thead>
              <tbody className="divide-y divide-surface-variant">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-on-surface-variant font-medium animate-pulse">Loading clearance requests...</p>
                      </div>
                    </td>
                  </tr>
                ) : clearances.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant">
                      No clearance requests found for your department.
                    </td>
                  </tr>
                ) : clearances.map(c => (
                  <tr key={c.id} className="hover:bg-surface-variant/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-primary">{c.student?.studentId || 'N/A'}</td>
                    <td className="px-6 py-4 font-medium">{formatName(c.student?.name, c.student?.studentId)}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{c.student?.program}</td>
                    <td className="px-6 py-4">
                      {c.status === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-800 font-label-sm text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                        </span>
                      )}
                      {c.status === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-error-container text-on-error-container font-label-sm text-xs font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" /> Rejected
                        </span>
                      )}
                      {c.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-label-sm text-xs font-semibold">
                          <Clock className="w-3.5 h-3.5" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedClearance(c)}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-outline text-primary rounded-lg font-label-sm text-xs font-semibold hover:bg-surface-variant/50 transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
          )}
        </main>
      </div>

      {/* Review Modal */}
      {selectedClearance && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-7xl w-[90vw] max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col shadow-2xl border border-surface-variant animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-headline-md text-2xl font-bold text-primary mb-1">Review Clearance</h3>
                <p className="font-body-sm text-on-surface-variant">Process request for {formatName(selectedClearance.student?.name, selectedClearance.student?.studentId)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center">
                <CheckSquare className="w-6 h-6 text-primary" />
              </div>
            </div>
            
            <div className="bg-surface p-5 rounded-xl border border-surface-variant mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                  <Users className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-headline-sm text-xl font-bold text-on-surface">{formatName(selectedClearance.student?.name, selectedClearance.student?.studentId)}</h4>
                  <p className="font-body-md text-on-surface-variant mt-0.5">{selectedClearance.student?.studentId} • {selectedClearance.student?.program}</p>
                </div>
              </div>
              <div className="sm:text-right">
                <span className="text-sm font-semibold text-primary bg-primary-container/30 px-4 py-2 rounded-full border border-primary/20 shadow-sm inline-block">
                  Req ID: {selectedClearance.id?.substring(0,8)}
                </span>
              </div>
            </div>

            <div className="bg-surface-variant/30 rounded-xl p-4 mb-6 space-y-3">
              {departmentName === 'Scholarship Office' && selectedClearance.student?.scholarshipId && (
                <div className="flex justify-between pb-3 border-b border-surface-variant/50">
                  <span className="text-on-surface-variant font-label-md">Scholarship ID:</span>
                  <span className="font-bold text-primary">{selectedClearance.student.scholarshipId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-label-md">Current Status:</span>
                <span className="font-bold text-primary">{selectedClearance.status}</span>
              </div>
            </div>

            {selectedClearance.status === 'PENDING' && (
              <div className="space-y-6">
                {['Hostel', 'Physics Lab', 'Chemistry Lab', 'Biology Lab', 'Library', 'IT Infra', 'Scholarship Office', 'Sports', 'FO'].includes(departmentName) && (
                  <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h5 className="font-headline-sm text-lg font-bold text-on-surface mb-1">Outstanding Dues Check</h5>
                        <p className="text-sm text-on-surface-variant">Search the database to see if this student has any pending maintenance fees.</p>
                      </div>
                      <button
                        onClick={handleFetchMaintenanceFee}
                        disabled={isFetchingFee}
                        className="bg-primary text-on-primary hover:bg-primary-fixed hover:text-on-primary-fixed px-5 py-2.5 rounded-xl font-label-md font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                      >
                        {isFetchingFee ? 'Checking...' : 'Check Dues'}
                      </button>
                    </div>
                    
                    {fetchedFee !== null && (
                      <div className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500 transition-colors ${fetchedFee > 0 ? (isDuesAdded ? 'bg-green-50/50 border-green-200' : 'bg-error-container/30 border-error-container/50') : 'bg-surface-variant/30 border-outline-variant/30'}`}>
                        <div className="flex-1">
                          <span className={`text-xs font-bold uppercase tracking-wider mb-2 block transition-colors ${fetchedFee > 0 ? (isDuesAdded ? 'text-green-700' : 'text-error') : 'text-primary'}`}>
                            {isDuesAdded ? 'Dues Added' : 'Search Result'}
                          </span>
                          
                          {departmentName === 'Hostel' && fetchedPenalties && fetchedPenalties.length > 0 ? (
                            <div className="space-y-2 mb-3">
                              {fetchedPenalties.map((p, idx) => (
                                <div key={p.id || idx} className={`flex justify-between items-center text-sm px-3 py-2 rounded-lg border shadow-sm transition-colors ${isDuesAdded ? 'bg-green-100/50 border-green-200/50' : 'bg-surface-container-lowest/80 border-outline-variant/20'}`}>
                                  <span className={isDuesAdded ? 'text-green-900 font-medium' : 'text-on-surface font-medium'}>{p.reason}</span>
                                  <span className={`font-bold transition-colors ${isDuesAdded ? 'text-green-700' : 'text-error'}`}>₹{p.amount}</span>
                                </div>
                              ))}
                              <div className={`flex justify-between items-center px-4 py-3 border mt-2 rounded-xl shadow-sm transition-colors ${isDuesAdded ? 'border-green-300 bg-green-200/50' : 'border-error-container bg-error-container/50'}`}>
                                <span className={`font-bold ${isDuesAdded ? 'text-green-900' : 'text-on-error-container'}`}>Total Dues:</span>
                                <div className="flex items-center gap-4">
                                  <span className={`font-bold text-lg transition-colors ${isDuesAdded ? 'text-green-700' : 'text-error'}`}>₹{fetchedFee}</span>
                                  <button
                                    disabled={isDuesAdded || isAddingDues}
                                    onClick={() => {
                                      setIsAddingDues(true);
                                      setTimeout(() => {
                                        setIsAddingDues(false);
                                        setIsDuesAdded(true);
                                        setShowToast(true);
                                        setFeeAmount(fetchedFee.toString());
                                        setActionType('APPROVE');
                                        setTimeout(() => setShowToast(false), 3000);
                                      }, 800);
                                    }}
                                    className={`px-4 py-2 rounded-lg font-label-sm font-bold transition-all duration-500 shadow-sm flex items-center gap-2 ${isDuesAdded ? 'bg-green-600 text-white' : isAddingDues ? 'bg-error/70 text-on-error cursor-wait' : 'bg-error hover:bg-red-700 text-on-error'}`}
                                  >
                                    {isDuesAdded ? <><CheckCircle2 className="w-4 h-4 animate-in zoom-in" /> Added</> : isAddingDues ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Adding...</> : 'Add All'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className={`font-headline-sm text-xl font-bold transition-colors ${fetchedFee > 0 ? (isDuesAdded ? 'text-green-800' : 'text-on-error-container') : 'text-primary'}`}>
                              {fetchedFee > 0 ? `₹${fetchedFee} Pending Dues` : 'No Pending Dues Found'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {!actionType && (
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setActionType('APPROVE')} 
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-label-md font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Approve
                    </button>
                    <button 
                      onClick={() => setActionType('REJECT')} 
                      className="flex-1 bg-error hover:bg-error-container hover:text-on-error-container text-white py-3 rounded-xl font-label-md font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <AlertCircle className="w-5 h-5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedClearance.status === 'APPROVED' && (
              <div className="mt-2">
                {(() => {
                  const currentSequence = selectedClearance.student?.program === 'B.Tech' ? BTECH_DEPARTMENTS : PUC_DEPARTMENTS;
                  const currentIndex = currentSequence.indexOf(departmentName);
                  const nextDeptName = currentIndex >= 0 && currentIndex < currentSequence.length - 1 ? currentSequence[currentIndex + 1] : null;
                  if (nextDeptName) {
                    if (selectedClearance.forwarded) {
                      return (
                        <div className="w-full bg-blue-50 text-blue-700 py-3 rounded-xl font-label-md font-semibold flex items-center justify-center gap-2 border border-blue-200">
                          <CheckCircle2 className="w-5 h-5" /> Moved to {nextDeptName}
                        </div>
                      );
                    }
                    return (
                      <button 
                        onClick={handleForward}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-label-md font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
                      >
                        Move to next department ({nextDeptName})
                      </button>
                    );
                  }
                  
                  if (departmentName === 'Dean of Academics') {
                    return (
                      <button 
                        onClick={() => setShowCertificate(true)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-label-md font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
                      >
                        <Printer className="w-5 h-5" /> View / Print Certificate
                      </button>
                    );
                  }
                  
                  return (
                    <div className="w-full bg-green-50 text-green-700 py-3 rounded-xl font-label-md font-semibold flex items-center justify-center gap-2 border border-green-200">
                      <CheckCircle2 className="w-5 h-5" /> Final Approval Completed
                    </div>
                  );
                })()}
              </div>
            )}

            {actionType && (
              <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-200 bg-surface/50 p-6 rounded-2xl border border-outline-variant/30 mt-6">
                <div>
                  <label className="block font-label-md text-on-surface mb-2 font-bold">Remarks / Notes</label>
                  <textarea 
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder={actionType === 'REJECT' ? "Please explain why the request is rejected..." : "Optional approval notes..."}
                    className="w-full border border-outline-variant/50 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white shadow-sm transition-all"
                    rows={4}
                  ></textarea>
                </div>
                
                {actionType === 'APPROVE' && ['Hostel', 'Physics Lab', 'Chemistry Lab', 'Biology Lab', 'Library', 'IT Infra', 'Scholarship Office', 'Sports', 'FO'].includes(departmentName) && (
                  <div>
                    <label className="block font-label-md text-on-surface mb-2 font-bold">Fee Due Amount (₹)</label>
                    <input 
                      type="number"
                      value={feeAmount}
                      onChange={e => setFeeAmount(e.target.value)}
                      readOnly={fetchedFee !== null && feeAmount === fetchedFee.toString()}
                      placeholder="e.g. 500 (Leave empty if no dues)"
                      className={`w-full border border-outline-variant/50 rounded-xl p-4 text-sm focus:outline-none shadow-sm transition-all ${fetchedFee !== null && feeAmount === fetchedFee.toString() ? 'bg-surface-variant/30 text-on-surface-variant cursor-not-allowed' : 'focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white'}`}
                    />
                  </div>
                )}

                {actionType === 'APPROVE' && departmentName === 'FO' && selectedClearance.totalFeeDue > 0 && (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mt-4 mb-4">
                    <h5 className="font-bold text-amber-800 mb-1">Total Student Dues: ₹{selectedClearance.totalFeeDue}</h5>
                    <p className="text-xs text-amber-700 mb-3">The student must pay this accumulated amount before clearance is granted.</p>
                    <label className="block font-label-md text-amber-900 mb-2">Payment Reference ID <span className="text-red-500">*</span></label>
                    <input 
                      type="text"
                      required
                      value={referenceId}
                      onChange={e => setReferenceId(e.target.value)}
                      placeholder="e.g. TXN-123456789"
                      className="w-full border border-amber-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
                    />
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  <button 
                    disabled={isConfirming || isConfirmed}
                    onClick={() => setActionType(null)} 
                    className="flex-1 border border-outline-variant py-3 rounded-xl font-label-md font-semibold hover:bg-surface-variant/50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isConfirming || isConfirmed}
                    onClick={handleAction} 
                    className={`flex-1 text-white py-3 rounded-xl font-label-md font-semibold flex items-center justify-center gap-2 transition-all duration-300 ${
                      isConfirmed ? (actionType === 'APPROVE' ? 'bg-green-500' : 'bg-red-500') : 
                      (actionType === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700')
                    } disabled:opacity-80`}
                  >
                    {isConfirmed ? (
                      <><CheckCircle2 className="w-5 h-5 animate-in zoom-in" /> Confirmed</>
                    ) : isConfirming ? (
                      <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Confirming...</>
                    ) : (
                      actionType === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {!actionType && (
              <button 
                onClick={() => setSelectedClearance(null)} 
                className="mt-6 w-full border border-outline-variant text-on-surface-variant py-3 rounded-xl font-label-md font-semibold hover:bg-surface-variant/50 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* No Due Certificate Modal */}
      {showCertificate && selectedClearance?.student && (
        <NoDueCertificate 
          student={{
            name: selectedClearance.student.name,
            studentId: selectedClearance.student.studentId,
            program: selectedClearance.student.program
          }}
          onClose={() => setShowCertificate(false)}
        />
      )}
      {/* Toast Notification */}
      <div 
        className={`fixed bottom-6 right-6 bg-white text-on-surface px-4 py-2.5 rounded-full shadow-lg border border-green-200 flex items-center gap-2 z-[200] transition-all duration-500 ease-in-out ${
          showToast ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
        }`}
      >
        <CheckCircle2 className="w-5 h-5 text-green-600" />
        <span className="font-bold font-label-sm text-green-900">Dues Added Successfully</span>
      </div>

      {/* Forwarding Animation Popup */}
      {forwardingAnim.isAnimating && (
        <div className="fixed inset-0 bg-primary/80 backdrop-blur-md flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-3xl p-10 w-full max-w-2xl shadow-2xl flex flex-col items-center justify-center animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-headline-md font-bold text-primary mb-12">Forwarding Clearance Request...</h2>
            
            <div className="flex items-center justify-between w-full relative">
              {/* Current Department */}
              <div className="flex flex-col items-center gap-3 z-10">
                <div className="w-20 h-20 bg-blue-50 rounded-2xl border border-blue-200 flex items-center justify-center shadow-inner">
                  <Building2 className="w-10 h-10 text-blue-600" />
                </div>
                <span className="font-bold text-sm text-center max-w-[120px]">{departmentName}</span>
              </div>

              {/* Connecting Line & Moving File */}
              <div className="flex-1 mx-4 relative h-1 flex items-center">
                <div className="w-full border-t-2 border-dashed border-outline-variant absolute"></div>
                <div 
                  className="absolute bg-white p-2 rounded-lg shadow-md border border-primary/20 transition-all duration-[1500ms] ease-in-out z-20"
                  style={{ 
                    left: forwardingAnim.progress ? '100%' : '0%',
                    transform: 'translateX(-50%)'
                  }}
                >
                  <FileText className="w-6 h-6 text-primary" />
                </div>
              </div>

              {/* Next Department */}
              <div className="flex flex-col items-center gap-3 z-10">
                <div className={`w-20 h-20 rounded-2xl border flex items-center justify-center shadow-inner transition-colors duration-500 delay-1000 relative ${forwardingAnim.progress ? 'bg-green-50 border-green-200' : 'bg-surface border-outline-variant/30'}`}>
                  <Building2 className={`w-10 h-10 transition-colors duration-500 delay-1000 ${forwardingAnim.progress ? 'text-green-600' : 'text-outline'}`} />
                  
                  {/* Success Tick Badge */}
                  <div className={`absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-md transition-all duration-500 ease-out delay-[1300ms] ${forwardingAnim.progress ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <span className={`font-bold text-sm text-center max-w-[120px] transition-colors duration-500 delay-1000 ${forwardingAnim.progress ? 'text-green-800' : 'text-on-surface-variant'}`}>{forwardingAnim.nextDept}</span>
              </div>
            </div>
            
            <div className={`mt-12 text-sm font-medium ${forwardingAnim.completed ? 'text-green-600 animate-in fade-in zoom-in duration-300' : 'text-on-surface-variant animate-pulse'}`}>
              {forwardingAnim.completed ? 'Successfully Forwarded!' : 'Updating database records...'}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
