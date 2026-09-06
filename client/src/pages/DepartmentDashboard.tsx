import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, LogOut, Search, Bell, CheckCircle2, AlertCircle, Clock, ShieldCheck, CheckSquare, Printer } from 'lucide-react';
import NoDueCertificate from '../components/NoDueCertificate';

export default function DepartmentDashboard() {
  const [clearances, setClearances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClearance, setSelectedClearance] = useState<any>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [departmentName, setDepartmentName] = useState('Department');
  const navigate = useNavigate();

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
  }, [navigate]);

  const fetchClearances = async (deptName: string) => {
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
            student: studentDetails
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

    try {
      const dcRef = doc(db, 'departmentClearances', selectedClearance.id);
      const newStatus = actionType === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      
      await updateDoc(dcRef, {
        status: newStatus,
        remarks: remarks || '',
        updatedAt: new Date().toISOString()
      });
      
      const crRef = doc(db, 'clearanceRequests', selectedClearance.requestId);
      if (newStatus === 'REJECTED') {
        await updateDoc(crRef, { status: 'REJECTED', updatedAt: new Date().toISOString() });
      } else if (newStatus === 'APPROVED') {
        const currentIndex = DEPARTMENTS.indexOf(departmentName);
        const isLast = currentIndex === DEPARTMENTS.length - 1;
        if (isLast) {
          await updateDoc(crRef, { status: 'APPROVED', updatedAt: new Date().toISOString() });
        }
      }
      
      setSelectedClearance(null);
      setActionType(null);
      setRemarks('');
      
      fetchClearances(departmentName);
    } catch (e) {
      console.error(e);
      alert('Action failed. Please try again.');
    }
  };

  const handleForward = async () => {
    if (!selectedClearance) return;

    try {
      // Get the master request to determine program
      const crRef = doc(db, 'clearanceRequests', selectedClearance.requestId);
      const crSnap = await getDoc(crRef);
      const programType = crSnap.exists() ? crSnap.data().programType : 'PUC';
      
      const currentSequence = programType === 'B.Tech' ? BTECH_DEPARTMENTS : PUC_DEPARTMENTS;
      const currentIndex = currentSequence.indexOf(departmentName);
      const nextDeptName = currentIndex >= 0 && currentIndex < currentSequence.length - 1 ? currentSequence[currentIndex + 1] : null;
      
      if (!nextDeptName) return;
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
      
      setSelectedClearance((prev: any) => ({ ...prev, forwarded: true }));
      fetchClearances(departmentName);
    } catch (e) {
      console.error(e);
      alert('Failed to forward the request.');
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-background text-on-background font-body-md antialiased">
      
      {/* SideNavBar Component */}
      <aside className="bg-primary-container h-full w-64 fixed left-0 top-0 border-r border-outline-variant/10 shadow-xl flex flex-col py-8 z-50">
        <div className="px-6 mb-8 flex flex-col items-center">
          <div className="w-24 h-24 mb-4 flex items-center justify-center">
            <img src="/logo.png" alt="RGUKT Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-headline-sm text-lg font-bold text-surface-container-lowest text-center">RGUKT CLEARANCE HUB</h1>
          <p className="font-label-sm text-on-primary-container mt-1">Department Portal</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <a className="flex items-center gap-3 px-4 py-3 text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-r-lg font-label-md transition-transform duration-300" href="#">
            <LayoutDashboard className="w-5 h-5" />
            Requests
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-on-primary-container/70 font-label-md hover:bg-surface-variant/20 hover:text-surface-container-lowest transition-all duration-300 rounded-lg" href="#">
            <Users className="w-5 h-5" />
            Students
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-on-primary-container/70 font-label-md hover:bg-surface-variant/20 hover:text-surface-container-lowest transition-all duration-300 rounded-lg" href="#">
            <FileText className="w-5 h-5" />
            Reports
          </a>
        </nav>
        
        <div className="mt-8 px-4 space-y-2 border-t border-outline-variant/10 pt-4">
          <a className="flex items-center gap-3 px-4 py-2 text-on-primary-container/70 font-label-md hover:bg-surface-variant/20 hover:text-surface-container-lowest transition-all duration-300 rounded-lg" href="#">
            <Settings className="w-5 h-5" />
            Settings
          </a>
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
            <button className="text-on-surface-variant hover:text-secondary p-2 rounded-full hover:bg-surface-variant/50">
              <Bell className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-outline-variant/30">
              <span className="font-label-md font-bold text-primary">{departmentName}</span>
              <div className="w-9 h-9 rounded-full bg-secondary overflow-hidden border border-outline-variant/30 flex items-center justify-center text-white font-bold">
                {departmentName.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 max-w-[1440px] mx-auto w-full">
          
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
                    <td className="px-6 py-4 font-semibold text-primary">{c.student?.studentId}</td>
                    <td className="px-6 py-4 font-medium">{c.student?.name}</td>
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

        </main>
      </div>

      {/* Review Modal */}
      {selectedClearance && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-md w-full shadow-2xl border border-surface-variant animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-headline-md text-2xl font-bold text-primary mb-1">Review Clearance</h3>
                <p className="font-body-sm text-on-surface-variant">Process request for {selectedClearance.student?.name}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center">
                <CheckSquare className="w-6 h-6 text-primary" />
              </div>
            </div>
            
            <div className="bg-surface p-4 rounded-xl border border-surface-variant mb-6 flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">{selectedClearance.student?.name}</h4>
                <p className="text-sm text-slate-500 mb-1">{selectedClearance.student?.studentId} • {selectedClearance.student?.program}</p>
                <p className="text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded">
                  Req ID: {selectedClearance.id?.substring(0,8)}
                </p>
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

            {selectedClearance.status === 'PENDING' && !actionType && (
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

            {selectedClearance.status === 'APPROVED' && (
              <div className="mt-2">
                {(() => {
                  const currentIndex = DEPARTMENTS.indexOf(departmentName);
                  const nextDeptName = currentIndex >= 0 && currentIndex < DEPARTMENTS.length - 1 ? DEPARTMENTS[currentIndex + 1] : null;
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
              <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-200">
                <div>
                  <label className="block font-label-md text-on-surface mb-2">Remarks / Notes</label>
                  <textarea 
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder={actionType === 'REJECT' ? "Please explain why the request is rejected..." : "Optional approval notes..."}
                    className="w-full border border-outline-variant rounded-xl p-3 text-sm focus:ring-2 focus:ring-secondary-container focus:border-secondary-container outline-none bg-surface-container-lowest"
                    rows={4}
                  ></textarea>
                </div>
                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => setActionType(null)} 
                    className="flex-1 border border-outline-variant py-3 rounded-xl font-label-md font-semibold hover:bg-surface-variant/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAction} 
                    className={`flex-1 text-white py-3 rounded-xl font-label-md font-semibold flex items-center justify-center gap-2 ${actionType === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                  >
                    Confirm {actionType === 'APPROVE' ? 'Approval' : 'Rejection'}
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
    </div>
  );
}
