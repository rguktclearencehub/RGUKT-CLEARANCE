import { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc, limit, increment, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, LogOut, Search, Bell, CheckCircle2, AlertCircle, Clock, ShieldCheck, CheckSquare, Printer, Building2, FlaskConical, BookOpen, Monitor, GraduationCap, Briefcase, Dumbbell, Award, ClipboardList } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { generateDuesPdfBlob, uploadToGoogleDrive, getDriveDownloadLink, getDrivePreviewLink, fetchDetailedStudentDues, downloadPdfDirectly, type DepartmentDuesGroup } from '../utils/pdfGenerator';

const getDepartmentIcon = (deptName: string | null) => {
  if (!deptName) return Building2;
  const name = deptName.toLowerCase();
  if (name.includes('hostel')) return Building2;
  if (name.includes('dsw')) return Users;
  if (name.includes('sports')) return Dumbbell;
  if (name.includes('lab') || name.includes('physics') || name.includes('chemistry') || name.includes('biology')) return FlaskConical;
  if (name.includes('library')) return BookOpen;
  if (name.includes('it infra') || name.includes('engg')) return Monitor;
  if (name.includes('scholarship')) return GraduationCap;
  if (name.includes('fo') || name.includes('accounts')) return Briefcase;
  if (name.includes('director') || name.includes('dean') || name.includes('hod') || name.includes('coe') || name.includes('ao')) return Award;
  return Building2;
};
import NoDueCertificate from '../components/NoDueCertificate';
import HostelPenaltyManager from '../components/HostelPenaltyManager';

// EmailJS credentials for sending fee due notifications
const EMAILJS_SERVICE_ID = 'service_yato66e';
const EMAILJS_TEMPLATE_ID = 'template_zdq3aos';
const EMAILJS_PUBLIC_KEY = 'uX0TI21Zg8bha0FM0';

const formatInr = (val: string | number) => {
  if (!val && val !== 0) return '';
  const parts = val.toString().split('.');
  let intPart = parts[0];
  if (intPart) {
    intPart = Number(intPart).toLocaleString('en-IN');
  }
  return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
};
const parseInr = (val: string) => val.replace(/,/g, '').replace(/[^0-9.]/g, '');

