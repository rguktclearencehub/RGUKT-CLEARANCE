import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, getDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { LogOut, Search, ShieldAlert, CheckCircle, Clock, AlertTriangle, RefreshCcw, UserCheck, ShieldCheck, LayoutDashboard, Settings, Book, Building, Dumbbell, Briefcase, FlaskConical, Microscope, Monitor, Award, UserCog, CheckSquare, XSquare, X, CheckCircle2, AlertCircle, Lock, Mail, FileText, Download } from 'lucide-react';
import Bubbles from '../components/Bubbles';
import emailjs from '@emailjs/browser';
import {
  generateDuesPdfBlob,
  generateNDCPdfBlob,
  downloadPdfDirectly,
  fetchDetailedStudentDues,
  uploadToGoogleDrive,
  uploadNdcToDrive,
  getDriveDownloadLink,
  getDrivePreviewLink,
  convertDriveShareableToDownloadUrl
} from '../utils/pdfGenerator';

const EMAILJS_SERVICE_ID = 'service_yato66e';
const EMAILJS_TEMPLATE_ID = 'template_zdq3aos';
const EMAILJS_PUBLIC_KEY = 'uX0TI21Zg8bha0FM0';

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

const getDepartmentSequence = (request: any) => {
  const isBTech = request?.programType === 'B.Tech';
  let base = isBTech ? BTECH_DEPARTMENTS : PUC_DEPARTMENTS;
  if (isBTech) {
    base = base.map(dept => {
      if (dept === 'HOD') return `HOD ${request?.courseType || ''}`.trim();
      if (dept === 'Engg Labs') return `Lab Technician ${request?.courseType || ''}`.trim();
      return dept;
    });
  }
  const isMpc = request?.pucCourseType === 'MPC' || (!isBTech && request?.courseType === 'MPC');
  return base.filter(d => !(isMpc && d === 'Biology Lab'));
};

const MOCK_SUBMISSION_TEMPLATE = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 0; border: 1px solid #dcfce7; border-radius: 12px; background-color: #ffffff; overflow: hidden; box-shadow: 0 4px 15px rgba(22, 163, 74, 0.1);">
    <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 24px 20px; text-align: center; color: white;">
      <table width="72" height="72" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px auto; background-color: white; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
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
        Hello <strong>John Doe</strong>,<br><br>
        Great news! Your clearance application has been successfully initiated and is now in the system.
      </p>
      
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;"><strong>Student Name:</strong> John Doe</p>
        <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;"><strong>Student ID:</strong> R240001</p>
        <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;"><strong>Email:</strong> john@example.com</p>
        <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;"><strong>Program:</strong> B.Tech</p>
        <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;"><strong>Submitted On:</strong> ${new Date().toLocaleString()}</p>
        <p style="margin: 0; color: #334155; font-size: 14px;"><strong>Current Status:</strong> <span style="background-color: #dcfce7; padding: 2px 8px; border-radius: 12px; font-weight: 600; color: #16a34a;">Pending at Hostel</span></p>
      </div>
      
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 8px 0; color: #475569; font-size: 14px; font-weight: 600;">Your Clearance Path:</p>
        <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; padding: 12px; background-color: #f8fafc; border-radius: 6px;">
          Hostel &rarr; Sports &rarr; Physics Lab &rarr; Chemistry Lab &rarr; Biology Lab &rarr; COE &rarr; HOD &rarr; Library &rarr; IT Infra &rarr; Scholarship Office &rarr; FO &rarr; AO &rarr; Director &rarr; Dean of Academics
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="https://rguktclearance.vercel.app/student/dashboard" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(22, 163, 74, 0.2);">Track Application Status</a>
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