export default function DepartmentDashboard() {
  const [clearances, setClearances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClearance, setSelectedClearance] = useState<any>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [maintenanceFee, setMaintenanceFee] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [fetchedFee, setFetchedFee] = useState<number | null>(null);
  const [fetchedPenalties, setFetchedPenalties] = useState<any[] | null>(null);
  const [fetchedAllDeptDues, setFetchedAllDeptDues] = useState<DepartmentDuesGroup[] | null>(null);
  const [isFetchingFee, setIsFetchingFee] = useState(false);
  const [isDuesAdded, setIsDuesAdded] = useState(false);
  const [isAddingDues, setIsAddingDues] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [forwardingAnim, setForwardingAnim] = useState<{ isAnimating: boolean; nextDept: string | null; progress: boolean; completed: boolean }>({ isAnimating: false, nextDept: null, progress: false, completed: false });
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [departmentName, setDepartmentName] = useState('Department');
  const [currentTab, setCurrentTab] = useState<'requests' | 'hostelPenalty' | 'dswPenalty' | 'labPenalty' | 'libraryPenalty' | 'itInfraPenalty' | 'profile'>('requests');
  const [selectedHostelView, setSelectedHostelView] = useState<string | null>(null);
  const [wardenName, setWardenName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const isHostelWarden = departmentName === 'Boys Hostel' || departmentName === 'Girls Hostel';
  const isLabDept = ['Physics Lab', 'Chemistry Lab', 'Biology Lab'].includes(departmentName);

  // COE Academic Status Check state
  const [showAcademicModal, setShowAcademicModal] = useState(false);
  const [coeAcademicCheck, setCoeAcademicCheck] = useState<{
    checked: boolean;
    hasRemedial: boolean;
    remedialSemesters: string[];
    records: Record<string, 'PASS' | 'REMEDIAL'>;
  } | null>(null);
  const [academicProgramType, setAcademicProgramType] = useState<'PUC' | 'B.Tech'>('PUC');
  const [academicFormRecords, setAcademicFormRecords] = useState<Record<string, 'PASS' | 'REMEDIAL'>>({});

  // Scholarship Office state
  const [scholarshipRecords, setScholarshipRecords] = useState<Record<string, { credited: string; due: string }>>({});
  const [scholarshipProgramType, setScholarshipProgramType] = useState<'PUC' | 'B.Tech'>('PUC');

  const getClearanceProgram = (c: any): 'PUC' | 'B.Tech' => {
    if (!c) return 'PUC';
    const raw = (c.programType || c.program || c.student?.program || '').trim().toLowerCase();
    if (raw === 'b.tech' || raw === 'btech') return 'B.Tech';
    return 'PUC';
  };

  const openAcademicModal = () => {
    const prog = getClearanceProgram(selectedClearance);
    setAcademicProgramType(prog);
    
    const sems = prog === 'B.Tech' ? BTECH_SEMESTERS : PUC_SEMESTERS;
    const allowedSemNames = new Set<string>();
    sems.forEach(grp => grp.sems.forEach(s => allowedSemNames.add(s)));

    const existingRecords = coeAcademicCheck?.records || selectedClearance?.academicRecord || {};
    const initial: Record<string, 'PASS' | 'REMEDIAL'> = {};
    allowedSemNames.forEach(s => {
      initial[s] = existingRecords[s] || 'PASS';
    });

    setAcademicFormRecords(initial);
    setShowAcademicModal(true);
  };

  const handleProgramToggle = (newProg: 'PUC' | 'B.Tech') => {
    setAcademicProgramType(newProg);
    const sems = newProg === 'B.Tech' ? BTECH_SEMESTERS : PUC_SEMESTERS;
    const allowedSemNames = new Set<string>();
    sems.forEach(grp => grp.sems.forEach(s => allowedSemNames.add(s)));

    setAcademicFormRecords(prev => {
      const updated: Record<string, 'PASS' | 'REMEDIAL'> = {};
      allowedSemNames.forEach(s => {
        updated[s] = prev[s] || 'PASS';
      });
      return updated;
    });
  };

  const handleMarkAllPass = () => {
    const sems = academicProgramType === 'B.Tech' ? BTECH_SEMESTERS : PUC_SEMESTERS;
    const updated: Record<string, 'PASS' | 'REMEDIAL'> = {};
    sems.forEach(grp => {
      grp.sems.forEach(s => {
        updated[s] = 'PASS';
      });
    });
    setAcademicFormRecords(updated);
  };

  const handleSemesterStatusChange = (sem: string, status: 'PASS' | 'REMEDIAL') => {
    setAcademicFormRecords(prev => ({
      ...prev,
      [sem]: status
    }));
  };

  const handleSaveAcademicStatus = () => {
    const prog = academicProgramType;
    const sems = prog === 'B.Tech' ? BTECH_SEMESTERS : PUC_SEMESTERS;
    
    const allSemNames: string[] = [];
    sems.forEach(grp => grp.sems.forEach(s => allSemNames.push(s)));
    
    const cleanRecords: Record<string, 'PASS' | 'REMEDIAL'> = {};
    allSemNames.forEach(s => {
      cleanRecords[s] = academicFormRecords[s] || 'PASS';
    });

    const remedials = allSemNames.filter(s => cleanRecords[s] === 'REMEDIAL');
    const hasRemedial = remedials.length > 0;
    
    const checkResult = {
      checked: true,
      hasRemedial,
      remedialSemesters: remedials,
      records: cleanRecords
    };
    
    setCoeAcademicCheck(checkResult);
    setShowAcademicModal(false);
    
    if (hasRemedial) {
      setRemarks(`Academic clearance rejected by COE: Remedial pending in ${remedials.join(', ')}.`);
      setActionType('REJECT');
    } else {
      if (remarks.startsWith('Academic clearance rejected')) {
        setRemarks('');
      }
      setActionType(null);
    }
  };
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

  const PUC_SEMESTERS = [
    { group: 'PUC 1 (P1)', sems: ['PUC-1 Sem 1', 'PUC-1 Sem 2'] },
    { group: 'PUC 2 (P2)', sems: ['PUC-2 Sem 1', 'PUC-2 Sem 2'] }
  ];

  const BTECH_SEMESTERS = [
    { group: 'PUC 1 (P1)', sems: ['PUC-1 Sem 1', 'PUC-1 Sem 2'] },
    { group: 'PUC 2 (P2)', sems: ['PUC-2 Sem 1', 'PUC-2 Sem 2'] },
    { group: 'B.Tech 1st Year (E1)', sems: ['B.Tech E1 Sem 1', 'B.Tech E1 Sem 2'] },
    { group: 'B.Tech 2nd Year (E2)', sems: ['B.Tech E2 Sem 1', 'B.Tech E2 Sem 2'] },
    { group: 'B.Tech 3rd Year (E3)', sems: ['B.Tech E3 Sem 1', 'B.Tech E3 Sem 2'] },
    { group: 'B.Tech 4th Year (E4)', sems: ['B.Tech E4 Sem 1', 'B.Tech E4 Sem 2'] }
  ];

  const SCHOLARSHIP_YEARS_DEF = [
    { id: 'puc1', name: 'PUC 1st Year (P1)', totalGrant: 45000, category: 'PUC' as const },
    { id: 'puc2', name: 'PUC 2nd Year (P2)', totalGrant: 45000, category: 'PUC' as const },
    { id: 'e1', name: 'B.Tech 1st Year (E1)', totalGrant: 50000, category: 'B.Tech' as const },
    { id: 'e2', name: 'B.Tech 2nd Year (E2)', totalGrant: 50000, category: 'B.Tech' as const },
    { id: 'e3', name: 'B.Tech 3rd Year (E3)', totalGrant: 50000, category: 'B.Tech' as const },
    { id: 'e4', name: 'B.Tech 4th Year (E4)', totalGrant: 50000, category: 'B.Tech' as const },
  ];

  // Automatically determine if selected student is B.Tech or PUC
  const currentStudentProgram: 'PUC' | 'B.Tech' = getClearanceProgram(selectedClearance);
  const isSelectedStudentBTech = currentStudentProgram === 'B.Tech';

  const activeScholarshipYears = SCHOLARSHIP_YEARS_DEF.filter(y => {
    if (currentStudentProgram === 'PUC') return y.category === 'PUC';
    return true; // For B.Tech: PUC 1, PUC 2, and B.Tech 1st to 4th Year (all 6 years in a single form)
  });

  const totalScholarshipDue = activeScholarshipYears.reduce((sum, y) => {
    const rec = scholarshipRecords[y.id];
    if (!rec || rec.due === undefined || rec.due === '') return sum;
    return sum + (parseFloat(rec.due) || 0);
  }, 0);

  const totalScholarshipCredited = activeScholarshipYears.reduce((sum, y) => {
    const rec = scholarshipRecords[y.id];
    if (!rec || rec.credited === undefined || rec.credited === '') return sum;
    return sum + (parseFloat(rec.credited) || 0);
  }, 0);

  const totalScholarshipEntitled = activeScholarshipYears.reduce((sum, y) => sum + y.totalGrant, 0);

  const handleScholarshipCreditedChange = (yearId: string, valStr: string) => {
    const yearDef = SCHOLARSHIP_YEARS_DEF.find(y => y.id === yearId);
    if (!yearDef) return;

    if (valStr.trim() === '') {
      setScholarshipRecords(prev => {
        const next = { ...prev };
        delete next[yearId];
        return next;
      });
      return;
    }

    const creditedNum = Math.max(0, parseFloat(valStr) || 0);
    const dueNum = Math.max(0, yearDef.totalGrant - creditedNum);

    setScholarshipRecords(prev => ({
      ...prev,
      [yearId]: {
        credited: valStr,
        due: dueNum.toString()
      }
    }));
  };

  const handleScholarshipDueChange = (yearId: string, valStr: string) => {
    const yearDef = SCHOLARSHIP_YEARS_DEF.find(y => y.id === yearId);
    if (!yearDef) return;

    if (valStr.trim() === '') {
      setScholarshipRecords(prev => {
        const next = { ...prev };
        delete next[yearId];
        return next;
      });
      return;
    }

    const dueNum = Math.max(0, parseFloat(valStr) || 0);
    const creditedNum = Math.max(0, yearDef.totalGrant - dueNum);

    setScholarshipRecords(prev => ({
      ...prev,
      [yearId]: {
        credited: creditedNum.toString(),
        due: valStr
      }
    }));
  };

  const handleMarkAllFullCredited = () => {
    const updated: Record<string, { credited: string; due: string }> = {};
    activeScholarshipYears.forEach(y => {
      updated[y.id] = {
        credited: y.totalGrant.toString(),
        due: '0'
      };
    });
    setScholarshipRecords(updated);
  };

  const handleClearScholarship = () => {
    setScholarshipRecords({});
  };

  useEffect(() => {
    if (departmentName === 'Scholarship Office' && selectedClearance) {
      if (totalScholarshipDue > 0) {
        setFeeAmount(totalScholarshipDue.toString());
        setActionType('APPROVE');
      } else {
        setFeeAmount('0');
      }
    }
  }, [departmentName, selectedClearance?.id, totalScholarshipDue]);

  const handleSelectClearance = async (c: any) => {
    setSelectedClearance(c);
    setFetchedFee(null);
    setFetchedPenalties(null);
    setFetchedAllDeptDues(null);
    setActionType(null);
    setRemarks('');
    setFeeAmount('');
    setMaintenanceFee('');
    setReferenceId('');
    setIsDuesAdded(false);
    setIsAddingDues(false);
    if (c.academicStatus) {
      const isBTech = getClearanceProgram(c) === 'B.Tech';
      const rawRecords = (c.academicRecord as Record<string, 'PASS' | 'REMEDIAL'>) || {};
      const filteredRecords: Record<string, 'PASS' | 'REMEDIAL'> = {};
      const sems = isBTech ? BTECH_SEMESTERS : PUC_SEMESTERS;
      sems.forEach(grp => grp.sems.forEach(s => {
        if (rawRecords[s]) filteredRecords[s] = rawRecords[s];
      }));
      const remedials = Object.keys(filteredRecords).filter(s => filteredRecords[s] === 'REMEDIAL');
      setCoeAcademicCheck({
        checked: true,
        hasRemedial: remedials.length > 0,
        remedialSemesters: remedials,
        records: filteredRecords
      });
    } else {
      setCoeAcademicCheck(null);
    }

    if (departmentName === 'Scholarship Office') {
      const prog = getClearanceProgram(c);
      setScholarshipProgramType(prog);

      if (c.scholarshipDetails?.records) {
        setScholarshipRecords(c.scholarshipDetails.records);
        if (c.scholarshipDetails.totalDue > 0) {
          setFeeAmount(c.scholarshipDetails.totalDue.toString());
        }
      } else if (c.student?.studentId) {
        try {
          const sDoc = await getDoc(doc(db, 'scholarshipRecords', c.student.studentId));
          if (sDoc.exists() && sDoc.data().records) {
            setScholarshipRecords(sDoc.data().records);
            if (sDoc.data().totalDue > 0) {
              setFeeAmount(sDoc.data().totalDue.toString());
            }
          } else {
            setScholarshipRecords({});
          }
        } catch (err) {
          console.error('Error loading scholarship record:', err);
          setScholarshipRecords({});
        }
      } else {
        setScholarshipRecords({});
      }
    }
  };


  const PUC_DEPARTMENTS = [
    'Hostel', 'DSW', 'Sports', 'Physics Lab', 'Chemistry Lab', 'Biology Lab',
    'COE', 'Library', 'IT Infra', 'Scholarship Office',
    'FO', 'AO', 'Director', 'Dean of Academics'
  ];

  const BTECH_DEPARTMENTS = [
    'Hostel', 'DSW', 'Sports', 'Physics Lab', 'Chemistry Lab', 'Biology Lab', 'Engg Labs',
    'COE', 'HOD', 'Library', 'IT Infra', 'Scholarship Office',
    'FO', 'AO', 'Director', 'Dean of Academics'
  ];

  const getDepartmentSequence = (
    programType?: string | null,
    pucCourseType?: string | null,
    courseType?: string | null
  ) => {
    const isBTech = programType === 'B.Tech';
    const base = isBTech ? BTECH_DEPARTMENTS : PUC_DEPARTMENTS;
    const isMpc = pucCourseType === 'MPC' || (!isBTech && courseType === 'MPC');
    return base.filter(d => !(isMpc && d === 'Biology Lab'));
  };

  const PUC_HOSTELS = ["Old campus", "BH1 front side"];
  const BTECH_HOSTELS = ["BH1 Back side", "BH2 Front side", "BH2 Backside", "GH1", "GH2"];
  const ALL_HOSTELS = [...PUC_HOSTELS, ...BTECH_HOSTELS];
  
  const BOYS_HOSTELS = ["BH1 front side", "BH1 Back side", "BH2 Front side", "BH2 Backside"];
  const GIRLS_HOSTELS = ["Old campus", "GH1", "GH2"];

  // Keep a combined list just for getExactDeptName
  const DEPARTMENTS = [...new Set([...PUC_DEPARTMENTS, ...BTECH_DEPARTMENTS, 'Boys Hostel', 'Girls Hostel'])];

  const getExactDeptName = (user: any) => {
    if (!user) return '';

    // 1. Direct email prefix match (foolproof)
    const email = (typeof user === 'object' && user?.email ? user.email : '').toLowerCase().trim();
    if (email.startsWith('dsw@')) return 'DSW';
    if (email.startsWith('sports@')) return 'Sports';
    if (email.startsWith('boys_hostel@')) return 'Boys Hostel';
    if (email.startsWith('girls_hostel@')) return 'Girls Hostel';
    if (email.startsWith('hostel@')) return 'Hostel';
    if (email.startsWith('physicslab@')) return 'Physics Lab';
    if (email.startsWith('chemistrylab@')) return 'Chemistry Lab';
    if (email.startsWith('biologylab@')) return 'Biology Lab';
    if (email.startsWith('engglabs@') || email.startsWith('engglabsassistant@')) return 'Engg Labs';
    if (email.startsWith('coe@')) return 'COE';
    if (email.startsWith('library@')) return 'Library';
    if (email.startsWith('itinfra@')) return 'IT Infra';
    if (email.startsWith('scholarshipoffice@')) return 'Scholarship Office';
    if (email.startsWith('fo@') || email.startsWith('accounts@')) return 'FO';
    if (email.startsWith('ao@')) return 'AO';
    if (email.startsWith('director@')) return 'Director';
    if (email.startsWith('deanofacademics@')) return 'Dean of Academics';

    // 2. Extract string candidates from user.departmentName, user.name, or user if string
    const candidates = [
      typeof user === 'object' ? user.departmentName : null,
      typeof user === 'object' ? user.name : null,
      typeof user === 'string' ? user : null
    ];

    for (const cand of candidates) {
      if (!cand || typeof cand !== 'string') continue;
      const cleaned = cand.trim();
      // Remove trailing " Admin" or " admin"
      const noAdmin = cleaned.replace(/\s+admin$/i, '').trim();

      for (const text of [cleaned, noAdmin]) {
        const normalized = text.replace(/\s+/g, '').toLowerCase();
        if (normalized === 'accounts' || normalized === 'fo') return 'FO';
        if (normalized === 'deanofstudentwelfare' || normalized === 'dsw') return 'DSW';
        const match = DEPARTMENTS.find(d => d.replace(/\s+/g, '').toLowerCase() === normalized);
        if (match) return match;
      }
    }

    return typeof user === 'object' ? (user.departmentName || user.name || '') : user;
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login', { replace: true });
      return;
    }
    const user = JSON.parse(userStr);
    const exactName = getExactDeptName(user);
    setDepartmentName(exactName);
    setWardenName(user.wardenName || '');

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
                      totalFeeDue: crSnap.data().totalFeeDue || 0,
                      presentHostel: crSnap.data().presentHostel || null,
                      programType: crSnap.data().programType || crSnap.data().program || studentDetails.program || 'PUC',
                      courseType: crSnap.data().courseType || null,
                      pucCourseType: crSnap.data().pucCourseType || null
                    };
                    
                    // Don't show MPC students in Biology Lab
                    if (departmentName === 'Biology Lab') {
                      const isMpc = newClearance.pucCourseType === 'MPC' || (newClearance.programType === 'PUC' && newClearance.courseType === 'MPC');
                      if (isMpc) return prev;
                    }
                    
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

    // Prevent back navigation
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      setCurrentTab(prev => {
        if (prev !== 'requests') {
          window.history.pushState(null, '', window.location.href);
          return 'requests';
        }
        window.history.pushState(null, '', window.location.href);
        return prev;
      });
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
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
            totalFeeDue: crSnap.data().totalFeeDue || 0,
            feeReceiptUrl: crSnap.data().feeReceiptUrl || null,
            presentHostel: crSnap.data().presentHostel || null,
            programType: crSnap.data().programType || crSnap.data().program || studentDetails.program || 'PUC',
            courseType: crSnap.data().courseType || null,
            pucCourseType: crSnap.data().pucCourseType || null
          });
        }
      }
      
      const visibleRequests = requests.filter((r: any) => {
        if (r.status === 'LOCKED') return false;
        if (deptName === 'Biology Lab') {
          const isMpc = r.pucCourseType === 'MPC' || (r.programType === 'PUC' && r.courseType === 'MPC');
          if (isMpc) return false;
        }
        return true;
      });
      setClearances(visibleRequests);
    } catch (err) {
      console.error(err);
      navigate('/login', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (targetActionType?: 'APPROVE' | 'REJECT') => {
    const actType = targetActionType || actionType;
    if (!selectedClearance || !actType) return;

    if (actType === 'REJECT' && !remarks.trim()) {
      alert("Please enter a remark explaining the reason for rejection.");
      return;
    }

    const currentDisplayDue = isDuesAdded ? Number(feeAmount) : 0;
    if (actType === 'APPROVE' && departmentName === 'FO' && currentDisplayDue > 0 && !referenceId.trim()) {
      alert("Please enter the Payment Reference ID to approve this request.");
      return;
    }

    setActionType(actType);
    setIsConfirming(true);
    try {
      const dcRef = doc(db, 'departmentClearances', selectedClearance.id);
      const newStatus = actType === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const baseFee = parseFloat(feeAmount) || 0;
      const maintFee = departmentName === 'DSW' ? (parseFloat(maintenanceFee) || 0) : 0;
      const feeNum = baseFee + maintFee;
      
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      const dcUpdateData: any = {
        status: newStatus,
        remarks: remarks || '',
        updatedAt: new Date().toISOString()
      };
      if (departmentName === 'COE' && coeAcademicCheck) {
        dcUpdateData.academicStatus = coeAcademicCheck.hasRemedial ? 'REMEDIAL' : 'PASSED';
        dcUpdateData.remedialSemesters = coeAcademicCheck.remedialSemesters || [];
        dcUpdateData.academicRecord = coeAcademicCheck.records || {};
      }
      if (user && user.wardenName) {
        dcUpdateData.handledBy = user.wardenName;
      }
      if (feeNum > 0) {
        dcUpdateData.feeDue = feeNum;
        if (maintFee > 0) dcUpdateData.maintenanceFee = maintFee;
        if (fetchedPenalties && fetchedPenalties.length > 0) {
          dcUpdateData.penalties = fetchedPenalties.map((p: any) => ({
            reason: p.reason,
            amount: Number(p.amount) || 0
          }));
        }
      }
      if (departmentName === 'Scholarship Office') {
        const scholarshipPayload = {
          program: currentStudentProgram,
          records: scholarshipRecords,
          totalCredited: totalScholarshipCredited,
          totalDue: totalScholarshipDue,
          years: activeScholarshipYears.map(y => ({
            id: y.id,
            name: y.name,
            totalGrant: y.totalGrant,
            credited: parseFloat(scholarshipRecords[y.id]?.credited) || 0,
            due: parseFloat(scholarshipRecords[y.id]?.due) || 0
          })),
          updatedAt: new Date().toISOString()
        };
        dcUpdateData.scholarshipDetails = scholarshipPayload;

        if (selectedClearance.student?.studentId) {
          try {
            await setDoc(doc(db, 'scholarshipRecords', selectedClearance.student.studentId), {
              studentId: selectedClearance.student.studentId,
              studentName: selectedClearance.student?.name || '',
              scholarshipId: selectedClearance.student?.scholarshipId || '',
              ...scholarshipPayload
            }, { merge: true });
          } catch (sErr) {
            console.error('Error saving scholarship record doc:', sErr);
          }
        }
      }

      await updateDoc(dcRef, dcUpdateData);

      
      const crRef = doc(db, 'clearanceRequests', selectedClearance.requestId);
      const programType = getClearanceProgram(selectedClearance);
      const currentSequence = getDepartmentSequence(programType, selectedClearance.pucCourseType, selectedClearance.courseType);
      const seqDeptName = (departmentName === 'Boys Hostel' || departmentName === 'Girls Hostel') ? 'Hostel' : departmentName;
      const currentIndex = currentSequence.indexOf(seqDeptName);
      const isLast = currentIndex === currentSequence.length - 1;

      const crUpdateData: any = { updatedAt: new Date().toISOString() };
      
      if (departmentName === 'Scholarship Office' && dcUpdateData.scholarshipDetails) {
        crUpdateData.scholarshipDetails = dcUpdateData.scholarshipDetails;
      }
      
      if (newStatus === 'REJECTED') {
        crUpdateData.status = 'REJECTED';
      } else if (newStatus === 'APPROVED' && isLast) {
        crUpdateData.status = 'APPROVED';
      }

      if (feeNum > 0 && newStatus === 'APPROVED') {
        crUpdateData.totalFeeDue = increment(feeNum);
      }

      if (departmentName === 'FO' && newStatus === 'APPROVED') {
        if (referenceId.trim()) crUpdateData.paymentReferenceId = referenceId;
        crUpdateData.totalFeeDue = 0;
        
        // Update departmentClearances
        const dcQuery = query(collection(db, 'departmentClearances'), where('requestId', '==', selectedClearance.requestId));
        const dcSnap = await getDocs(dcQuery);
        for (const dcDoc of dcSnap.docs) {
          if (dcDoc.data().feeDue > 0) {
            await updateDoc(doc(db, 'departmentClearances', dcDoc.id), { feeDue: 0, status_fee: 'PAID' });
          }
        }
        
        // Update maintenanceFees (Library, Sports, etc)
        if (selectedClearance.student?.studentId) {
          const feeDocRef = doc(db, 'maintenanceFees', selectedClearance.student.studentId);
          await setDoc(feeDocRef, { pendingFee: 0 }, { merge: true });
        }
        
        // Update hostelPenalties
        if (selectedClearance.student?.studentId) {
          const hpQuery = query(collection(db, 'hostelPenalties'), where('studentId', '==', selectedClearance.student.studentId), where('status', '==', 'PENDING'));
          const hpSnap = await getDocs(hpQuery);
          for (const hpDoc of hpSnap.docs) {
            await updateDoc(doc(db, 'hostelPenalties', hpDoc.id), { status: 'PAID', updatedAt: new Date().toISOString() });
          }
        }

        // Update dswPenalties
        if (selectedClearance.student?.studentId) {
          const dswQuery = query(collection(db, 'dswPenalties'), where('studentId', '==', selectedClearance.student.studentId), where('status', '==', 'PENDING'));
          const dswSnap = await getDocs(dswQuery);
          for (const dswDoc of dswSnap.docs) {
            await updateDoc(doc(db, 'dswPenalties', dswDoc.id), { status: 'PAID', updatedAt: new Date().toISOString() });
          }
        }

        // Update libraryPenalties
        if (selectedClearance.student?.studentId) {
          const libQuery = query(collection(db, 'libraryPenalties'), where('studentId', '==', selectedClearance.student.studentId), where('status', '==', 'PENDING'));
          const libSnap = await getDocs(libQuery);
          for (const libDoc of libSnap.docs) {
            await updateDoc(doc(db, 'libraryPenalties', libDoc.id), { status: 'PAID', updatedAt: new Date().toISOString() });
          }
        }

        // Update itInfraPenalties
        if (selectedClearance.student?.studentId) {
          const itQuery = query(collection(db, 'itInfraPenalties'), where('studentId', '==', selectedClearance.student.studentId), where('status', '==', 'PENDING'));
          const itSnap = await getDocs(itQuery);
          for (const itDoc of itSnap.docs) {
            await updateDoc(doc(db, 'itInfraPenalties', itDoc.id), { status: 'PAID', updatedAt: new Date().toISOString() });
          }
        }
      }
      
      await updateDoc(crRef, crUpdateData);
      
      // Send final completion email to student
      if (newStatus === 'APPROVED' && isLast) {
        try {
          const studentDashboardUrl = 'https://rguktclearance.vercel.app/login';
          const htmlMessage = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <div style="background: linear-gradient(135deg, #16a34a, #15803d); padding: 30px 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Clearance Application Completed!</h1>
              </div>
              <div style="padding: 30px; background-color: white;">
                <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Dear <strong>${selectedClearance.student?.name}</strong>,</p>
                <p style="color: #334155; font-size: 16px; margin-bottom: 25px; line-height: 1.6;">
                  Congratulations! Your clearance application has been fully approved by all departments. You are now officially cleared.
                </p>
                
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${studentDashboardUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">Download NDC Certification</a>
                </div>
              </div>
              <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  RGUKT Clearance Hub &copy; ${new Date().getFullYear()}<br>
                  This is an automated message, please do not reply.
                </p>
              </div>
            </div>
          `;

          await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            {
              to_name: selectedClearance.student?.name || 'Student',
              to_email: selectedClearance.student?.email,
              html_message: htmlMessage
            },
            EMAILJS_PUBLIC_KEY
          );
          console.log('Final completion email sent to student!');
        } catch (emailErr) {
          console.error('Failed to send final completion EmailJS notification:', emailErr);
        }
      }
      
      setIsConfirming(false);
      setIsConfirmed(true);
      
      setTimeout(() => {
        setSelectedClearance((prev: any) => prev ? { ...prev, status: newStatus } : null);
        setActionType(null);
        setRemarks('');
        setFeeAmount('');
        setMaintenanceFee('');
        setReferenceId('');
        setFetchedFee(null);
        setScholarshipRecords({});
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
    setFetchedAllDeptDues(null);
    setIsDuesAdded(false);
    setIsAddingDues(false);
    setShowToast(false);
    try {
      if (departmentName === 'FO') {
        // Finance Officer (FO): Fetch itemized dues across ALL university departments
        let reqData: any = null;
        if (selectedClearance.requestId) {
          try {
            const rSnap = await getDoc(doc(db, 'clearanceRequests', selectedClearance.requestId));
            if (rSnap.exists()) {
              reqData = { id: rSnap.id, ...rSnap.data() };
            }
          } catch (e) {
            console.warn('Could not load clearance request document:', e);
          }
        }
        const { groups, grandTotal: total } = await fetchDetailedStudentDues(
          selectedClearance.student.studentId,
          reqData || selectedClearance
        );
        setFetchedAllDeptDues(groups);
        setFetchedFee(total);
      } else if (departmentName === 'Boys Hostel' || departmentName === 'Girls Hostel') {
        const q = query(collection(db, 'hostelPenalties'), where('studentId', '==', selectedClearance.student.studentId), where('status', '==', 'PENDING'));
        const snap = await getDocs(q);
        const penalties = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const total = penalties.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        setFetchedPenalties(penalties);
        setFetchedFee(total);
      } else if (departmentName === 'DSW') {
        const q = query(collection(db, 'dswPenalties'), where('studentId', '==', selectedClearance.student.studentId), where('status', '==', 'PENDING'));
        const snap = await getDocs(q);
        const penalties = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const total = penalties.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        setFetchedPenalties(penalties);
        setFetchedFee(total);
      } else if (isLabDept) {
        const q = query(collection(db, 'labPenalties'), where('studentId', '==', selectedClearance.student.studentId), where('department', '==', departmentName), where('status', '==', 'PENDING'));
        const snap = await getDocs(q);
        const penalties = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const total = penalties.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        setFetchedPenalties(penalties);
        setFetchedFee(total);
      } else if (departmentName === 'Library') {
        const q = query(collection(db, 'libraryPenalties'), where('studentId', '==', selectedClearance.student.studentId), where('status', '==', 'PENDING'));
        const snap = await getDocs(q);
        const penalties = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const total = penalties.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        setFetchedPenalties(penalties);
        setFetchedFee(total);
      } else if (departmentName === 'IT Infra') {
        const q = query(collection(db, 'itInfraPenalties'), where('studentId', '==', selectedClearance.student.studentId), where('status', '==', 'PENDING'));
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
          if (data.department && data.department !== departmentName) {
            setFetchedFee(0);
          } else if (data.departments && typeof data.departments === 'object') {
            setFetchedFee(Number(data.departments[departmentName]) || 0);
          } else if (data.pendingFee !== undefined && (!data.department || data.department === departmentName)) {
            setFetchedFee(Number(data.pendingFee) || 0);
          } else {
            setFetchedFee(0);
          }
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

  const handleDownloadFoDuesPdf = async () => {
    if (!selectedClearance || !fetchedAllDeptDues) return;
    try {
      const blob = await generateDuesPdfBlob(
        '',
        {
          name: selectedClearance.student?.name || selectedClearance.student?.studentId,
          studentId: selectedClearance.student?.studentId,
          program: selectedClearance.programType || selectedClearance.student?.program || 'PUC',
          department: selectedClearance.department || selectedClearance.student?.department,
          hostel: selectedClearance.presentHostel || selectedClearance.student?.hostel
        },
        fetchedAllDeptDues,
        fetchedFee || 0
      );
      downloadPdfDirectly(blob, `${selectedClearance.student.studentId}_Official_RGUKT_Dues_Statement.pdf`);
    } catch (err: any) {
      alert('Error generating PDF report: ' + (err.message || err));
    }
  };

  const handleForward = async () => {
    if (!selectedClearance) return;
    setIsForwarding(true);
    
    // Determine next department
    let nextDeptName: string | null = null;
    try {
      // Get the master request to determine program and get FRESH fee due
      const crRef = doc(db, 'clearanceRequests', selectedClearance.requestId);
      const crSnap = await getDoc(crRef);
      const crData = crSnap.exists() ? crSnap.data() : {};
      const programType = crData.programType || selectedClearance.programType || selectedClearance.student?.program || 'PUC';
      const pucCourseType = crData.pucCourseType || selectedClearance.pucCourseType;
      const courseType = crData.courseType || selectedClearance.courseType;
      const latestTotalFeeDue = crSnap.exists() ? (crData.totalFeeDue || 0) : 0;
      
      const currentSequence = getDepartmentSequence(programType, pucCourseType, courseType);
      const seqDeptName = (departmentName === 'Boys Hostel' || departmentName === 'Girls Hostel') ? 'Hostel' : departmentName;
      const currentIndex = currentSequence.indexOf(seqDeptName);
      nextDeptName = currentIndex >= 0 && currentIndex < currentSequence.length - 1 ? currentSequence[currentIndex + 1] : null;
      
      if (!nextDeptName) return;

      // If student is MPC, ensure Biology Lab clearance is cleaned up if it was mistakenly created
      const isMpc = pucCourseType === 'MPC' || (programType !== 'B.Tech' && courseType === 'MPC');
      if (isMpc) {
        try {
          const bioQ = query(
            collection(db, 'departmentClearances'), 
            where('requestId', '==', selectedClearance.requestId), 
            where('departmentName', '==', 'Biology Lab')
          );
          const bioSnap = await getDocs(bioQ);
          for (const bDoc of bioSnap.docs) {
            await deleteDoc(bDoc.ref);
          }
        } catch (cleanErr) {
          console.error('Failed to clean up Biology Lab clearance:', cleanErr);
        }
      }
      
      // If we are forwarding to FO and there are dues, send an email to the student
      if (nextDeptName === 'FO' && latestTotalFeeDue > 0 && selectedClearance.student?.email) {
        try {
          // Fetch detailed itemized dues breakdown divided by department
          const { groups: duesGroups, grandTotal } = await fetchDetailedStudentDues(
            selectedClearance.student.studentId,
            { id: selectedClearance.requestId, ...crData }
          );
          
          let duesHtml = '';
          if (duesGroups.length === 0) {
            duesHtml = `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #64748b;">No pending dues.</td></tr>`;
          } else {
            duesGroups.forEach(g => {
              duesHtml += `
                <tr style="background-color: #f8fafc;">
                  <td colspan="3" style="padding: 10px 12px; border-bottom: 1px solid #cbd5e1; color: #1e293b; font-weight: bold; font-size: 13px;">
                    📁 ${g.department.toUpperCase()} &nbsp;<span style="color: #64748b; font-weight: normal; font-size: 12px;">(Subtotal: ₹${g.subtotal.toLocaleString('en-IN')})</span>
                  </td>
                </tr>
              `;
              g.items.forEach(item => {
                duesHtml += `
                  <tr>
                    <td style="padding: 10px 12px 10px 24px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 13px;">• ${g.department}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 500; font-size: 13px;">${item.reason}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #dc2626; font-weight: 700; text-align: right; font-size: 13px;">₹${item.amount.toLocaleString('en-IN')}</td>
                  </tr>
                `;
              });
            });
          }

          let driveFileId: string | null = null;
          try {
            const pdfBlob = await generateDuesPdfBlob(
              '',
              {
                name: selectedClearance.student.name,
                studentId: selectedClearance.student.studentId,
                program: programType,
                department: selectedClearance.department || selectedClearance.student?.department,
                hostel: selectedClearance.presentHostel || selectedClearance.student?.hostel
              },
              duesGroups,
              grandTotal || latestTotalFeeDue
            );
            
            try {
              driveFileId = await uploadToGoogleDrive(pdfBlob, `${selectedClearance.student.studentId}_Official_Dues_Report.pdf`);
              if (driveFileId) {
                await updateDoc(doc(db, 'clearanceRequests', selectedClearance.requestId), { duesPdfFileId: driveFileId });
              }
            } catch (driveErr) {
              console.warn("Google Drive sync optional/skipped:", driveErr);
            }
          } catch (pdfErr) {
            console.error("Failed to generate PDF for email:", pdfErr);
          }

          const baseUrl = 'https://rguktclearance.vercel.app';

          const directDownloadUrl = `${baseUrl}/download-dues?reqId=${selectedClearance.requestId}&studentId=${selectedClearance.student.studentId}`;
          const primaryDownloadUrl = driveFileId ? getDriveDownloadLink(driveFileId) : directDownloadUrl;

          const pdfLinkHtml = `
            <div style="margin-top: 26px; padding: 22px; background-color: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; text-align: center;">
              <div style="display: inline-block; padding: 4px 12px; background-color: #fee2e2; border-radius: 20px; font-size: 11px; font-weight: 700; color: #991b1b; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">
                Official Statement Attached
              </div>
              <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 16px; font-weight: 700;">Official Dues & Penalties Statement (PDF)</h4>
              <p style="margin: 0 0 16px 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                An official university certificate statement has been generated with your itemized penalty particulars, department subtotals, and clearance verification.
              </p>
              <div>
                <a href="${primaryDownloadUrl}" style="display: inline-block; background-color: #991b1b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 10px rgba(153, 27, 27, 0.25);">
                  ⬇ Download Official PDF Statement
                </a>
              </div>
              ${driveFileId ? `
                <div style="margin-top: 10px;">
                  <a href="${getDrivePreviewLink(driveFileId)}" target="_blank" style="color: #2563eb; font-size: 12px; font-weight: 600; text-decoration: underline;">
                    View on Google Drive
                  </a>
                </div>
              ` : `
                <p style="color: #94a3b8; font-size: 11px; margin: 10px 0 0 0;">
                  (Click the button above to download your official PDF statement directly)
                </p>
              `}
            </div>
          `;

          const htmlMessage = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
              <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 24px 20px; text-align: center; color: white;">
                <table width="72" height="72" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px auto; background-color: white; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                  <tr>
                    <td align="center" valign="middle" style="height: 72px;">
                      <img src="https://img.icons8.com/ios-filled/50/dc2626/bill.png" width="36" height="36" style="display: block; border: 0;" alt="Invoice" />
                    </td>
                  </tr>
                </table>
                <h2 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Pending Dues Alert</h2>
              </div>
              <div style="padding: 30px;">
                <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
                  Hello <strong>${selectedClearance.student.name}</strong>,<br><br>
                  Your clearance application has reached the <strong>FO (Accounts) Office</strong>. However, you have pending dues that must be cleared before final approval.
                </p>
                <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                  <h3 style="margin: 0 0 16px 0; color: #991b1b; font-size: 16px;">Dues Breakdown</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px; border-collapse: collapse;">
                    <thead>
                      <tr>
                        <th style="padding: 0 12px 12px 12px; border-bottom: 2px solid #fca5a5; color: #7f1d1d; text-align: left;">Department</th>
                        <th style="padding: 0 12px 12px 12px; border-bottom: 2px solid #fca5a5; color: #7f1d1d; text-align: left;">Reason</th>
                        <th style="padding: 0 12px 12px 12px; border-bottom: 2px solid #fca5a5; color: #7f1d1d; text-align: right;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${duesHtml}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colspan="2" style="padding: 16px 12px 0 12px; color: #334155; font-weight: bold; text-align: right; font-size: 16px;">Grand Total:</td>
                        <td style="padding: 16px 12px 0 12px; color: #ef4444; font-weight: bold; text-align: right; font-size: 18px;">₹${latestTotalFeeDue}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 30px; border-radius: 0 8px 8px 0;">
                  <p style="margin: 0; color: #92400e; font-size: 15px; font-weight: 500;">
                    <strong>Action Required:</strong> Please pay the total fee and upload your payment receipt in the student portal to proceed with your clearance.
                  </p>
                </div>
                <div style="text-align: center;">
                  <a href="https://rguktclearance.vercel.app/" style="display: inline-block; background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2);">Upload Receipt</a>
                </div>
                ${pdfLinkHtml}
              </div>
              <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  RGUKT Clearance Hub &copy; ${new Date().getFullYear()}<br>
                  This is an automated message, please do not reply.
                </p>
              </div>
            </div>
          `;

          await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            {
              to_name: selectedClearance.student.name,
              to_email: selectedClearance.student.email,
              html_message: htmlMessage
            },
            EMAILJS_PUBLIC_KEY
          );
          console.log('Fee due HTML notification email sent to student!');
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
        forwardedTo: nextDeptName,
        updatedAt: new Date().toISOString()
      });
      
      // Wait for animation to finish before updating UI and closing
      setTimeout(() => {
        setSelectedClearance((prev: any) => ({ ...prev, forwarded: true, forwardedTo: nextDeptName }));
        fetchClearances(departmentName);
        setForwardingAnim({ isAnimating: false, nextDept: null, progress: false, completed: false });
        setIsForwarding(false);
      }, 2000);

    } catch (e) {
      console.error(e);
      setForwardingAnim({ isAnimating: false, nextDept: null, progress: false, completed: false });
      setIsForwarding(false);
      alert('Failed to forward the request.');
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen text-on-background font-body-md antialiased">
      
      {/* SideNavBar Component */}
      <aside className="bg-primary-container h-full w-64 fixed left-0 top-0 rounded-r-3xl border-r border-outline-variant/10 shadow-xl flex flex-col py-8 z-50 transition-transform duration-300 hover:scale-[1.03] origin-left">
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
          
          {isHostelWarden && (
            <button 
              onClick={() => setCurrentTab('hostelPenalty')}
              className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${currentTab === 'hostelPenalty' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-l-none rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
            >
              <AlertCircle className="w-5 h-5" />
              Hostel Penalty
            </button>
          )}

          {departmentName === 'DSW' && (
            <button 
              onClick={() => setCurrentTab('dswPenalty')}
              className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${currentTab === 'dswPenalty' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-l-none rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
            >
              <AlertCircle className="w-5 h-5" />
              DSW Penalty
            </button>
          )}

          {isLabDept && (
            <button 
              onClick={() => setCurrentTab('labPenalty')}
              className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${currentTab === 'labPenalty' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-l-none rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
            >
              <AlertCircle className="w-5 h-5" />
              Lab Penalty
            </button>
          )}

          {departmentName === 'Library' && (
            <button 
              onClick={() => setCurrentTab('libraryPenalty')}
              className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${currentTab === 'libraryPenalty' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-l-none rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
            >
              <AlertCircle className="w-5 h-5" />
              Library Penalty
            </button>
          )}

          {departmentName === 'IT Infra' && (
            <button 
              onClick={() => setCurrentTab('itInfraPenalty')}
              className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${currentTab === 'itInfraPenalty' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-l-none rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
            >
              <AlertCircle className="w-5 h-5" />
              IT Infra Penalty
            </button>
          )}

          {isHostelWarden && (
            <button 
              onClick={() => setCurrentTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${currentTab === 'profile' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-l-none rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
            >
              <Settings className="w-5 h-5" />
              Warden Profile
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
                          handleSelectClearance(req);
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
        <main className="flex-1 p-8 max-w-[1440px] mx-auto w-full outline-none" tabIndex={-1}>
          {currentTab === 'profile' ? (
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-variant p-8 max-w-2xl animate-in fade-in zoom-in duration-300">
              <h2 className="font-headline-lg text-2xl font-bold text-primary mb-2">Warden Profile</h2>
              <p className="font-body-md text-on-surface-variant mb-8">Update your display name to appear on student approvals.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-on-surface-variant mb-2">Warden Display Name</label>
                  <input 
                    type="text" 
                    value={wardenName}
                    onChange={(e) => setWardenName(e.target.value)}
                    placeholder="e.g. John Doe - BH1"
                    className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                  />
                </div>
                <button 
                  disabled={isSavingProfile}
                  onClick={async () => {
                    setIsSavingProfile(true);
                    try {
                      const userStr = localStorage.getItem('user');
                      if (userStr) {
                        const user = JSON.parse(userStr);
                        user.wardenName = wardenName;
                        localStorage.setItem('user', JSON.stringify(user));
                        
                        const userRef = doc(db, 'users', user.uid || user.id);
                        await updateDoc(userRef, { wardenName });
                        alert("Profile updated successfully!");
                      }
                    } catch(err) {
                      console.error(err);
                      alert("Failed to update profile.");
                    } finally {
                      setIsSavingProfile(false);
                    }
                  }}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          ) : currentTab === 'labPenalty' ? (
            <HostelPenaltyManager type="lab" departmentName={departmentName} />
          ) : currentTab === 'libraryPenalty' ? (
            <HostelPenaltyManager type="library" />
          ) : currentTab === 'itInfraPenalty' ? (
            <HostelPenaltyManager type="itInfra" />
          ) : currentTab === 'dswPenalty' ? (
            <HostelPenaltyManager type="dsw" />
          ) : currentTab === 'hostelPenalty' ? (
            <HostelPenaltyManager type="hostel" />
          ) : isHostelWarden && !selectedHostelView ? (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="font-headline-lg text-3xl font-bold text-primary">Hostels</h2>
                  <p className="font-body-md text-on-surface-variant mt-1">Select a hostel to view its pending clearance requests.</p>
                </div>
              </div>
              {loading ? (
                <div className="flex flex-col items-center justify-center space-y-3 py-12">
                  <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                  <p className="text-on-surface-variant font-medium animate-pulse">Loading hostels data...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 pb-4 border-none ring-0 focus:outline-none outline-none">
                  {(departmentName === 'Boys Hostel' ? BOYS_HOSTELS : departmentName === 'Girls Hostel' ? GIRLS_HOSTELS : ALL_HOSTELS).map(hostel => {
                    const normalizeHostelName = (name: string) => name?.replace(/\s+/g, '').toLowerCase();
                    const reqCount = clearances.filter(c => normalizeHostelName(c.presentHostel) === normalizeHostelName(hostel)).length;
                    
                    return (
                      <div 
                        key={hostel}
                        onClick={() => setSelectedHostelView(hostel)}
                        className="bg-surface-container-lowest border border-surface-variant rounded-2xl p-6 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
                      >
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <h3 className="font-headline-sm text-lg font-bold text-primary mb-2">{hostel}</h3>
                        <p className="text-on-surface-variant text-sm font-medium">
                          {reqCount} active request{reqCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="font-headline-lg text-3xl font-bold text-primary">
                    {selectedHostelView ? `${selectedHostelView} Requests` : 'Clearance Requests'}
                  </h2>
                  <p className="font-body-md text-on-surface-variant mt-1">Manage and process student clearance requests.</p>
                </div>
                {selectedHostelView && (
                  <button 
                    onClick={() => setSelectedHostelView(null)}
                    className="px-4 py-2 bg-surface-variant text-on-surface-variant rounded-lg font-semibold hover:bg-outline-variant/30 transition-colors"
                  >
                    &larr; Back to Hostels
                  </button>
                )}
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
                ) : (() => {
                  const normalizeHostelName = (name: string) => name?.replace(/\s+/g, '').toLowerCase();
                  const filteredClearances = selectedHostelView ? clearances.filter(c => normalizeHostelName(c.presentHostel) === normalizeHostelName(selectedHostelView)) : clearances;
                  if (filteredClearances.length === 0) {
                    return (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant">
                          No clearance requests found for your department.
                        </td>
                      </tr>
                    );
                  }
                  return filteredClearances.map(c => (
                    <tr key={c.id} className="hover:bg-surface-variant/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-primary">{c.student?.studentId || 'N/A'}</td>
                    <td className="px-6 py-4 font-medium">{formatName(c.student?.name, c.student?.studentId)}</td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {c.programType || c.student?.program} {c.courseType ? `(${c.courseType})` : ''}{c.programType === 'B.Tech' && c.pucCourseType ? ` - ${c.pucCourseType}` : ''}
                    </td>
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
                        onClick={() => handleSelectClearance(c)}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-outline text-primary rounded-lg font-label-sm text-xs font-semibold hover:bg-surface-variant/50 transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" /> Review
                      </button>
                    </td>
                  </tr>
                ));
              })()}
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
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col shadow-2xl border border-surface-variant animate-in fade-in zoom-in-95 duration-200">
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
                  <p className="font-body-md text-on-surface-variant mt-0.5">
                    {selectedClearance.student?.studentId} • {selectedClearance.programType || selectedClearance.student?.program} {selectedClearance.courseType ? `(${selectedClearance.courseType})` : ''}{selectedClearance.programType === 'B.Tech' && selectedClearance.pucCourseType ? ` - ${selectedClearance.pucCourseType}` : ''}
                  </p>
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
              {isHostelWarden && selectedClearance.presentHostel && (
                <div className="flex justify-between pb-3 border-b border-surface-variant/50">
                  <span className="text-on-surface-variant font-label-md">Present Hostel:</span>
                  <span className="font-bold text-primary">{selectedClearance.presentHostel}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-label-md">Current Status:</span>
                <span className="font-bold text-primary">{selectedClearance.status}</span>
              </div>
            </div>

            {selectedClearance.status === 'PENDING' && (
              <div className="space-y-6">
                {/* DSW Maintenance Fee Section */}
                {departmentName === 'DSW' && (
                  <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-headline-sm text-base font-bold text-on-surface mb-0.5">Maintenance Fee</h5>
                        <p className="text-xs text-on-surface-variant">Enter campus/welfare maintenance fee to be added to the student's total clearance fee.</p>
                      </div>
                      {(parseFloat(maintenanceFee) || 0) > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-full border border-blue-300 animate-in fade-in">
                          + ₹{parseFloat(maintenanceFee)} Added
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-sm">₹</span>
                      <input 
                        type="text"
                        inputMode="numeric"
                        min="0"
                        step="any"
                        value={formatInr(maintenanceFee)}
                        onChange={(e) => {
                          const rawVal = parseInr(e.target.value);
                          setMaintenanceFee(rawVal);
                          if (parseFloat(rawVal) > 0) {
                            setActionType('APPROVE');
                          }
                        }}
                        placeholder="Enter maintenance fee amount (e.g. 500)"
                        className="w-full pl-8 pr-4 py-2.5 bg-white border border-outline-variant/50 rounded-xl text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
                      />
                    </div>
                  </div>
                )}

                {['Boys Hostel', 'Girls Hostel', 'DSW', 'Physics Lab', 'Chemistry Lab', 'Biology Lab', 'Library', 'IT Infra', 'FO'].includes(departmentName) && (
                  <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col gap-4">
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-headline-sm text-base font-bold text-on-surface mb-0.5">Outstanding Dues Check</h5>
                        <p className="text-xs text-on-surface-variant">
                          {departmentName === 'FO'
                            ? 'Search and audit all outstanding dues across all campus departments for this student.'
                            : 'Search the database to see if this student has any pending maintenance fees.'}
                        </p>
                      </div>
                      <button
                        onClick={handleFetchMaintenanceFee}
                        disabled={isFetchingFee || fetchedFee !== null}
                        className={`whitespace-nowrap shrink-0 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 ${
                          fetchedFee !== null
                            ? 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200'
                            : 'bg-primary text-on-primary hover:bg-primary/90'
                        }`}
                      >
                        {isFetchingFee ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Checking...
                          </>
                        ) : fetchedFee !== null ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            Checked
                          </>
                        ) : (
                          'Check Dues'
                        )}
                      </button>
                    </div>
                    
                    {fetchedFee !== null && (
                      <div className={`p-5 rounded-xl border flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-500 transition-colors ${fetchedFee > 0 ? (isDuesAdded ? 'bg-green-50/50 border-green-200' : 'bg-error-container/30 border-error-container/50') : 'bg-green-50/70 border-green-200'}`}>
                        <div className="flex-1">
                          <span className={`text-xs font-bold uppercase tracking-wider mb-2 block transition-colors ${fetchedFee > 0 ? (isDuesAdded ? 'text-green-700' : 'text-error') : 'text-green-700'}`}>
                            {isDuesAdded ? 'Dues Added' : (departmentName === 'FO' ? 'All Departments Dues Audit' : 'Search Result')}
                          </span>
                          
                          {/* FO View: All Dues from ALL Departments */}
                          {departmentName === 'FO' && fetchedAllDeptDues && fetchedAllDeptDues.length > 0 ? (
                            <div className="space-y-3 mb-3">
                              {fetchedAllDeptDues.map((g, gIdx) => (
                                <div key={gIdx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                                  <div className="bg-slate-100/80 px-3.5 py-2 flex justify-between items-center border-b border-slate-200">
                                    <span className="font-bold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                      <Building2 className="w-3.5 h-3.5 text-primary" />
                                      {g.department}
                                    </span>
                                    <span className="font-bold text-xs text-slate-900">Subtotal: ₹{g.subtotal.toLocaleString('en-IN')}</span>
                                  </div>
                                  <div className="p-2 space-y-1.5">
                                    {g.items.map((item, iIdx) => (
                                      <div key={iIdx} className="flex justify-between items-center text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
                                        <span className="text-slate-700 font-medium">{item.reason}</span>
                                        <span className="font-bold text-red-600">₹{item.amount.toLocaleString('en-IN')}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}

                              {/* Grand Total Bar & Actions - Compact Single Line */}
                              <div className={`flex items-center justify-between gap-3 px-3.5 py-2 border mt-2 rounded-xl shadow-xs transition-colors ${isDuesAdded ? 'border-green-300 bg-green-100/60' : 'border-error-container bg-error-container/40'}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`font-bold text-xs sm:text-sm whitespace-nowrap ${isDuesAdded ? 'text-green-900' : 'text-on-error-container'}`}>
                                    Total Dues:
                                  </span>
                                  <span className={`font-extrabold text-sm sm:text-base whitespace-nowrap transition-colors ${isDuesAdded ? 'text-green-700' : 'text-error'}`}>
                                    ₹{fetchedFee.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/70 border border-slate-200 text-slate-600 whitespace-nowrap hidden sm:inline">
                                    All Depts
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={handleDownloadFoDuesPdf}
                                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                                    title="Download Official Statement PDF"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                    <span className="whitespace-nowrap">Statement PDF</span>
                                  </button>
                                  <button
                                    type="button"
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
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0 ${
                                      isDuesAdded 
                                        ? 'bg-green-600 text-white shadow-green-600/20' 
                                        : isAddingDues 
                                        ? 'bg-error/70 text-on-error cursor-wait' 
                                        : 'bg-error hover:bg-red-700 text-on-error'
                                    }`}
                                  >
                                    {isDuesAdded ? (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5 animate-in zoom-in shrink-0" />
                                        <span>Added</span>
                                      </>
                                    ) : isAddingDues ? (
                                      <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0"></div>
                                        <span>Adding...</span>
                                      </>
                                    ) : (
                                      <span>Add Total</span>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (isHostelWarden || departmentName === 'DSW' || isLabDept || departmentName === 'Library' || departmentName === 'IT Infra') && fetchedPenalties && fetchedPenalties.length > 0 ? (
                            <div className="space-y-1.5 mb-3">
                              {fetchedPenalties.map((p, idx) => (
                                <div key={p.id || idx} className={`flex justify-between items-center text-xs px-2.5 py-1.5 rounded-lg border shadow-sm transition-colors ${isDuesAdded ? 'bg-green-100/50 border-green-200/50' : 'bg-surface-container-lowest/80 border-outline-variant/20'}`}>
                                  <span className={isDuesAdded ? 'text-green-900 font-medium' : 'text-on-surface font-medium'}>{p.reason}</span>
                                  <span className={`font-bold transition-colors ${isDuesAdded ? 'text-green-700' : 'text-error'}`}>₹{p.amount}</span>
                                </div>
                              ))}
                              <div className={`flex justify-between items-center px-3 py-2 border mt-1.5 rounded-xl shadow-sm transition-colors ${isDuesAdded ? 'border-green-300 bg-green-200/50' : 'border-error-container bg-error-container/50'}`}>
                                <span className={`font-bold text-sm ${isDuesAdded ? 'text-green-900' : 'text-on-error-container'}`}>Total Dues:</span>
                                <div className="flex items-center gap-3">
                                  <span className={`font-bold text-base transition-colors ${isDuesAdded ? 'text-green-700' : 'text-error'}`}>₹{fetchedFee}</span>
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
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-500 shadow-sm flex items-center gap-1.5 ${isDuesAdded ? 'bg-green-600 text-white' : isAddingDues ? 'bg-error/70 text-on-error cursor-wait' : 'bg-error hover:bg-red-700 text-on-error'}`}
                                  >
                                    {isDuesAdded ? <><CheckCircle2 className="w-3.5 h-3.5 animate-in zoom-in" /> Added</> : isAddingDues ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Adding...</> : 'Add All'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : fetchedFee > 0 ? (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div>
                                <span className={`font-headline-sm text-xl font-bold transition-colors ${isDuesAdded ? 'text-green-800' : 'text-on-error-container'}`}>
                                  ₹{fetchedFee} Pending Dues
                                </span>
                                <p className="text-xs text-on-surface-variant mt-0.5">Found outstanding maintenance dues for this student.</p>
                              </div>
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
                                className={`px-4 py-2 rounded-lg font-label-sm font-bold transition-all duration-500 shadow-sm flex items-center gap-2 self-start sm:self-auto ${isDuesAdded ? 'bg-green-600 text-white' : isAddingDues ? 'bg-error/70 text-on-error cursor-wait' : 'bg-error hover:bg-red-700 text-on-error'}`}
                              >
                                {isDuesAdded ? <><CheckCircle2 className="w-4 h-4 animate-in zoom-in" /> Added</> : isAddingDues ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Adding...</> : 'Add Due'}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 py-1">
                              <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                              <div>
                                <span className="font-headline-sm text-lg font-bold text-green-800 block">
                                  {departmentName === 'FO' ? 'No Dues Across Any Department' : 'No Dues Available'}
                                </span>
                                <span className="text-xs text-green-700">
                                  {departmentName === 'FO' ? 'Student has no pending dues or penalties across Hostel, Labs, Library, IT Infra, DSW, or Scholarship.' : 'Student has no pending dues or penalties.'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Scholarship Office - Update Scholarship / Due Section */}
                {departmentName === 'Scholarship Office' && (
                  <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
                          <Award className="w-5 h-5" />
                        </div>
                        <h5 className="font-headline-sm text-base font-bold text-on-surface">Update Scholarship / Due</h5>
                      </div>

                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        scholarshipProgramType === 'B.Tech' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {scholarshipProgramType === 'B.Tech' ? 'Course: B.Tech' : 'Course: PUC'}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {/* Section 1: PUC Academic Years */}
                      <div className="space-y-3">
                        {scholarshipProgramType === 'B.Tech' && (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                              Part 1: PUC Academic Years (₹45,000 / Year)
                            </span>
                          </div>
                        )}
                        {activeScholarshipYears.filter(y => y.category === 'PUC').map((yr) => {
                          const rec = scholarshipRecords[yr.id] || { credited: '', due: '' };
                          const dueNum = parseFloat(rec.due) || 0;
                          const isEntered = rec.credited !== '' || rec.due !== '';

                          return (
                            <div
                              key={yr.id}
                              className={`p-3 rounded-xl border transition-all flex flex-wrap lg:flex-nowrap items-center gap-3 lg:gap-4 overflow-hidden ${
                                dueNum > 0
                                  ? 'bg-amber-50/40 border-amber-200 shadow-xs'
                                  : isEntered
                                  ? 'bg-green-50/40 border-green-200'
                                  : 'bg-surface-container-lowest border-outline-variant/30 hover:border-primary/30'
                              }`}
                            >
                              {/* Left: Title & Grant */}
                              <div className="flex items-center gap-3 w-full lg:w-auto lg:shrink-0">
                                <span className="font-bold text-sm text-primary w-28 shrink-0 truncate">{yr.name}</span>
                                <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 whitespace-nowrap">
                                  ₹{yr.totalGrant.toLocaleString()}
                                </span>
                              </div>

                              {/* Middle: Inputs */}
                              <div className="flex items-center gap-2 w-full lg:flex-1 lg:justify-end">
                                <div className="relative flex-1 lg:flex-none lg:w-36">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-[11px]">₹</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    min="0"
                                    max={yr.totalGrant}
                                    step="any"
                                    value={formatInr(rec.credited)}
                                    onChange={(e) => handleScholarshipCreditedChange(yr.id, parseInr(e.target.value))}
                                    placeholder="Credited"
                                    title="Credited Amount"
                                    className="w-full pl-6 pr-2 py-1.5 bg-white border border-outline-variant/50 rounded-md text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-xs transition-all"
                                  />
                                </div>
                                <span className="text-on-surface-variant text-xs font-bold shrink-0">-</span>
                                <div className="relative flex-1 lg:flex-none lg:w-36">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-[11px]">₹</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    min="0"
                                    max={yr.totalGrant}
                                    step="any"
                                    value={formatInr(rec.due)}
                                    onChange={(e) => handleScholarshipDueChange(yr.id, parseInr(e.target.value))}
                                    placeholder="Due (Auto)"
                                    title="Due Amount"
                                    className={`w-full pl-6 pr-2 py-1.5 bg-white border rounded-md text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs transition-all ${
                                      dueNum > 0
                                        ? 'border-red-300 text-red-600 bg-red-50/20 focus:border-red-500'
                                        : isEntered
                                        ? 'border-green-300 text-green-700 bg-green-50/20 focus:border-green-500'
                                        : 'border-outline-variant/50 text-on-surface focus:border-primary'
                                    }`}
                                  />
                                </div>
                              </div>

                              {/* Right: Status Badge */}
                              <div className="w-full lg:w-20 flex justify-end shrink-0">
                                {isEntered ? (
                                  dueNum > 0 ? (
                                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                                      <AlertCircle className="w-3 h-3" /> Due
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                                      <CheckCircle2 className="w-3 h-3" /> Nil Due
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[11px] text-on-surface-variant font-medium whitespace-nowrap">Pending</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Section 2: B.Tech Academic Years */}
                      {scholarshipProgramType === 'B.Tech' && (
                        <div className="space-y-3 pt-5 border-t border-outline-variant/30 mt-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-purple-800 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                              Part 2: B.Tech Academic Years (₹50,000 / Year)
                            </span>
                          </div>
                          {activeScholarshipYears.filter(y => y.category === 'B.Tech').map((yr) => {
                            const rec = scholarshipRecords[yr.id] || { credited: '', due: '' };
                            const dueNum = parseFloat(rec.due) || 0;
                            const isEntered = rec.credited !== '' || rec.due !== '';

                            return (
                              <div
                                key={yr.id}
                                className={`p-3 rounded-xl border transition-all flex flex-wrap lg:flex-nowrap items-center gap-3 lg:gap-4 overflow-hidden ${
                                  dueNum > 0
                                    ? 'bg-amber-50/40 border-amber-200 shadow-xs'
                                    : isEntered
                                    ? 'bg-green-50/40 border-green-200'
                                    : 'bg-surface-container-lowest border-outline-variant/30 hover:border-primary/30'
                                }`}
                              >
                                {/* Left: Title & Grant */}
                                <div className="flex items-center gap-3 w-full lg:w-auto lg:shrink-0">
                                  <span className="font-bold text-sm text-primary w-28 shrink-0 truncate">{yr.name}</span>
                                  <span className="text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 whitespace-nowrap">
                                    ₹{yr.totalGrant.toLocaleString()}
                                  </span>
                                </div>

                                {/* Middle: Inputs */}
                                <div className="flex items-center gap-2 w-full lg:flex-1 lg:justify-end">
                                  <div className="relative flex-1 lg:flex-none lg:w-36">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-[11px]">₹</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      min="0"
                                      max={yr.totalGrant}
                                      step="any"
                                      value={formatInr(rec.credited)}
                                      onChange={(e) => handleScholarshipCreditedChange(yr.id, parseInr(e.target.value))}
                                      placeholder="Credited"
                                      title="Credited Amount"
                                      className="w-full pl-6 pr-2 py-1.5 bg-white border border-outline-variant/50 rounded-md text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-xs transition-all"
                                    />
                                  </div>
                                  <span className="text-on-surface-variant text-xs font-bold shrink-0">-</span>
                                  <div className="relative flex-1 lg:flex-none lg:w-36">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-[11px]">₹</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      min="0"
                                      max={yr.totalGrant}
                                      step="any"
                                      value={formatInr(rec.due)}
                                      onChange={(e) => handleScholarshipDueChange(yr.id, parseInr(e.target.value))}
                                      placeholder="Due (Auto)"
                                      title="Due Amount"
                                      className={`w-full pl-6 pr-2 py-1.5 bg-white border rounded-md text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs transition-all ${
                                        dueNum > 0
                                          ? 'border-red-300 text-red-600 bg-red-50/20 focus:border-red-500'
                                          : isEntered
                                          ? 'border-green-300 text-green-700 bg-green-50/20 focus:border-green-500'
                                          : 'border-outline-variant/50 text-on-surface focus:border-primary'
                                      }`}
                                    />
                                  </div>
                                </div>

                                {/* Right: Status Badge */}
                                <div className="w-full lg:w-20 flex justify-end shrink-0">
                                  {isEntered ? (
                                    dueNum > 0 ? (
                                      <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                                        <AlertCircle className="w-3 h-3" /> Due
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                                        <CheckCircle2 className="w-3 h-3" /> Nil Due
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[11px] text-on-surface-variant font-medium whitespace-nowrap">Pending</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Summary Footer */}
                    <div className="bg-surface-variant/20 p-4 rounded-xl border border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-on-surface-variant">Total Scholarship Grant:</span>
                          <span className="text-xs font-bold text-on-surface">₹{totalScholarshipEntitled.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-on-surface-variant">Total Credited:</span>
                          <span className="text-xs font-bold text-green-700">₹{totalScholarshipCredited.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant block">Total Due Amount</span>
                          <span className={`text-xl font-extrabold ${totalScholarshipDue > 0 ? 'text-red-600' : 'text-green-700'}`}>
                            ₹{totalScholarshipDue.toLocaleString()}
                          </span>
                        </div>
                        {totalScholarshipDue > 0 ? (
                          <span className="text-[11px] bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-lg border border-red-200">
                            Dues Billed to FO
                          </span>
                        ) : (
                          <span className="text-[11px] bg-green-100 text-green-800 font-bold px-2.5 py-1 rounded-lg border border-green-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> No Dues
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* DSW Grand Total Section */}
                {departmentName === 'DSW' && ((parseFloat(maintenanceFee) || 0) > 0 || (isDuesAdded && (fetchedFee || 0) > 0)) && (
                  <div className="bg-blue-50/50 p-3.5 rounded-2xl border border-blue-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
                    <div>
                      <h5 className="font-headline-sm text-base font-bold text-blue-900 mb-0.5">Grand Total</h5>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-blue-800">
                        {(parseFloat(maintenanceFee) || 0) > 0 && (
                          <span className="bg-blue-100/50 px-2 py-0.5 rounded-md">Maintenance Fee: <strong>₹{parseFloat(maintenanceFee) || 0}</strong></span>
                        )}
                        {(parseFloat(maintenanceFee) || 0) > 0 && isDuesAdded && (fetchedFee || 0) > 0 && <span className="font-bold text-blue-400">+</span>}
                        {isDuesAdded && (fetchedFee || 0) > 0 && (
                          <span className="bg-blue-100/50 px-2 py-0.5 rounded-md">Dues: <strong>₹{fetchedFee}</strong></span>
                        )}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-blue-700 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-blue-100">
                      ₹{(parseFloat(maintenanceFee) || 0) + (isDuesAdded ? (fetchedFee || 0) : 0)}
                    </div>
                  </div>
                )}
                
                {/* COE Academic Status Check */}
                {departmentName === 'COE' && (
                  <div className="space-y-3">
                    {!coeAcademicCheck ? (
                      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                            <GraduationCap className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="font-headline-sm text-base font-bold text-on-surface whitespace-nowrap">Academic Status Check</h5>
                            <p className="text-xs text-on-surface-variant truncate">Verify student's semester exams for pass / remedial status.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={openAcademicModal}
                          className="whitespace-nowrap shrink-0 px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]"
                        >
                          <ClipboardList className="w-4 h-4" /> Check Academic Status
                        </button>
                      </div>
                    ) : coeAcademicCheck.hasRemedial ? (
                      <div className="bg-red-50/90 p-5 rounded-2xl border border-red-300 shadow-sm space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                              <AlertCircle className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                <span className="font-headline-sm text-base font-bold text-red-900 whitespace-nowrap">Academic Status: Remedial Pending</span>
                                <span className="text-[10px] bg-red-200 text-red-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap shrink-0">Process Stopped</span>
                              </div>
                              <p className="text-xs text-red-700 mt-0.5 truncate">Student has pending backlogs. Clearance cannot be approved.</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={openAcademicModal}
                            className="whitespace-nowrap shrink-0 px-3.5 py-1.5 text-xs font-bold text-red-800 bg-white hover:bg-red-100 border border-red-300 rounded-lg transition-colors shadow-sm"
                          >
                            Edit / Re-check
                          </button>
                        </div>
                        
                        <div className="bg-white/90 p-3.5 rounded-xl border border-red-200">
                          <span className="text-xs font-bold text-red-800 block mb-2">Pending Remedial Semester(s):</span>
                          <div className="flex flex-wrap gap-2">
                            {coeAcademicCheck.remedialSemesters.map((sem, idx) => (
                              <span key={idx} className="bg-red-100 text-red-800 border border-red-300 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span> {sem}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-green-50/80 p-5 rounded-2xl border border-green-300 shadow-sm flex items-center justify-between gap-4 animate-in fade-in">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                              <span className="font-headline-sm text-base font-bold text-green-900 whitespace-nowrap">Academic Status: Cleared</span>
                              <span className="text-[10px] bg-green-200 text-green-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap shrink-0">All Passed</span>
                            </div>
                            <p className="text-xs text-green-700 mt-0.5 truncate">All semester examinations verified successfully with no active remedials.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={openAcademicModal}
                          className="whitespace-nowrap shrink-0 px-3.5 py-1.5 text-xs font-bold text-green-800 bg-white hover:bg-green-100 border border-green-300 rounded-lg transition-colors shadow-sm"
                        >
                          Edit / Re-check
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  {/* Payment Reference ID for FO if student has dues */}
                  {departmentName === 'FO' && isDuesAdded && Number(feeAmount) > 0 && (
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm">
                      <h5 className="font-bold text-amber-800 mb-1">Total Student Dues: ₹{feeAmount}</h5>
                      <p className="text-xs text-amber-700 mb-3">The student must pay this accumulated amount before clearance is granted.</p>
                      {selectedClearance.feeReceiptUrl && (
                        <div className="mb-4">
                          <a 
                            href={selectedClearance.feeReceiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 hover:bg-blue-200 px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-blue-300"
                          >
                            <FileText className="w-4 h-4" /> View Uploaded Receipt
                          </a>
                        </div>
                      )}
                      <label className="block font-label-md text-amber-900 mb-2 font-bold text-sm">Payment Reference ID <span className="text-red-500">*</span></label>
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

                  {/* Remarks Section - below dues and above approve button */}
                  <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3">
                    <label className="block font-label-md text-on-surface font-bold flex items-center justify-between">
                      <span>Remarks / Notes</span>
                      <span className="text-xs font-normal text-on-surface-variant">Optional for approval, required for rejection</span>
                    </label>
                    <textarea 
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      placeholder="Enter remarks or approval notes (optional)..."
                      className="w-full border border-outline-variant/50 rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white shadow-sm transition-all"
                      rows={3}
                    ></textarea>
                  </div>
                </div>

                {/* Reject & Approve Buttons - below Remarks */}
                <div className="flex gap-4">
                  <button 
                    disabled={isConfirming || isConfirmed}
                    onClick={() => handleAction('REJECT')} 
                    className={`flex-1 text-white py-3.5 rounded-xl font-label-md font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-sm ${
                      isConfirmed && actionType === 'REJECT' ? 'bg-red-500' : 'bg-red-600 hover:bg-red-700'
                    } ${departmentName === 'COE' && coeAcademicCheck?.hasRemedial ? 'ring-4 ring-red-200 animate-pulse' : ''} disabled:opacity-80`}
                  >
                    {isConfirmed && actionType === 'REJECT' ? (
                      <><AlertCircle className="w-5 h-5 animate-in zoom-in" /> Rejected!</>
                    ) : isConfirming && actionType === 'REJECT' ? (
                      <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Rejecting...</>
                    ) : (
                      <><AlertCircle className="w-5 h-5" /> Reject</>
                    )}
                  </button>
                  <button 
                    disabled={
                      isConfirming || 
                      isConfirmed || 
                      (departmentName === 'COE' && coeAcademicCheck?.hasRemedial) ||
                      (departmentName === 'FO' && isDuesAdded && Number(feeAmount) > 0 && !referenceId.trim())
                    }
                    onClick={() => {
                      if (departmentName === 'COE') {
                        if (!coeAcademicCheck) {
                          alert("Please check academic status before approving.");
                          openAcademicModal();
                          return;
                        }
                        if (coeAcademicCheck.hasRemedial) {
                          alert("Cannot approve: Student has pending remedial exams. Process must be rejected.");
                          return;
                        }
                      }
                      const displayDueAmount = isDuesAdded ? Number(feeAmount) : 0;
                      if (departmentName === 'FO' && displayDueAmount > 0 && !referenceId.trim()) {
                        alert("Please enter the Payment Reference ID to approve this request.");
                        return;
                      }
                      setShowConfirmPopup(true);
                    }} 
                    className={`flex-1 text-white py-3.5 rounded-xl font-label-md font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-sm ${
                      (departmentName === 'COE' && coeAcademicCheck?.hasRemedial) || (departmentName === 'FO' && isDuesAdded && Number(feeAmount) > 0 && !referenceId.trim())
                        ? 'bg-gray-400 cursor-not-allowed opacity-60'
                        : isConfirmed && actionType === 'APPROVE' ? 'bg-green-500' : 'bg-green-600 hover:bg-green-700'
                    } disabled:opacity-80`}
                  >
                    {isConfirmed && actionType === 'APPROVE' ? (
                      <><CheckCircle2 className="w-5 h-5 animate-in zoom-in" /> Approved!</>
                    ) : isConfirming && actionType === 'APPROVE' ? (
                      <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Approving...</>
                    ) : (
                      <><CheckCircle2 className="w-5 h-5" /> Approve</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {selectedClearance.status === 'APPROVED' && (
              <div className="mt-2">
                {(() => {
                  const currentSequence = getDepartmentSequence(
                    selectedClearance.programType || selectedClearance.student?.program,
                    selectedClearance.pucCourseType,
                    selectedClearance.courseType
                  );
                  const seqDeptName = (departmentName === 'Boys Hostel' || departmentName === 'Girls Hostel') ? 'Hostel' : departmentName;
                  const currentIndex = currentSequence.indexOf(seqDeptName);
                  const nextDeptName = currentIndex >= 0 && currentIndex < currentSequence.length - 1 ? currentSequence[currentIndex + 1] : null;
                  if (nextDeptName) {
                    const isMpc = selectedClearance.pucCourseType === 'MPC' || 
                      ((selectedClearance.programType || selectedClearance.student?.program) !== 'B.Tech' && selectedClearance.courseType === 'MPC');
                    const isAlreadyMoved = selectedClearance.forwarded && (
                      selectedClearance.forwardedTo 
                        ? selectedClearance.forwardedTo === nextDeptName 
                        : !(departmentName === 'Chemistry Lab' && isMpc && nextDeptName === 'COE')
                    );
                    if (isAlreadyMoved) {
                      return (
                        <div className="w-full bg-blue-50 text-blue-700 py-3 rounded-xl font-label-md font-semibold flex items-center justify-center gap-2 border border-blue-200">
                          <CheckCircle2 className="w-5 h-5" /> Moved to {nextDeptName}
                        </div>
                      );
                    }
                    return (
                      <button 
                        onClick={handleForward}
                        disabled={isForwarding}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-label-md font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-80"
                      >
                        {isForwarding ? (
                          <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Moving...</>
                        ) : (
                          `Move to next department (${nextDeptName})`
                        )}
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

            <button 
              onClick={() => {
                setSelectedClearance(null);
                setActionType(null);
                setRemarks('');
                setFeeAmount('');
                setMaintenanceFee('');
                setReferenceId('');
                setFetchedFee(null);
                setFetchedPenalties(null);
                setIsDuesAdded(false);
                setIsAddingDues(false);
                setCoeAcademicCheck(null);
                setShowAcademicModal(false);
              }} 
              className="mt-6 w-full border border-outline-variant text-on-surface-variant py-3 rounded-xl font-label-md font-semibold hover:bg-surface-variant/50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* COE Academic Status Verification Modal */}
      {showAcademicModal && selectedClearance && (
        <div className="fixed inset-0 bg-primary/50 backdrop-blur-sm flex items-center justify-center p-4 z-[250]">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl sm:max-w-3xl w-full shadow-2xl border border-outline-variant/30 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b border-surface-variant shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shadow-inner">
                  <GraduationCap className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-headline-md text-xl font-bold text-primary">Academic Status Check</h3>
                  <p className="text-xs text-on-surface-variant">
                    {selectedClearance.student?.name} • ID: {selectedClearance.student?.studentId}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAcademicModal(false)}
                className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded-lg hover:bg-surface-variant/50"
              >
                ✕
              </button>
            </div>

            {/* Program Type Indicator & Quick Actions */}
            <div className="py-4 border-b border-surface-variant/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface-variant">Student Program:</span>
                <span className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-sm flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4" />
                  {academicProgramType === 'B.Tech' ? 'B.Tech (12 Semesters: PUC & 4-Year B.Tech)' : 'PUC (4 Semesters: PUC-1 & PUC-2)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkAllPass}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark All Pass
                </button>
              </div>
            </div>

            {/* Semesters List */}
            <div className="overflow-y-auto py-4 space-y-5 flex-1 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {(academicProgramType === 'B.Tech' ? BTECH_SEMESTERS : PUC_SEMESTERS).map((group, gIdx) => (
                <div key={gIdx} className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-primary flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      {group.group}
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {group.sems.map(sem => {
                      const isPass = academicFormRecords[sem] === 'PASS';
                      const isRemedial = academicFormRecords[sem] === 'REMEDIAL';

                      return (
                        <div 
                          key={sem} 
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                            isRemedial ? 'bg-red-50/60 border-red-200' : isPass ? 'bg-green-50/40 border-green-200' : 'bg-white border-outline-variant/30'
                          }`}
                        >
                          <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                            {sem}
                          </span>

                          <div className="inline-flex rounded-lg border border-outline-variant/30 p-0.5 bg-white shrink-0 shadow-xs">
                            <button
                              type="button"
                              onClick={() => handleSemesterStatusChange(sem, 'PASS')}
                              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                                isPass 
                                  ? 'bg-green-600 text-white shadow-xs' 
                                  : 'text-on-surface-variant hover:text-green-700'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" /> Pass
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSemesterStatusChange(sem, 'REMEDIAL')}
                              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                                isRemedial 
                                  ? 'bg-red-600 text-white shadow-xs' 
                                  : 'text-on-surface-variant hover:text-red-700'
                              }`}
                            >
                              <AlertCircle className="w-3 h-3" /> Remedial
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer / Status Summary */}
            {(() => {
              const sems = academicProgramType === 'B.Tech' ? BTECH_SEMESTERS : PUC_SEMESTERS;
              const allSemNames: string[] = [];
              sems.forEach(g => g.sems.forEach(s => allSemNames.push(s)));
              const remedials = allSemNames.filter(s => academicFormRecords[s] === 'REMEDIAL');
              const hasRemedial = remedials.length > 0;

              return (
                <div className="pt-4 border-t border-surface-variant shrink-0 space-y-3">
                  {hasRemedial ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-800">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span><strong>{remedials.length} Remedial(s) detected:</strong> Process must be stopped & rejected.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-xs text-green-800">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span><strong>All Semesters Passed:</strong> Student is eligible for academic clearance.</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAcademicModal(false)}
                      className="flex-1 border border-outline-variant py-2.5 rounded-xl font-label-md font-semibold text-on-surface-variant hover:bg-surface-variant/50 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAcademicStatus}
                      className={`flex-1 py-2.5 rounded-xl font-label-md font-semibold text-white transition-all text-sm shadow-sm flex items-center justify-center gap-2 ${
                        hasRemedial ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {hasRemedial ? (
                        <><AlertCircle className="w-4 h-4" /> Confirm Remedials (Stop & Reject)</>
                      ) : (
                        <><CheckCircle2 className="w-4 h-4" /> Save Academic Clearance</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Confirm Approve Modal */}
      {showConfirmPopup && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
          <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-surface-variant animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-headline-md text-xl font-bold text-primary mb-2">Confirm Approval</h3>
            <p className="font-body-md text-on-surface-variant mb-6">Are you sure you want to approve this clearance request?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirmPopup(false)}
                className="flex-1 py-2.5 rounded-xl font-label-md font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowConfirmPopup(false);
                  handleAction('APPROVE');
                }}
                className="flex-1 py-2.5 rounded-xl font-label-md font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                Confirm
              </button>
            </div>
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
                <div className="w-20 h-20 bg-green-50 rounded-2xl border border-green-200 flex items-center justify-center shadow-inner relative">
                  {(() => {
                    const CurrentIcon = getDepartmentIcon(departmentName);
                    return <CurrentIcon className="w-10 h-10 text-green-600" />;
                  })()}
                  <div className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-md">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <span className="font-bold text-sm text-center max-w-[120px] text-green-800">{departmentName}</span>
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
                <div className={`w-20 h-20 rounded-2xl border flex items-center justify-center shadow-inner transition-colors duration-500 delay-1000 relative ${forwardingAnim.progress ? 'bg-orange-100 border-orange-300' : 'bg-orange-50 border-orange-200'}`}>
                  {(() => {
                    const NextIcon = getDepartmentIcon(forwardingAnim.nextDept);
                    return <NextIcon className={`w-10 h-10 transition-colors duration-500 delay-1000 ${forwardingAnim.progress ? 'text-orange-700' : 'text-orange-600'}`} />;
                  })()}
                  
                  {/* Pending Badge */}
                  <div className={`absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-md transition-all duration-500 ease-out delay-[1300ms] ${forwardingAnim.progress ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                    <Clock className="w-6 h-6 text-orange-600 animate-pulse" />
                  </div>
                </div>
                <span className={`font-bold text-sm text-center max-w-[120px] transition-colors duration-500 delay-1000 ${forwardingAnim.progress ? 'text-orange-800' : 'text-orange-700'}`}>{forwardingAnim.nextDept}</span>
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