const MOCK_FO_DUES_TEMPLATE = `
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
        Hello <strong>John Doe</strong>,<br><br>
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
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #334155;"><strong>Hostel</strong></td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Damaged Cot</td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #ef4444; font-weight: 600; text-align: right;">₹500</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #334155;"><strong>Library</strong></td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Unreturned Book (Physics Vol. 1)</td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #ef4444; font-weight: 600; text-align: right;">₹250</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding: 16px 12px 0 12px; color: #334155; font-weight: bold; text-align: right; font-size: 16px;">Grand Total:</td>
              <td style="padding: 16px 12px 0 12px; color: #ef4444; font-weight: bold; text-align: right; font-size: 18px;">₹750</td>
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
        <a href="https://rguktclearance.vercel.app/student/dashboard" style="display: inline-block; background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2);">Upload Receipt</a>
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

const MOCK_COMPLETION_TEMPLATE = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #16a34a, #15803d); padding: 30px 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Clearance Application Completed!</h1>
    </div>
    <div style="padding: 30px; background-color: white;">
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Dear <strong>Sriram Yaddanapudi</strong>,</p>
      <p style="color: #334155; font-size: 16px; margin-bottom: 25px; line-height: 1.6;">
        Congratulations! Your clearance application has been fully approved by all departments. You are now officially cleared.
      </p>
      
      <div style="margin-top: 30px; padding: 22px; background-color: #f0fdf4; border: 1.5px dashed #86efac; border-radius: 12px; text-align: center;">
        <div style="display: inline-block; padding: 4px 12px; background-color: #dcfce7; border-radius: 20px; font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">
          Official Certificate Available
        </div>
        <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 16px; font-weight: 700;">No Due Certificate (NDC)</h4>
        <p style="margin: 0 0 16px 0; color: #64748b; font-size: 13px; line-height: 1.5;">
          Your official university No Due Certificate is now ready. You can present this for your graduation and alumni procedures.
        </p>
        <div>
          <a href="#" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 10px rgba(22, 163, 74, 0.25);">
            ⬇ Download NDC Certificate
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 11px; margin: 10px 0 0 0;">
          (Click the button above to directly download your official certificate)
        </p>
      </div>
    </div>
    <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        RGUKT Clearance Hub &copy; 2026<br>
        This is an automated message, please do not reply.
      </p>
    </div>
  </div>
`;

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, rejected: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState('Admin');
  const [pdfTemplateText, setPdfTemplateText] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login', { replace: true });
      return;
    }
    const user = JSON.parse(userStr);
    if (user.role !== 'ADMIN') {
      navigate('/login');
      return;
    }
    setAdminName(user.name || 'Admin');
    fetchData();

    // Prevent back navigation
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      setActiveTab(prev => {
        if (prev !== 'dashboard') {
          window.history.pushState(null, '', window.location.href);
          return 'dashboard';
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

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all students to match IDs and names
      const studentsSnap = await getDocs(collection(db, 'students'));
      const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'STUDENT')));
      
      const studentMap = new Map();
      usersSnap.docs.forEach(d => {
        studentMap.set(d.id, { ...d.data() });
      });
      studentsSnap.docs.forEach(d => {
        if (studentMap.has(d.id)) {
          studentMap.set(d.id, { ...studentMap.get(d.id), ...d.data() });
        }
      });

      // Fetch all clearance requests
      const crSnap = await getDocs(collection(db, 'clearanceRequests'));
      const crData = crSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), departmentClearances: [] as any[] }));
      
      // Fetch all department clearances
      const dcSnap = await getDocs(collection(db, 'departmentClearances'));
      const dcData = dcSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      let approvedCount = 0;
      let pendingCount = 0;
      let rejectedCount = 0;

      const formattedRequests = crData.map((req: any) => {
        const studentInfo = studentMap.get(req.studentId) || {};
        req.studentName = studentInfo.name || 'Unknown';
        req.actualStudentId = studentInfo.studentId || req.studentId;
        req.email = studentInfo.email || '';
        req.presentHostel = req.presentHostel || null;
        
        // Attach department clearances to the request
        const deps = dcData.filter((d: any) => d.requestId === req.id);
        
        // Ensure departments are somewhat ordered logically based on their status
        req.departmentClearances = deps;
        
        // Calculate status
        const isRejected = deps.some((d: any) => d.status === 'REJECTED');
        const isFullyApproved = deps.length > 0 && deps.every((d: any) => d.status === 'APPROVED');
        
        req.computedStatus = isRejected ? 'REJECTED' : isFullyApproved ? 'APPROVED' : 'PENDING';
        
        if (req.computedStatus === 'APPROVED') approvedCount++;
        else if (req.computedStatus === 'REJECTED') rejectedCount++;
        else pendingCount++;
        
        return req;
      });

      setStats({
        total: formattedRequests.length,
        approved: approvedCount,
        pending: pendingCount,
        rejected: rejectedCount
      });
      
      // Sort by newest first
      formattedRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setRequests(formattedRequests);

      // Fetch PDF Template
      const templateDoc = await getDoc(doc(db, 'settings', 'pdfTemplate'));
      if (templateDoc.exists()) {
        setPdfTemplateText(templateDoc.data().html || '');
      } else {
        // Default
        setPdfTemplateText(`
    <div style="font-family: Arial, sans-serif; padding: 40px; color: #333;">
      <h1 style="text-align: center; color: #1e3a8a; margin-bottom: 20px;">Dues & Penalties Report</h1>
      <hr style="border: 1px solid #e2e8f0; margin-bottom: 20px;"/>
      <h3 style="color: #475569;">Student Details</h3>
      <p><strong>Name:</strong> {{studentName}}</p>
      <p><strong>ID:</strong> {{studentId}}</p>
      <h3 style="color: #475569; margin-top: 30px;">Dues Breakdown</h3>
      {{duesBreakdown}}
      <hr style="border: 1px solid #e2e8f0; margin-top: 30px; margin-bottom: 20px;"/>
      <h2 style="text-align: right; color: #b91c1c;">Total Due: ₹{{totalDue}}</h2>
    </div>
        `);
      }

    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const savePdfTemplate = async () => {
    setSavingTemplate(true);
    try {
      await updateDoc(doc(db, 'settings', 'pdfTemplate'), { html: pdfTemplateText }).catch(async () => {
        // If it doesn't exist yet, we need to create it (writeBatch or setDoc is better, but let's just use setDoc if updateDoc fails)
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'settings', 'pdfTemplate'), { html: pdfTemplateText });
      });
      alert('Template saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleTestDownloadPdf = async () => {
    try {
      const sampleGroups = [
        { department: 'Boys Hostel', subtotal: 800, items: [{ reason: 'DOOR', amount: 500 }, { reason: 'WINDOW', amount: 300 }] },
        { department: 'Chemistry Lab', subtotal: 300, items: [{ reason: 'Solution & Glass Jar Broken', amount: 300 }] },
        { department: 'Library', subtotal: 300, items: [{ reason: 'Book1 not returned', amount: 200 }, { reason: 'Book2 not returned', amount: 100 }] },
        { department: 'Scholarship Office', subtotal: 33000, items: [{ reason: 'PUC 1st Year (P1) Tuition & Mess Due', amount: 10000 }, { reason: 'PUC 2nd Year (P2) Tuition & Mess Due', amount: 23000 }] },
        { department: 'IT Infra', subtotal: 1300, items: [{ reason: 'laptop Battery Missing', amount: 1000 }, { reason: 'Keyboard Broken', amount: 300 }] },
        { department: 'DSW', subtotal: 12020, items: [{ reason: 'Projector Damage', amount: 10000 }, { reason: 'Router', amount: 2000 }, { reason: 'Campus Maintenance', amount: 20 }] }
      ];

      const blob = await generateDuesPdfBlob(
        '',
        {
          name: 'B Nagesh',
          studentId: 'R240384',
          program: 'PUC (MPC)',
          hostel: 'Boys Hostel (MH-1)'
        },
        sampleGroups,
        47720
      );
      downloadPdfDirectly(blob, 'Sample_Official_RGUKT_Dues_Report.pdf');
    } catch (err: any) {
      alert('Error generating test PDF: ' + (err.message || err));
    }
  };

  const handleTestDownloadNdcPdf = async () => {
    try {
      const blob = await generateNDCPdfBlob({
        name: 'Sriram Yaddanapudi',
        studentId: 'R200001',
        program: 'B.Tech (CSE)',
        department: 'Computer Science & Engineering',
        hostel: 'Campus Residence'
      });
      downloadPdfDirectly(blob, 'Sample_Official_RGUKT_No_Due_Certificate.pdf');
    } catch (err: any) {
      alert('Error generating test NDC PDF: ' + (err.message || err));
    }
  };

  const [testMailModal, setTestMailModal] = useState<{
    open: boolean;
    templateType: 'submission' | 'fo_dues' | 'completed' | null;
    title: string;
  }>({
    open: false,
    templateType: null,
    title: ''
  });
  const [selectedStudentRequestId, setSelectedStudentRequestId] = useState<string>('mock');
  const [testRecipientEmail, setTestRecipientEmail] = useState('');
  const [isSendingTestMail, setIsSendingTestMail] = useState(false);
  const [testMailFeedback, setTestMailFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleOpenTestMail = (type: 'submission' | 'fo_dues' | 'completed', title: string) => {
    setTestMailModal({ open: true, templateType: type, title });
    setTestMailFeedback(null);
  };

  const handleSendTestMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipientEmail || !testRecipientEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }

    try {
      setIsSendingTestMail(true);
      setTestMailFeedback(null);

      // Determine whether user selected a real student request or default sample
      const targetReq = selectedStudentRequestId !== 'mock' ? requests.find(r => r.id === selectedStudentRequestId) : null;

      const studentName = targetReq ? targetReq.studentName : (testMailModal.templateType === 'completed' ? 'Sriram Yaddanapudi' : 'John Doe');
      const studentId = targetReq ? (targetReq.actualStudentId || targetReq.studentId) : (testMailModal.templateType === 'completed' ? 'R200001' : 'R240001');
      const studentProgram = targetReq ? (targetReq.programType || 'B.Tech') : 'B.Tech';
      const studentDept = targetReq ? (targetReq.department || (studentProgram.includes('PUC') ? 'Pre-University Course' : 'Computer Science & Engineering')) : 'Computer Science & Engineering';
      const studentHostel = targetReq ? (targetReq.presentHostel || 'Campus Residence') : 'Campus Residence';

      let htmlMessage = '';
      let recipientName = studentName;

      if (testMailModal.templateType === 'submission') {
        htmlMessage = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #16a34a, #15803d); padding: 24px 20px; text-align: center; color: white;">
              <h2 style="margin: 0; font-size: 24px; font-weight: 700;">Application Submitted!</h2>
            </div>
            <div style="padding: 30px;">
              <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Hello <strong>${studentName}</strong>,<br><br>
                Great news! Your clearance application has been successfully initiated and is now in the system.
              </p>
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;"><strong>Student Name:</strong> ${studentName}</p>
                <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;"><strong>Student ID:</strong> ${studentId}</p>
                <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;"><strong>Program:</strong> ${studentProgram}</p>
                <p style="margin: 0; color: #334155; font-size: 14px;"><strong>Submitted On:</strong> ${new Date().toLocaleString()}</p>
              </div>
              <div style="text-align: center; margin-top: 30px;">
                <a href="https://rguktclearance.vercel.app/student/dashboard" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px;">Track Application Status</a>
              </div>
            </div>
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">RGUKT Clearance Hub &copy; ${new Date().getFullYear()}</p>
            </div>
          </div>
        `;
      } else if (testMailModal.templateType === 'fo_dues') {
        let duesGroups: any[] = [];
        let grandTotal = 750;

        if (targetReq) {
          const detailed = await fetchDetailedStudentDues(studentId, targetReq);
          duesGroups = detailed.groups;
          grandTotal = targetReq.totalFeeDue || detailed.grandTotal || 0;
        }

        if (duesGroups.length === 0) {
          duesGroups = [
            { department: 'Hostel', subtotal: 500, items: [{ reason: 'Damaged Cot', amount: 500 }] },
            { department: 'Library', subtotal: 250, items: [{ reason: 'Unreturned Book (Physics Vol. 1)', amount: 250 }] }
          ];
          grandTotal = 750;
        }

        const duesBlob = await generateDuesPdfBlob(
          '',
          {
            name: studentName,
            studentId,
            program: studentProgram,
            department: studentDept,
            hostel: studentHostel
          },
          duesGroups,
          grandTotal
        );

        // Download PDF directly
        downloadPdfDirectly(duesBlob, `${studentId}_Official_Dues_Report.pdf`);

        // Upload to Drive & convert to direct download URL
        let downloadLink = `https://rguktclearance.vercel.app/download-dues?studentId=${studentId}`;
        let shareableUrl: string | null = null;
        try {
          const driveRes = await uploadNdcToDrive(duesBlob, `${studentId}_Official_Dues_Report.pdf`);
          if (driveRes.downloadUrl) {
            downloadLink = driveRes.downloadUrl;
            shareableUrl = driveRes.shareableUrl;
          }
        } catch (driveErr) {
          console.warn('Test drive upload warning:', driveErr);
        }

        htmlMessage = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 24px 20px; text-align: center; color: white;">
              <h2 style="margin: 0; font-size: 24px; font-weight: 700;">Pending Dues Alert</h2>
            </div>
            <div style="padding: 30px;">
              <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Hello <strong>${studentName}</strong> (ID: ${studentId}),<br><br>
                Your clearance application has pending dues of <strong>Rs. ${grandTotal.toLocaleString('en-IN')}</strong> that must be settled.
              </p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="${downloadLink}" style="display: inline-block; background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2);">
                  ⬇ Download Official Statement (PDF)
                </a>
              </div>
              ${shareableUrl ? `<p style="text-align: center; font-size: 12px;"><a href="${shareableUrl}" target="_blank" style="color: #2563eb;">View on Google Drive</a></p>` : ''}
            </div>
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">RGUKT Clearance Hub &copy; ${new Date().getFullYear()}</p>
            </div>
          </div>
        `;
      } else if (testMailModal.templateType === 'completed') {
        // Generate real NDC PDF with real student data and real department clearances
        const ndcBlob = await generateNDCPdfBlob({
          name: studentName,
          studentId,
          program: studentProgram,
          department: studentDept,
          hostel: studentHostel
        }, targetReq || undefined);

        // Download PDF directly to user's device
        downloadPdfDirectly(ndcBlob, `${studentId}_Official_No_Due_Certificate.pdf`);

        // Upload to Google Drive and convert to direct download URL
        let ndcDownloadUrl = `https://rguktclearance.vercel.app/download-ndc?studentId=${studentId}`;
        let driveShareableUrl: string | null = null;
        try {
          const driveRes = await uploadNdcToDrive(ndcBlob, `${studentId}_Official_No_Due_Certificate.pdf`);
          if (driveRes.downloadUrl) {
            ndcDownloadUrl = driveRes.downloadUrl;
            driveShareableUrl = driveRes.shareableUrl;
          }
        } catch (driveErr) {
          console.warn('Test NDC drive upload warning:', driveErr);
        }

        htmlMessage = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #16a34a, #15803d); padding: 30px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Clearance Application Completed!</h1>
            </div>
            <div style="padding: 30px; background-color: white;">
              <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Dear <strong>${studentName}</strong>,</p>
              <p style="color: #334155; font-size: 16px; margin-bottom: 25px; line-height: 1.6;">
                Congratulations! Your clearance application has been fully approved by all departments. You are now officially cleared with zero dues.
              </p>
              
              <div style="margin-top: 30px; padding: 22px; background-color: #f0fdf4; border: 1.5px dashed #86efac; border-radius: 12px; text-align: center;">
                <div style="display: inline-block; padding: 4px 12px; background-color: #dcfce7; border-radius: 20px; font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">
                  Official Certificate Available
                </div>
                <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 16px; font-weight: 700;">No Due Certificate (NDC)</h4>
                <p style="margin: 0 0 16px 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                  Your official university No Due Certificate for <strong>${studentName} (${studentId})</strong> is now ready. Click the button below to download your official PDF directly.
                </p>
                <div>
                  <a href="${ndcDownloadUrl}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 10px rgba(22, 163, 74, 0.25);">
                    ⬇ Download NDC Certificate
                  </a>
                </div>
                <p style="color: #94a3b8; font-size: 11px; margin: 10px 0 0 0;">
                  (Click the button above to directly download your official certificate)
                </p>
                ${driveShareableUrl ? `
                <p style="margin-top: 10px; font-size: 11px;">
                  <a href="${driveShareableUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">
                    Preview on Google Drive
                  </a>
                </p>
                ` : ''}
              </div>
            </div>
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                RGUKT Clearance Hub &copy; ${new Date().getFullYear()}<br>
                This is an official automated notification.
              </p>
            </div>
          </div>
        `;
      }

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_name: recipientName,
          to_email: testRecipientEmail,
          html_message: htmlMessage
        },
        EMAILJS_PUBLIC_KEY
      );

      setTestMailFeedback({
        type: 'success',
        message: `Test email successfully sent to ${testRecipientEmail} for ${studentName} (${studentId})! The PDF was also generated and downloaded.`
      });
    } catch (err: any) {
      console.error('Failed to send test email:', err);
      setTestMailFeedback({
        type: 'error',
        message: 'Failed to send test email: ' + (err.text || err.message || 'Unknown error')
      });
    } finally {
      setIsSendingTestMail(false);
    }
  };

  const overrideApprove = async (departmentId: string, departmentName: string, studentName: string, reqId: string) => {
    if (!window.confirm(`GOD MODE: Are you sure you want to FORCE APPROVE ${studentName}'s clearance for the ${departmentName} department? This bypasses the department's authority.`)) {
      return;
    }
    
    try {
      const depRef = doc(db, 'departmentClearances', departmentId);
      await updateDoc(depRef, {
        status: 'APPROVED',
        remarks: 'FORCE APPROVED BY ADMIN',
        updatedAt: new Date().toISOString()
      });
      
      // Find the request to unlock next department
      const req = requests.find(r => r.id === reqId);
      if (req) {
        const currentIdx = req.departmentClearances.findIndex((d: any) => d.id === departmentId);
        if (currentIdx !== -1 && currentIdx < req.departmentClearances.length - 1) {
          const nextDepId = req.departmentClearances[currentIdx + 1].id;
          const nextDepName = req.departmentClearances[currentIdx + 1].departmentName;
          const nextDepRef = doc(db, 'departmentClearances', nextDepId);
          await updateDoc(nextDepRef, { status: 'PENDING', updatedAt: new Date().toISOString() });
          
          if (nextDepName === 'FO' && req.totalFeeDue > 0 && req.email) {
            try {
              const { groups: duesGroups, grandTotal: detailedTotal } = await fetchDetailedStudentDues(req.studentId || req.id, req);

              let driveFileId: string | null = null;
              try {
                const pdfBlob = await generateDuesPdfBlob(
                  '',
                  {
                    name: studentName,
                    studentId: req.studentId || req.id,
                    program: req.programType || 'PUC',
                    department: req.department || '',
                    hostel: req.presentHostel || ''
                  },
                  duesGroups,
                  req.totalFeeDue || detailedTotal
                );

                try {
                  driveFileId = await uploadToGoogleDrive(pdfBlob, `${req.studentId || req.id}_Official_Dues_Report.pdf`);
                  if (driveFileId) {
                    await updateDoc(doc(db, 'clearanceRequests', req.id), { duesPdfFileId: driveFileId });
                  }
                } catch (driveErr) {
                  console.warn("Google Drive sync optional/skipped:", driveErr);
                }
              } catch (pdfErr) {
                console.error("Failed to generate PDF for admin override email:", pdfErr);
              }

              const baseUrl = 'https://rguktclearance.vercel.app';

              const directDownloadUrl = `${baseUrl}/download-dues?reqId=${req.id}&studentId=${req.studentId || req.id}`;
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

              let duesHtml = '';
              if (!duesGroups || duesGroups.length === 0) {
                duesHtml = `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #64748b;">No pending dues.</td></tr>`;
              } else {
                duesGroups.forEach((g: any) => {
                  duesHtml += `
                    <tr style="background-color: #f8fafc;">
                      <td colspan="3" style="padding: 10px 12px; border-bottom: 1px solid #cbd5e1; color: #1e293b; font-weight: bold; font-size: 13px;">
                        ${g.department.toUpperCase()} &nbsp;<span style="color: #64748b; font-weight: normal; font-size: 12px;">(Subtotal: ₹${g.subtotal.toLocaleString('en-IN')})</span>
                      </td>
                    </tr>
                  `;
                  g.items.forEach((item: any) => {
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
                      Hello <strong>${studentName}</strong>,<br><br>
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
                            <td style="padding: 16px 12px 0 12px; color: #ef4444; font-weight: bold; text-align: right; font-size: 18px;">₹${req.totalFeeDue}</td>
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
                      <a href="https://rguktclearance.vercel.app/student/dashboard" style="display: inline-block; background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2);">Upload Receipt</a>
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
                  to_name: studentName,
                  to_email: req.email,
                  html_message: htmlMessage
                },
                EMAILJS_PUBLIC_KEY
              );
            } catch (err) {
              console.error('Failed to send FO notification from Admin:', err);
            }
          }
        } else if (currentIdx === req.departmentClearances.length - 1) {
          const crRef = doc(db, 'clearanceRequests', req.id);
          
          let ndcDownloadUrl = `https://rguktclearance.vercel.app/download-ndc?reqId=${req.id}&studentId=${req.studentId || ''}`;
          let driveFileId: string | null = null;
          let driveShareableUrl: string | null = null;

          try {
            const ndcBlob = await generateNDCPdfBlob(
              {
                name: studentName,
                studentId: req.studentId || '',
                program: req.programType || 'B.Tech',
                department: req.department || '',
                hostel: req.presentHostel || ''
              },
              req
            );

            try {
              const driveRes = await uploadNdcToDrive(ndcBlob, `${req.studentId || 'Student'}_Official_No_Due_Certificate.pdf`);
              if (driveRes.downloadUrl) {
                ndcDownloadUrl = driveRes.downloadUrl;
                driveFileId = driveRes.fileId;
                driveShareableUrl = driveRes.shareableUrl;
              }
            } catch (driveErr) {
              console.warn('Admin: Google Drive upload warning:', driveErr);
            }

            await updateDoc(crRef, {
              status: 'APPROVED',
              ndcDownloadUrl,
              ndcDriveFileId: driveFileId || null,
              ndcDriveUrl: driveShareableUrl || null,
              ndcGeneratedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });

            // Send completion email to student
            if (req.email) {
              const htmlMessage = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                  <div style="background: linear-gradient(135deg, #16a34a, #15803d); padding: 30px 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Clearance Application Completed!</h1>
                  </div>
                  <div style="padding: 30px; background-color: white;">
                    <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Dear <strong>${studentName}</strong>,</p>
                    <p style="color: #334155; font-size: 16px; margin-bottom: 25px; line-height: 1.6;">
                      Congratulations! Your clearance application has been fully approved by all departments. You are now officially cleared with zero dues.
                    </p>
                    
                    <div style="margin-top: 30px; padding: 22px; background-color: #f0fdf4; border: 1.5px dashed #86efac; border-radius: 12px; text-align: center;">
                      <div style="display: inline-block; padding: 4px 12px; background-color: #dcfce7; border-radius: 20px; font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">
                        Official Certificate Available
                      </div>
                      <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 16px; font-weight: 700;">No Due Certificate (NDC)</h4>
                      <p style="margin: 0 0 16px 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                        Your official university No Due Certificate is now ready. Click the button below to download your official PDF directly.
                      </p>
                      <div>
                        <a href="${ndcDownloadUrl}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 10px rgba(22, 163, 74, 0.25);">
                          ⬇ Download NDC Certificate
                        </a>
                      </div>
                      <p style="color: #94a3b8; font-size: 11px; margin: 10px 0 0 0;">
                        (Click the button above to directly download your official certificate)
                      </p>
                      ${driveShareableUrl ? `
                      <p style="margin-top: 10px; font-size: 11px;">
                        <a href="${driveShareableUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">
                          Preview on Google Drive
                        </a>
                      </p>
                      ` : ''}
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
                  to_name: studentName,
                  to_email: req.email,
                  html_message: htmlMessage
                },
                EMAILJS_PUBLIC_KEY
              );
            }
          } catch (err) {
            console.error('Failed to complete final approval email flow:', err);
            await updateDoc(crRef, { status: 'APPROVED', updatedAt: new Date().toISOString() });
          }
        }
      }
      
      // Trigger a re-fetch to update UI
      await fetchData();
      
      alert(`Successfully force-approved ${departmentName} for ${studentName}.`);
    } catch (err) {
      console.error("Error overriding status:", err);
      alert("Failed to override status.");
    }
  };

  const filteredRequests = requests.filter(req => 
    req.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    req.actualStudentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getIcon = (name: string) => {
    const n = name.toUpperCase();
    if (n.includes('LIBRARY')) return <Book className="w-5 h-5" />;
    if (n.includes('HOSTEL')) return <Building className="w-5 h-5" />;
    if (n.includes('SPORTS')) return <Dumbbell className="w-5 h-5" />;
    if (n.includes('FO') || n.includes('ACCOUNT')) return <Briefcase className="w-5 h-5" />;
    if (n.includes('CHEMISTRY') || n.includes('PHYSICS')) return <FlaskConical className="w-5 h-5" />;
    if (n.includes('BIOLOGY')) return <Microscope className="w-5 h-5" />;
    if (n.includes('IT INFRA')) return <Monitor className="w-5 h-5" />;
    if (n.includes('SCHOLARSHIP')) return <Award className="w-5 h-5" />;
    if (n.includes('DEAN') || n.includes('DIRECTOR') || n.includes('AO') || n.includes('COE') || n.includes('HOD') || n.includes('DSW')) return <UserCog className="w-5 h-5" />;
    return <CheckSquare className="w-5 h-5" />;
  };

  return (
    <div className="flex min-h-screen text-on-background font-body-md antialiased">
      
      {/* SideNavBar Component - Exactly like StudentDashboard */}
      <aside className="bg-primary-container h-full w-64 fixed left-0 top-0 rounded-r-3xl border-r border-outline-variant/10 shadow-xl flex flex-col py-8 z-50 transition-transform duration-300 hover:scale-[1.03] origin-left">
        <div className="px-6 mb-8 flex flex-col items-center">
          <div className="w-24 h-24 mb-4 flex items-center justify-center">
            <img src="/logo.png" alt="RGUKT Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-headline-sm text-lg font-bold text-surface-container-lowest text-center">RGUKT ADMIN HUB</h1>
          <p className="font-label-sm text-on-primary-container mt-1">Master Control Panel</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${activeTab === 'dashboard' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${activeTab === 'requests' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
          >
            <UserCheck className="w-5 h-5" />
            All Requests
          </button>
          <button 
            onClick={() => setActiveTab('templates')}
            className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${activeTab === 'templates' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
          >
            <Mail className="w-5 h-5" />
            Email Templates
          </button>
          <button 
            onClick={() => setActiveTab('pdf_templates')}
            className={`w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg ${activeTab === 'pdf_templates' ? 'text-surface-container-lowest border-l-2 border-secondary-container bg-surface-variant/10 rounded-r-lg' : 'text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest'}`}
          >
            <FileText className="w-5 h-5" />
            PDF Templates
          </button>
          <button 
            className="w-full flex items-center gap-3 px-4 py-3 font-label-md transition-all duration-300 rounded-lg text-on-primary-container/70 hover:bg-surface-variant/20 hover:text-surface-container-lowest"
          >
            <Settings className="w-5 h-5" />
            Settings
          </button>
        </nav>
        
        <div className="mt-auto px-4 space-y-2 border-t border-outline-variant/10 pt-4">
          <div className="hidden lg:flex items-center gap-3 px-4 py-3 mb-2 rounded-lg bg-red-900/40 border border-red-500/30 text-red-100">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-xs font-bold uppercase tracking-wider">God Mode</span>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-on-primary-container/70 font-label-md hover:bg-surface-variant/20 hover:text-red-400 transition-all duration-300 rounded-lg">
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen bg-background">
        
        {/* TopNavBar Component */}
        <header className="bg-surface/80 top-0 sticky backdrop-blur-md border-b border-outline-variant/20 shadow-sm flex justify-between items-center h-16 px-8 z-40">
          <div className="flex-1 max-w-md">
            <h2 className="text-xl font-bold font-headline-md text-primary">
              {activeTab === 'dashboard' ? 'Overview Dashboard' : activeTab === 'requests' ? 'All Requests' : 'Email Templates'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={fetchData}
              className="text-on-surface-variant hover:text-secondary p-2 rounded-full hover:bg-surface-variant/50 transition-colors flex items-center gap-2 text-sm font-label-md"
            >
              <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin text-secondary' : ''}`} />
              <span className="hidden sm:inline">Sync Data</span>
            </button>
            <div className="w-9 h-9 rounded-full bg-primary-fixed overflow-hidden border border-outline-variant/30 ml-2 cursor-pointer flex items-center justify-center text-primary font-bold">
              {adminName.charAt(0) || 'A'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto w-full overflow-x-hidden">
          <div className="animate-in fade-in slide-in-from-right-8 duration-500 fill-mode-both space-y-8">
            
            {activeTab === 'dashboard' && (
              <>
                {/* Stats Container */}
                <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full pb-2">
                  <div className="bg-surface-container-lowest rounded-3xl border border-surface-variant shadow-sm p-6 flex flex-col justify-between h-32 relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md">
                    <p className="text-xs font-label-md text-outline uppercase">Total Requests</p>
                    <h2 className="text-4xl font-headline-lg font-bold text-on-surface">{stats.total}</h2>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full flex items-center justify-center translate-x-2 -translate-y-2">
                      <LayoutDashboard className="w-6 h-6 text-blue-500 translate-y-1 -translate-x-1" />
                    </div>
                  </div>
                  <div className="bg-surface-container-lowest rounded-3xl border border-surface-variant shadow-sm p-6 flex flex-col justify-between h-32 relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md">
                    <p className="text-xs font-label-md text-outline uppercase">Approved</p>
                    <h2 className="text-4xl font-headline-lg font-bold text-green-600">{stats.approved}</h2>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-green-50 rounded-bl-full flex items-center justify-center translate-x-2 -translate-y-2">
                      <CheckSquare className="w-6 h-6 text-green-500 translate-y-1 -translate-x-1" />
                    </div>
                  </div>
                  <div className="bg-surface-container-lowest rounded-3xl border border-surface-variant shadow-sm p-6 flex flex-col justify-between h-32 relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md">
                    <p className="text-xs font-label-md text-outline uppercase">Pending</p>
                    <h2 className="text-4xl font-headline-lg font-bold text-orange-500">{stats.pending}</h2>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 rounded-bl-full flex items-center justify-center translate-x-2 -translate-y-2">
                      <Clock className="w-6 h-6 text-orange-400 translate-y-1 -translate-x-1" />
                    </div>
                  </div>
                  <div className="bg-surface-container-lowest rounded-3xl border border-surface-variant shadow-sm p-6 flex flex-col justify-between h-32 relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md">
                    <p className="text-xs font-label-md text-outline uppercase">Rejected</p>
                    <h2 className="text-4xl font-headline-lg font-bold text-red-500">{stats.rejected}</h2>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-full flex items-center justify-center translate-x-2 -translate-y-2">
                      <XSquare className="w-6 h-6 text-red-400 translate-y-1 -translate-x-1" />
                    </div>
                  </div>
                </section>
                
                <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-sm border border-surface-variant mt-8 flex flex-col items-center justify-center text-center py-16">
                  <div className="w-20 h-20 bg-primary-fixed rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <ShieldCheck className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="font-headline-md text-2xl font-bold text-primary mb-3">System Healthy</h3>
                  <p className="font-body-md text-on-surface-variant max-w-md">The clearance hub is running smoothly. Switch to the <strong>All Requests</strong> tab to review and manage individual student clearances.</p>
                  <button 
                    onClick={() => setActiveTab('requests')}
                    className="mt-8 bg-primary text-on-primary px-8 py-3 rounded-xl font-label-md transition-all hover:-translate-y-1 hover:shadow-lg shadow-md"
                  >
                    View Student Queue
                  </button>
                </div>
              </>
            )}

            {activeTab === 'requests' && (
              <>
                {/* Search Bar */}
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search students by name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-outline-variant/50 rounded-xl text-sm focus:outline-none focus:border-secondary-container focus:ring-1 focus:ring-secondary-container transition-colors shadow-sm text-on-surface"
                  />
                </div>


            {/* Student Data Cards */}
            <section className="bg-surface-container-lowest rounded-3xl p-8 shadow-sm border border-surface-variant">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h3 className="font-headline-md text-xl font-bold text-primary mb-1">Clearance Queue</h3>
                  <p className="font-body-md text-on-surface-variant text-sm">
                    Review and override clearance requests. {filteredRequests.length} results.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {loading ? (
                  <div className="py-16 text-center text-on-surface-variant flex flex-col items-center">
                    <RefreshCcw className="h-10 w-10 animate-spin mb-4 text-secondary" />
                    <p className="font-headline-sm">Syncing system data...</p>
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="py-16 text-center text-on-surface-variant flex flex-col items-center border-2 border-dashed border-outline-variant/30 rounded-2xl">
                    <div className="w-16 h-16 bg-surface-variant/30 rounded-full flex items-center justify-center mb-4">
                      <Search className="h-8 w-8 text-outline" />
                    </div>
                    <p className="font-headline-sm text-lg text-primary mb-1">No requests found</p>
                    <p className="text-sm">Try adjusting your search filters.</p>
                  </div>
                ) : (
                  filteredRequests.map((req) => (
                    <div key={req.id} className="bg-surface rounded-2xl border border-surface-variant p-6 transition-all hover:shadow-md flex flex-col lg:flex-row gap-6 relative overflow-hidden group">
                      
                      {/* Status Glow Indicator */}
                      <div className={`absolute left-0 top-0 w-2 h-full ${
                        req.computedStatus === 'APPROVED' ? 'bg-green-500' :
                        req.computedStatus === 'REJECTED' ? 'bg-error' : 'bg-amber-400'
                      }`}></div>

                      <div className="flex-1 space-y-5 pl-2">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 w-full">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-headline-sm text-xl shadow-inner border border-outline-variant/30">
                              {req.studentName.charAt(0)}
                            </div>
                            <div>
                              <h3 className="text-xl font-bold font-headline-sm text-primary">{req.studentName}</h3>
                              <p className="text-sm font-body-sm text-on-surface-variant mt-0.5 tracking-wide">
                                {req.actualStudentId} <span className="mx-2 text-outline/50">•</span> {req.programType || 'B.Tech'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-row items-center gap-4">
                            {/* Overall Status Badge */}
                            {req.computedStatus === 'APPROVED' ? (
                              <span className="px-4 py-1.5 bg-green-100 text-green-700 text-xs font-label-md uppercase rounded-full flex items-center gap-1.5">
                                <CheckCircle className="h-4 w-4" /> CLEARED
                              </span>
                            ) : req.computedStatus === 'REJECTED' ? (
                              <span className="px-4 py-1.5 bg-error-container text-on-error-container text-xs font-label-md uppercase rounded-full flex items-center gap-1.5">
                                <AlertTriangle className="h-4 w-4" /> BLOCKED
                              </span>
                            ) : (
                              <span className="px-4 py-1.5 bg-amber-100 text-amber-700 text-xs font-label-md uppercase rounded-full flex items-center gap-1.5">
                                <Clock className="h-4 w-4" /> IN PROGRESS
                              </span>
                            )}
                            
                            <button
                              onClick={() => setSelectedRequest(req)}
                              className="px-4 py-2 bg-primary text-on-primary text-sm font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
                            >
                              Review
                            </button>
                          </div>
                        </div>
                      </div>
                      
                    </div>
                  ))
                )}
              </div>
              </section>
            </>
            )}

            {activeTab === 'templates' && (
              <div className="bg-surface-container-lowest rounded-3xl border border-surface-variant shadow-sm overflow-hidden flex flex-col p-8">
                <h3 className="font-headline-sm text-2xl font-bold text-primary mb-6">Email Templates Preview</h3>
                <p className="font-body-md text-on-surface-variant mb-8 max-w-3xl">
                  This section shows a live preview of the automated emails sent to students during the clearance process. These templates are powered by EmailJS and are fully responsive.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Application Submitted Template */}
                  <div className="bg-surface rounded-2xl border border-surface-variant p-6 flex flex-col">
                    <h4 className="font-headline-sm text-lg font-bold text-primary mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      Application Submitted
                    </h4>
                    <p className="font-body-sm text-on-surface-variant mb-6 text-sm">
                      Sent automatically when a student successfully initiates their clearance flow from the dashboard.
                    </p>
                    <div className="flex-1 bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-hidden shadow-inner p-4 flex items-center justify-center">
                      <div className="w-full max-w-md scale-[0.8] origin-top h-[600px] overflow-y-auto no-scrollbar shadow-xl rounded-xl border border-surface-variant"
                           dangerouslySetInnerHTML={{ __html: MOCK_SUBMISSION_TEMPLATE }}>
                      </div>
                    </div>
                    {/* Action Bar Below Template */}
                    <div className="mt-4 pt-4 border-t border-surface-variant flex flex-wrap gap-2 items-center justify-between">
                      <span className="text-xs text-on-surface-variant font-medium">Test Automation:</span>
                      <button
                        onClick={() => handleOpenTestMail('submission', 'Application Submitted')}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Mail className="w-3.5 h-3.5" /> Send Test Mail
                      </button>
                    </div>
                  </div>

                  {/* FO Pending Dues Template */}
                  <div className="bg-surface rounded-2xl border border-surface-variant p-6 flex flex-col">
                    <h4 className="font-headline-sm text-lg font-bold text-primary mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-error" />
                      Pending Dues Alert (FO)
                    </h4>
                    <p className="font-body-sm text-on-surface-variant mb-6 text-sm">
                      Sent automatically when a student's clearance reaches the FO (Accounts) department and they have accumulated dues.
                    </p>
                    <div className="flex-1 bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-hidden shadow-inner p-4 flex items-center justify-center">
                      <div className="w-full max-w-md scale-[0.8] origin-top h-[600px] overflow-y-auto no-scrollbar shadow-xl rounded-xl border border-surface-variant"
                           dangerouslySetInnerHTML={{ __html: MOCK_FO_DUES_TEMPLATE }}>
                      </div>
                    </div>
                    {/* Action Bar Below Template */}
                    <div className="mt-4 pt-4 border-t border-surface-variant flex flex-wrap gap-2 items-center justify-between">
                      <span className="text-xs text-on-surface-variant font-medium">Test Automation & Dues PDF:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleTestDownloadPdf}
                          className="px-3 py-2 bg-surface-variant/40 hover:bg-surface-variant/70 text-on-surface text-xs font-bold rounded-xl border border-outline-variant/30 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" /> Download Dues PDF
                        </button>
                        <button
                          onClick={() => handleOpenTestMail('fo_dues', 'Pending Dues Alert (FO)')}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" /> Send Test Mail & PDF
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Application Completed Template */}
                  <div className="bg-surface rounded-2xl border border-surface-variant p-6 flex flex-col">
                    <h4 className="font-headline-sm text-lg font-bold text-primary mb-2 flex items-center gap-2">
                      <Award className="w-5 h-5 text-secondary-container" />
                      Application Completed
                    </h4>
                    <p className="font-body-sm text-on-surface-variant mb-6 text-sm">
                      Sent automatically when all departments have fully approved the clearance request. Includes NDC download option.
                    </p>
                    <div className="flex-1 bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-hidden shadow-inner p-4 flex items-center justify-center">
                      <div className="w-full max-w-md scale-[0.8] origin-top h-[600px] overflow-y-auto no-scrollbar shadow-xl rounded-xl border border-surface-variant"
                           dangerouslySetInnerHTML={{ __html: MOCK_COMPLETION_TEMPLATE }}>
                      </div>
                    </div>
                    {/* Action Bar Below Template */}
                    <div className="mt-4 pt-4 border-t border-surface-variant flex flex-wrap gap-2 items-center justify-between">
                      <span className="text-xs text-on-surface-variant font-medium">Test Automation & NDC PDF:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleTestDownloadNdcPdf}
                          className="px-3 py-2 bg-surface-variant/40 hover:bg-surface-variant/70 text-on-surface text-xs font-bold rounded-xl border border-outline-variant/30 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" /> Download NDC PDF
                        </button>
                        <button
                          onClick={() => handleOpenTestMail('completed', 'Application Completed (NDC)')}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" /> Send Test Mail & PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pdf_templates' && (
              <div className="space-y-8">
                {/* Official Certificate Style Preview Card */}
                <div className="bg-surface-container-lowest rounded-3xl border border-surface-variant shadow-sm overflow-hidden flex flex-col p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="font-headline-sm text-2xl font-bold text-primary flex items-center gap-2">
                        <FileText className="w-6 h-6 text-red-600" />
                        Official Certificate-Style Dues Report (Vector PDF)
                      </h3>
                      <p className="font-body-md text-on-surface-variant mt-1 max-w-2xl">
                        The automated system generates crisp, vector-based PDF certificates with the official RGUKT seal, department grouping, and individual penalty items.
                      </p>
                    </div>
                    <button
                      onClick={handleTestDownloadPdf}
                      className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer"
                    >
                      <FileText className="w-4 h-4" /> Test Download Official PDF
                    </button>
                  </div>

                  {/* Visual Mock of the Official Certificate PDF */}
                  <div className="p-6 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner flex justify-center">
                    <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg border-[4px] border-double border-red-900/40 p-6 relative">
                      {/* Inner gold border */}
                      <div className="border border-amber-600/50 rounded-lg p-5">
                        
                        {/* University Header */}
                        <div className="flex items-center gap-4 border-b-2 border-red-800/80 pb-3 mb-4">
                          <img src="/rgukt.png" alt="RGUKT Logo" className="w-14 h-14 object-contain shrink-0" />
                          <div className="flex-1 text-center pr-10">
                            <h4 className="text-sm font-bold text-[#b03a2e] uppercase tracking-wide">
                              Rajiv Gandhi University of Knowledge Technologies
                            </h4>
                            <p className="text-[10px] text-slate-600 font-medium leading-tight mt-0.5">
                              (A.P. Government Act 18 of 2008) • IIIT RK Valley Campus, RGUKT-A.P.<br />
                              RK Valley (Idupulapaya), Vempalli (M), Y.S.R. Kadapa Dist., A.P - 516330
                            </p>
                          </div>
                        </div>

                        {/* Title Banner */}
                        <div className="bg-red-50 border border-red-200 rounded-md py-1.5 px-3 text-center mb-4">
                          <span className="text-xs font-bold text-red-800 tracking-wide uppercase">
                            Official Statement of Outstanding Dues & Penalties
                          </span>
                        </div>

                        {/* Student Meta Box */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs grid grid-cols-2 gap-2 mb-4">
                          <div>
                            <span className="text-slate-500 font-medium">Student Name: </span>
                            <span className="font-bold text-slate-800">B Nagesh</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Statement Date: </span>
                            <span className="font-bold text-slate-800">September 8, 2026</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Student ID: </span>
                            <span className="font-bold text-slate-800">R240384</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Clearance Status: </span>
                            <span className="font-bold text-red-600">ACTION REQUIRED (Pending FO)</span>
                          </div>
                        </div>

                        {/* Divided Department Breakdown Table (4-Column University Audit Format) */}
                        <div className="border border-slate-300 rounded-md overflow-hidden text-xs mb-4">
                          <div className="bg-slate-900 text-white font-bold grid grid-cols-12 px-3 py-2 text-[11px]">
                            <div className="col-span-1 text-center">#</div>
                            <div className="col-span-3">Department / Section</div>
                            <div className="col-span-6">Item Description / Penalty Particulars</div>
                            <div className="col-span-2 text-right">Amount (Rs.)</div>
                          </div>

                          {/* Boys Hostel */}
                          <div className="bg-slate-100/90 font-bold px-3 py-2 border-t border-slate-200 border-l-4 border-l-red-800 flex justify-between items-center text-slate-900 text-[11px]">
                            <span>DEPARTMENT: BOYS HOSTEL</span>
                            <span>Subtotal: Rs. 800.00</span>
                          </div>
                          <div className="px-3 py-1.5 border-t border-slate-100 grid grid-cols-12 text-slate-700 bg-white items-center text-[11px]">
                            <div className="col-span-1 text-center text-slate-400 font-medium">1</div>
                            <div className="col-span-3 text-slate-600 font-medium">Boys Hostel</div>
                            <div className="col-span-6 font-bold text-slate-900">DOOR Breakage</div>
                            <div className="col-span-2 text-right font-bold text-red-600">Rs. 500.00</div>
                          </div>
                          <div className="px-3 py-1.5 border-t border-slate-100 grid grid-cols-12 text-slate-700 bg-white items-center text-[11px]">
                            <div className="col-span-1 text-center text-slate-400 font-medium">2</div>
                            <div className="col-span-3 text-slate-600 font-medium">Boys Hostel</div>
                            <div className="col-span-6 font-bold text-slate-900">WINDOW Damage</div>
                            <div className="col-span-2 text-right font-bold text-red-600">Rs. 300.00</div>
                          </div>

                          {/* Chemistry Lab */}
                          <div className="bg-slate-100/90 font-bold px-3 py-2 border-t border-slate-200 border-l-4 border-l-red-800 flex justify-between items-center text-slate-900 text-[11px]">
                            <span>DEPARTMENT: CHEMISTRY LAB</span>
                            <span>Subtotal: Rs. 300.00</span>
                          </div>
                          <div className="px-3 py-1.5 border-t border-slate-100 grid grid-cols-12 text-slate-700 bg-white items-center text-[11px]">
                            <div className="col-span-1 text-center text-slate-400 font-medium">3</div>
                            <div className="col-span-3 text-slate-600 font-medium">Chemistry Lab</div>
                            <div className="col-span-6 font-bold text-slate-900">Solution & Glass Jar Broken</div>
                            <div className="col-span-2 text-right font-bold text-red-600">Rs. 300.00</div>
                          </div>

                          {/* Library */}
                          <div className="bg-slate-100/90 font-bold px-3 py-2 border-t border-slate-200 border-l-4 border-l-red-800 flex justify-between items-center text-slate-900 text-[11px]">
                            <span>DEPARTMENT: LIBRARY</span>
                            <span>Subtotal: Rs. 300.00</span>
                          </div>
                          <div className="px-3 py-1.5 border-t border-slate-100 grid grid-cols-12 text-slate-700 bg-white items-center text-[11px]">
                            <div className="col-span-1 text-center text-slate-400 font-medium">4</div>
                            <div className="col-span-3 text-slate-600 font-medium">Library</div>
                            <div className="col-span-6 font-bold text-slate-900">Book 1 not returned</div>
                            <div className="col-span-2 text-right font-bold text-red-600">Rs. 200.00</div>
                          </div>
                          <div className="px-3 py-1.5 border-t border-slate-100 grid grid-cols-12 text-slate-700 bg-white items-center text-[11px]">
                            <div className="col-span-1 text-center text-slate-400 font-medium">5</div>
                            <div className="col-span-3 text-slate-600 font-medium">Library</div>
                            <div className="col-span-6 font-bold text-slate-900">Book 2 not returned</div>
                            <div className="col-span-2 text-right font-bold text-red-600">Rs. 100.00</div>
                          </div>

                          {/* Scholarship Office */}
                          <div className="bg-slate-100/90 font-bold px-3 py-2 border-t border-slate-200 border-l-4 border-l-red-800 flex justify-between items-center text-slate-900 text-[11px]">
                            <span>DEPARTMENT: SCHOLARSHIP OFFICE</span>
                            <span>Subtotal: Rs. 33,000.00</span>
                          </div>
                          <div className="px-3 py-1.5 border-t border-slate-100 grid grid-cols-12 text-slate-700 bg-white items-center text-[11px]">
                            <div className="col-span-1 text-center text-slate-400 font-medium">6</div>
                            <div className="col-span-3 text-slate-600 font-medium">Scholarship Office</div>
                            <div className="col-span-6 font-bold text-slate-900">PUC 1st Year (P1) Tuition & Mess Due</div>
                            <div className="col-span-2 text-right font-bold text-red-600">Rs. 10,000.00</div>
                          </div>
                          <div className="px-3 py-1.5 border-t border-slate-100 grid grid-cols-12 text-slate-700 bg-white items-center text-[11px]">
                            <div className="col-span-1 text-center text-slate-400 font-medium">7</div>
                            <div className="col-span-3 text-slate-600 font-medium">Scholarship Office</div>
                            <div className="col-span-6 font-bold text-slate-900">PUC 2nd Year (P2) Tuition & Mess Due</div>
                            <div className="col-span-2 text-right font-bold text-red-600">Rs. 23,000.00</div>
                          </div>

                          {/* Grand Total Footer */}
                          <div className="bg-red-50 font-bold px-3 py-2.5 border-t-2 border-red-300 flex justify-between items-center text-xs text-red-900">
                            <span>TOTAL OUTSTANDING DUES TO BE PAID:</span>
                            <span className="text-sm font-black text-red-700">Rs. 47,720.00</span>
                          </div>
                        </div>

                        {/* In Words & Signatures */}
                        <div className="bg-slate-50 p-2 rounded border border-slate-200 text-[11px] mb-4 text-slate-700">
                          <span className="font-bold text-slate-500">Amount in words: </span>
                          <span className="italic">Rupees Forty-Seven Thousand Seven Hundred Twenty Only</span>
                        </div>

                        <div className="flex justify-between items-end pt-3 text-center text-xs">
                          <div>
                            <span className="italic font-serif text-blue-900/70 text-[11px] block">Approved Digitally</span>
                            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800 text-[10px]">Department In-charges</div>
                          </div>
                          <div>
                            <span className="italic font-serif text-blue-900/70 text-[11px] block">Approved Digitally</span>
                            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800 text-[10px]">Finance Officer (FO)</div>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>

                {/* Legacy HTML Template Editor for Custom Branding */}
                <div className="bg-surface-container-lowest rounded-3xl border border-surface-variant shadow-sm overflow-hidden flex flex-col p-8">
                  <h3 className="font-headline-sm text-xl font-bold text-primary mb-3">Custom HTML Template Override</h3>
                  <p className="font-body-md text-on-surface-variant mb-4 text-sm max-w-3xl">
                    Configure optional custom styling or template overrides for automated alerts. Supported placeholders: <code>{'{{studentName}}'}</code>, <code>{'{{studentId}}'}</code>, <code>{'{{totalDue}}'}</code>, <code>{'{{duesBreakdown}}'}</code>.
                  </p>
                  
                  <textarea
                    className="w-full h-64 p-4 font-mono text-sm border border-outline-variant rounded-xl bg-surface mb-4"
                    value={pdfTemplateText}
                    onChange={(e) => setPdfTemplateText(e.target.value)}
                  />
                  
                  <button
                    onClick={savePdfTemplate}
                    disabled={savingTemplate}
                    className="bg-primary text-on-primary px-6 py-2 rounded-xl font-bold self-start hover:bg-primary/90 transition-colors disabled:opacity-70 cursor-pointer"
                  >
                    {savingTemplate ? 'Saving...' : 'Save Template'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-on-background/40 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl flex flex-col border border-surface-variant animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-surface/80 backdrop-blur-md p-6 border-b border-surface-variant flex justify-between items-center z-10">
              <div>
                <h3 className="font-headline-md text-2xl font-bold text-primary">{selectedRequest.studentName}</h3>
                <p className="font-body-sm text-on-surface-variant">ID: {selectedRequest.actualStudentId} • {selectedRequest.programType || 'B.Tech'} {selectedRequest.courseType ? `(${selectedRequest.courseType})` : ''}{selectedRequest.programType === 'B.Tech' && selectedRequest.pucCourseType ? ` - ${selectedRequest.pucCourseType}` : ''}{selectedRequest.presentHostel ? ` • Hostel: ${selectedRequest.presentHostel}` : ''}</p>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="p-2 rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8">
              <div className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-headline-sm text-lg font-bold text-primary">Clearance Flow</h4>
                  {selectedRequest.feeReceiptUrl && (
                    <a 
                      href={selectedRequest.feeReceiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors border border-blue-300"
                    >
                      <FileText className="w-4 h-4" /> View Fee Receipt
                    </a>
                  )}
                </div>
                
                {/* Visual Flow (StudentDashboard Style) */}
                <div className="w-full pb-10 pt-2 flex justify-center overflow-x-auto no-scrollbar">
                  <div className="flex items-center min-w-max px-2">
                    {getDepartmentSequence(selectedRequest).map((deptName: string, index: number, arr: string[]) => {
                      const dep = selectedRequest.departmentClearances.find((d: any) => d.departmentName === deptName);
                      const isApproved = dep?.status === 'APPROVED';
                      const isRejected = dep?.status === 'REJECTED';
                      const isPending = dep?.status === 'PENDING';
                      
                      return (
                        <div key={deptName} className={`flex items-center ${index < arr.length - 1 ? 'flex-1' : ''}`}>
                          {/* Step Circle */}
                          <div className="flex flex-col items-center relative group min-w-[80px]">
                            <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center z-10 transition-all duration-300 border-[3px] shadow-sm shrink-0 ${
                              isApproved ? 'bg-green-500 border-green-100 text-white' : 
                              isRejected ? 'bg-error border-error-container text-white' :
                              isPending ? 'bg-amber-500 border-amber-100 text-white ring-4 ring-amber-200/50 animate-pulse' :
                              'bg-surface border-surface-variant text-outline-variant'
                            }`}>
                              <div className="scale-75 lg:scale-90 flex items-center justify-center">
                                {getIcon(deptName)}
                              </div>
                            </div>
                            
                            {/* Status Badge */}
                            <div className="absolute -top-2 -right-0 lg:-right-2 z-20">
                              {isApproved ? (
                                <div className="bg-white rounded-full text-green-500 shadow-sm"><CheckCircle2 className="w-4 h-4" /></div>
                              ) : isRejected ? (
                                <div className="bg-white rounded-full text-error shadow-sm"><AlertCircle className="w-4 h-4" /></div>
                              ) : isPending ? (
                                <div className="bg-white rounded-full text-amber-500 shadow-sm"><Clock className="w-4 h-4" /></div>
                              ) : (
                                <div className="bg-white rounded-full text-outline-variant shadow-sm p-0.5"><Lock className="w-3 h-3" /></div>
                              )}
                            </div>
                            
                            <div className="absolute top-12 lg:top-14 w-20 lg:w-24 text-center">
                              <span className={`text-[9px] lg:text-[10px] font-bold uppercase tracking-wider leading-tight line-clamp-2 ${
                                isApproved ? 'text-green-700 font-bold' : 
                                isRejected ? 'text-error font-bold' :
                                isPending ? 'text-amber-700 font-extrabold' : 
                                'text-outline'
                              }`}>
                                {deptName}
                              </span>
                            </div>
                          </div>
                          
                          {/* Connecting Line */}
                          {index < arr.length - 1 && (
                            <div className={`w-8 lg:w-16 h-1 mx-1 lg:mx-2 rounded-full transition-colors duration-500 ${
                              isApproved ? 'bg-green-500' : 'bg-surface-variant'
                            }`}></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-headline-sm text-lg font-bold text-primary mb-4">Department Status</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {getDepartmentSequence(selectedRequest).map((deptName: string, index: number) => {
                    const dept = selectedRequest.departmentClearances.find((d: any) => d.departmentName === deptName);
                    
                    return (
                      <div key={deptName} style={{ animationDelay: `${index * 50}ms` }} className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_-2px_rgba(10,25,47,0.05)] hover:-translate-y-1 hover:shadow-[0_8px_24px_-4px_rgba(10,25,47,0.08)] transition-all duration-300 border border-surface-variant flex flex-col h-full animate-in slide-in-from-bottom-8 fade-in fill-mode-both group/dep relative overflow-hidden">
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
                              <Lock className="w-3.5 h-3.5" /> Locked
                            </span>
                          )}
                        </div>
                        
                        <h4 className="font-headline-sm text-base font-bold text-primary mb-1.5">{deptName}</h4>
                        <p className="font-body-sm text-[13px] leading-relaxed text-on-surface-variant mb-4 flex-1">
                          {dept?.remarks || (dept ? (dept.status === 'LOCKED' ? `Waiting for previous departments to approve.` : `Awaiting confirmation from ${deptName.toLowerCase()} manager.`) : `Waiting for previous departments to approve.`)}
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
                            <span className="font-label-sm text-xs text-outline font-medium">Not Initiated</span>
                          )}
                        </div>

                        {/* God Mode Override for PENDING ones */}
                        {dept && (dept.status === 'PENDING' || dept.status === 'REJECTED') && (
                          <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/dep:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                overrideApprove(dept.id, dept.departmentName, selectedRequest.studentName, selectedRequest.id);
                                setSelectedRequest(null);
                              }}
                              className="bg-error text-on-error hover:bg-error/90 text-xs font-bold uppercase px-4 py-2 rounded-lg shadow-lg flex items-center gap-1.5 transition-transform hover:scale-105"
                            >
                              <ShieldAlert className="h-4 w-4" /> Force Approve
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Department Details Modal */}
      {selectedDept && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
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
                    <AlertCircle className="w-4 h-4" /> Action Required
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

            <button 
              onClick={() => setSelectedDept(null)} 
              className="w-full bg-primary-container text-on-primary py-3 rounded-xl font-label-md font-semibold hover:scale-[1.02] transition-transform duration-300 shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Test Mail Dispatch Modal */}
      {testMailModal.open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-on-background/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-lg shadow-2xl border border-surface-variant overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-surface-variant flex justify-between items-center bg-surface/60">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline-sm text-lg font-bold text-primary">Send Test Email</h3>
                  <p className="text-xs text-on-surface-variant font-medium">{testMailModal.title}</p>
                </div>
              </div>
              <button
                onClick={() => setTestMailModal({ open: false, templateType: null, title: '' })}
                className="p-1.5 rounded-full hover:bg-surface-variant text-on-surface-variant transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendTestMail} className="p-6 space-y-4">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Enter your email address to receive this automated template. If the template contains an NDC or Dues Statement, the vector PDF will automatically be generated, uploaded to Google Drive with an instant download link, and immediately downloaded to your browser.
              </p>

              <div>
                <label className="block text-xs font-bold text-primary mb-1.5 uppercase tracking-wider">
                  Select Student Data (Real or Mock)
                </label>
                <select
                  value={selectedStudentRequestId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedStudentRequestId(val);
                    if (val !== 'mock') {
                      const found = requests.find(r => r.id === val);
                      if (found?.email) {
                        setTestRecipientEmail(found.email);
                      }
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-body-md text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="mock">Default Preview Sample Data (Sriram / John)</option>
                  {requests.map((req) => (
                    <option key={req.id} value={req.id}>
                      {req.studentName} ({req.actualStudentId}) — {req.programType || 'B.Tech'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-on-surface-variant/80 mt-1">
                  Selecting an active student automatically uses their real name, ID, program, department, and real department clearances in the generated PDF and email!
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary mb-1.5 uppercase tracking-wider">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. yourname@rgukt.ac.in or personal@gmail.com"
                  value={testRecipientEmail}
                  onChange={(e) => setTestRecipientEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-sm font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  autoFocus
                />
              </div>

              {testMailFeedback && (
                <div className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                  testMailFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {testMailFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <span>{testMailFeedback.message}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setTestMailModal({ open: false, templateType: null, title: '' })}
                  className="px-4 py-2.5 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSendingTestMail}
                  className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSendingTestMail ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generating & Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      Send Test Email & Download PDF
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
