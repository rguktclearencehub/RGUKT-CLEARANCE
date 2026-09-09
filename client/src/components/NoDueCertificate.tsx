import { useState } from 'react';
import { Printer, X, Download, CloudUpload, Check } from 'lucide-react';
import { generateNDCPdfBlob, downloadPdfDirectly, uploadNdcToDrive, formatStudentDepartment } from '../utils/pdfGenerator';
import DriveUploadModal from './DriveUploadModal';

interface NoDueCertificateProps {
  student: {
    name: string;
    studentId: string;
    program?: string;
    department?: string;
    hostel?: string;
  };
  clearanceData?: any;
  onClose: () => void;
}

export default function NoDueCertificate({ student, clearanceData, onClose }: NoDueCertificateProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveUploadStatus, setDriveUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>(
    clearanceData?.ndcDriveFileId || clearanceData?.ndcDriveUrl ? 'success' : 'idle'
  );
  const [driveShareableUrl, setDriveShareableUrl] = useState<string | null>(
    clearanceData?.ndcDriveUrl || clearanceData?.ndcDownloadUrl || null
  );
  const [driveErrorMessage, setDriveErrorMessage] = useState<string | null>(null);

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const certNumber = `NDC-RGUKT-${new Date().getFullYear()}-${(student.studentId || 'GEN').toUpperCase()}`;

  const resolvedProgram = clearanceData?.programType || student.program || 'B.Tech';
  const resolvedBranch = formatStudentDepartment(
    student.department,
    resolvedProgram,
    clearanceData?.courseType || student.department,
    clearanceData?.pucCourseType
  );
  const resolvedHostel = student.hostel || clearanceData?.presentHostel || 'Campus Residence';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      const blob = await generateNDCPdfBlob(student, clearanceData);
      downloadPdfDirectly(blob, `${student.studentId}_Official_No_Due_Certificate.pdf`);
    } catch (err: any) {
      console.error(err);
      alert('Failed to generate PDF: ' + (err.message || err));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveToDrive = async () => {
    setDriveModalOpen(true);
    setDriveUploadStatus('uploading');
    setDriveErrorMessage(null);
    setDriveShareableUrl(null);
    try {
      const blob = await generateNDCPdfBlob(student, clearanceData);
      const res = await uploadNdcToDrive(blob, `${student.studentId}_Official_No_Due_Certificate.pdf`);
      setDriveShareableUrl(res.shareableUrl || null);
      setDriveUploadStatus('success');
    } catch (err: any) {
      console.error('Failed to save to Google Drive:', err);
      setDriveErrorMessage(err.message || 'Failed to save certificate to Google Drive.');
      setDriveUploadStatus('error');
    }
  };

  const getDepartmentAuthority = (deptName: string): string => {
    const d = (deptName || '').toLowerCase().trim();
    if (d === 'hostel' || d.includes('hostel')) return 'Chief Warden';
    if (d === 'dsw') return 'Dean of Student Welfare';
    if (d === 'sports') return 'Sports Officer';
    if (d === 'physics lab') return 'Physics Lab In-Charge';
    if (d === 'chemistry lab') return 'Chemistry Lab In-Charge';
    if (d === 'biology lab') return 'Biology Lab In-Charge';
    if (d.startsWith('lab technician') || d === 'engg labs') return 'Lab Technician / In-Charge';
    if (d === 'coe') return 'Controller of Examinations';
    if (d.startsWith('hod')) return 'Head of Department (HOD)';
    if (d === 'library') return 'Chief Librarian';
    if (d === 'it infra') return 'Network Administrator';
    if (d === 'scholarship office' || d.includes('scholarship')) return 'Scholarship Officer';
    if (d === 'fo' || d.includes('finance') || d.includes('account')) return 'Finance Officer';
    if (d === 'ao') return 'Administrative Officer';
    if (d === 'director') return 'Campus Director';
    if (d === 'dean of academics' || d.includes('dean')) return 'Dean of Academics';
    return 'Department Authority';
  };

  const getDepartmentFormalState = (deptName: string): string => {
    const d = (deptName || '').toLowerCase().trim();
    if (d === 'hostel' || d.includes('hostel')) return 'CLEARED - Room Vacated & Nil Dues';
    if (d === 'dsw') return 'CLEARED - Welfare Reconciled';
    if (d === 'sports') return 'CLEARED - No Equipment Pending';
    if (d.includes('lab') || d.startsWith('lab technician')) return 'CLEARED - No Breakages / Dues';
    if (d === 'coe') return 'CLEARED - All Semesters Passed';
    if (d.startsWith('hod')) return 'CLEARED - Academic Clearance Given';
    if (d === 'library') return 'CLEARED - Zero Books / Fine Due';
    if (d === 'it infra') return 'CLEARED - Systems Reconciled';
    if (d === 'scholarship office' || d.includes('scholarship')) return 'CLEARED - Accounts Balanced';
    if (d === 'fo' || d.includes('finance') || d.includes('account')) return 'CLEARED - Rs. 0.00 Outstanding';
    if (d === 'ao') return 'CLEARED - Admin Verified';
    if (d === 'director') return 'CLEARED - Approved by Director';
    if (d === 'dean of academics' || d.includes('dean')) return 'CLEARED - Academic Clearance';
    return 'CLEARED - All Requirements Met';
  };

  const isBTech = (resolvedProgram || '').trim().toLowerCase().includes('b.tech') || (resolvedProgram || '').trim().toLowerCase().includes('btech');
  const branchAbbr = clearanceData?.courseType || (student.department && student.department.length <= 6 ? student.department : '');
  const isMpc = clearanceData?.pucCourseType === 'MPC' || (!isBTech && (clearanceData?.courseType === 'MPC' || branchAbbr === 'MPC'));

  let deptsInOrder = isBTech ? [
    'Hostel', 'DSW', 'Sports', 'Physics Lab', 'Chemistry Lab', 'Biology Lab', 'Engg Labs',
    'COE', 'HOD', 'Library', 'IT Infra', 'Scholarship Office',
    'FO', 'AO', 'Director', 'Dean of Academics'
  ] : [
    'Hostel', 'DSW', 'Sports', 'Physics Lab', 'Chemistry Lab', 'Biology Lab',
    'COE', 'Library', 'IT Infra', 'Scholarship Office',
    'FO', 'AO', 'Director', 'Dean of Academics'
  ];

  if (isMpc) {
    deptsInOrder = deptsInOrder.filter(d => d !== 'Biology Lab');
  }

  const tableRows = deptsInOrder.map(dept => {
    let displayName = dept;
    if (dept === 'HOD') displayName = branchAbbr ? `HOD ${branchAbbr}` : 'HOD';
    if (dept === 'Engg Labs') displayName = branchAbbr ? `Lab Technician ${branchAbbr}` : 'Engineering Labs';

    const auth = getDepartmentAuthority(displayName);
    const state = getDepartmentFormalState(displayName);
    return { dept: displayName, auth, state };
  });

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-start p-2 sm:p-4 z-[200] print:bg-white print:p-0 overflow-y-auto">
      
      {/* Top Floating Action Bar (Never overlaps certificate content) */}
      <div className="w-full max-w-3xl flex items-center justify-between bg-slate-800/90 text-white px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md mb-3 print:hidden shrink-0 border border-slate-700/60 sticky top-2 z-[220]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-bold text-xs sm:text-sm tracking-wide text-slate-200">No Due Certificate Preview</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 sm:px-4 py-1.5 rounded-xl font-bold shadow-sm flex items-center gap-1.5 transition-all text-xs cursor-pointer disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isDownloading ? 'Generating...' : 'Download PDF'}</span>
            <span className="sm:hidden">PDF</span>
          </button>
          
          <button
            onClick={handleSaveToDrive}
            disabled={driveUploadStatus === 'uploading'}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 sm:px-4 py-1.5 rounded-xl font-bold shadow-sm flex items-center gap-1.5 transition-all text-xs cursor-pointer disabled:opacity-60"
          >
            {driveUploadStatus === 'success' ? (
              <>
                <Check className="w-3.5 h-3.5 text-white animate-in zoom-in-50 duration-200" />
                <span className="hidden sm:inline">Saved to Drive</span>
                <span className="sm:hidden">Saved</span>
              </>
            ) : driveUploadStatus === 'uploading' ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="hidden sm:inline">Saving...</span>
                <span className="sm:hidden">Saving</span>
              </>
            ) : (
              <>
                <CloudUpload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save to Drive</span>
                <span className="sm:hidden">Drive</span>
              </>
            )}
          </button>

          <button 
            onClick={handlePrint}
            className="bg-slate-700 hover:bg-slate-600 text-slate-100 px-3 py-1.5 rounded-xl font-bold shadow-sm flex items-center gap-1.5 transition-all text-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>

          <button 
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white rounded-full flex items-center justify-center transition-colors cursor-pointer ml-1"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Printable Certificate Area matching official PDF */}
      <div className="printable-area bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-3 sm:p-6 relative print:shadow-none print:max-w-4xl print:p-6 mb-8 shrink-0 border border-slate-200">
        
        {/* Outer Double Frame */}
        <div className="border-[2.5px] border-[#b03a2e] p-1 rounded-lg relative">
          <div className="border border-[#d97706] p-3 sm:p-5 relative rounded">
            
            {/* Corner Ornamental Accents */}
            <div className="absolute top-1.5 left-1.5 w-4 sm:w-5 h-4 sm:h-5 border-t-2 border-l-2 border-[#b03a2e] pointer-events-none">
              <div className="absolute top-0.5 left-0.5 w-2 h-2 border-t border-l border-[#d97706]"></div>
            </div>
            <div className="absolute top-1.5 right-1.5 w-4 sm:w-5 h-4 sm:h-5 border-t-2 border-r-2 border-[#b03a2e] pointer-events-none">
              <div className="absolute top-0.5 right-0.5 w-2 h-2 border-t border-r border-[#d97706]"></div>
            </div>
            <div className="absolute bottom-1.5 left-1.5 w-4 sm:w-5 h-4 sm:h-5 border-b-2 border-l-2 border-[#b03a2e] pointer-events-none">
              <div className="absolute bottom-0.5 left-0.5 w-2 h-2 border-b border-l border-[#d97706]"></div>
            </div>
            <div className="absolute bottom-1.5 right-1.5 w-4 sm:w-5 h-4 sm:h-5 border-b-2 border-r-2 border-[#b03a2e] pointer-events-none">
              <div className="absolute bottom-0.5 right-0.5 w-2 h-2 border-b border-r border-[#d97706]"></div>
            </div>

            {/* University Header */}
            <div className="flex items-center gap-3 sm:gap-4 pb-2">
              <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
                <img src="/rgukt.png" alt="RGUKT Logo" className="w-full h-full object-contain" onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }} />
              </div>
              
              <div className="flex-1 text-center pr-2 sm:pr-4">
                <h1 className="text-xs sm:text-sm md:text-base font-bold text-[#b03a2e] font-sans tracking-tight uppercase leading-snug">
                  RAJIV GANDHI UNIVERSITY OF KNOWLEDGE TECHNOLOGIES
                </h1>
                <p className="text-[8.5px] sm:text-[10px] text-slate-600 font-medium leading-tight mt-0.5">
                  (Constituted under the Act 18 of 2008, Govt. of Andhra Pradesh)
                </p>
                <p className="text-[9.5px] sm:text-[11px] font-bold text-slate-900 mt-0.5">
                  IIIT RK VALLEY CAMPUS, RGUKT-A.P.
                </p>
                <p className="text-[8px] sm:text-[9.5px] text-slate-500 leading-tight">
                  RK Valley (Idupulapaya), Vempalli (M), Y.S.R. Kadapa Dist., Andhra Pradesh - 516330
                </p>
              </div>
            </div>

            {/* Red & Gold Double Divider */}
            <div className="w-full h-[1.5px] bg-[#b03a2e] mb-0.5"></div>
            <div className="w-full h-[0.8px] bg-[#d97706] mb-2.5"></div>

            {/* Certificate Title Banner */}
            <div className="text-center my-1.5">
              <div className="inline-block bg-[#f0fdf4] border border-[#22c55e] px-6 sm:px-8 py-1 rounded-lg shadow-xs">
                <h2 className="text-xs sm:text-sm font-bold text-[#15803d] tracking-wide uppercase">
                  NO DUE CERTIFICATE (NDC)
                </h2>
                <p className="text-[7.5px] sm:text-[8.5px] font-bold text-[#166534] tracking-widest uppercase mt-0.5">
                  OFFICIAL GRADUATION & ALUMNI CLEARANCE
                </p>
              </div>
            </div>

            {/* Metadata Bar */}
            <div className="flex justify-between items-center text-[9px] sm:text-[10.5px] font-bold text-slate-700 px-1 mb-2">
              <span>Certificate No: <span className="font-mono text-slate-900">{certNumber}</span></span>
              <span>Issue Date: <span className="text-slate-900">{currentDate}</span></span>
            </div>

            {/* Student Particulars Box */}
            <div className="bg-slate-50/90 border border-slate-200 rounded-lg p-2.5 sm:p-3 mb-2.5 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[10.5px] sm:text-[11.5px]">
                <div className="flex justify-between sm:justify-start gap-2">
                  <span className="text-slate-600 font-medium sm:w-28 shrink-0">Student Name:</span>
                  <span className="font-bold text-[#b03a2e] uppercase">{student.name}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-2">
                  <span className="text-slate-600 font-medium sm:w-32 shrink-0">Department:</span>
                  <span className="font-bold text-slate-900">{resolvedBranch}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-2">
                  <span className="text-slate-600 font-medium sm:w-28 shrink-0">Student ID:</span>
                  <span className="font-bold text-slate-900 font-mono">{(student.studentId || 'N/A').toUpperCase()}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-2">
                  <span className="text-slate-600 font-medium sm:w-32 shrink-0">Hostel / Residence:</span>
                  <span className="font-bold text-slate-900">{resolvedHostel}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-2">
                  <span className="text-slate-600 font-medium sm:w-28 shrink-0">Program:</span>
                  <span className="font-bold text-slate-900">{resolvedProgram}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-2">
                  <span className="text-slate-600 font-medium sm:w-32 shrink-0">Clearance Status:</span>
                  <span className="font-bold text-emerald-600">FULLY CLEARED (ZERO DUES)</span>
                </div>
              </div>
            </div>

            {/* Certification Statement */}
            <div className="text-[9.5px] sm:text-[10.5px] text-slate-700 leading-relaxed text-left space-y-1 mb-2.5">
              <p>
                This is to certify that <strong className="text-slate-900 uppercase">{student.name}</strong> (ID: <strong className="font-mono text-slate-900">{(student.studentId || '').toUpperCase()}</strong>) enrolled in the <strong className="text-slate-900">{resolvedProgram}</strong> program has successfully reconciled and fulfilled all institutional clearance requirements across all academic departments, campus laboratories, student hostels, central library, sports, and administrative sections of Rajiv Gandhi University of Knowledge Technologies.
              </p>
              <p>
                There are NO OUTSTANDING DUES, materials, hardware equipment, library volumes, sports apparatus, or financial obligations pending against the student in any registry of the University. The student is hereby granted full, unconditional clearance for graduation, degree conferment, and issuance of transfer and conduct documents.
              </p>
            </div>

            {/* Department Clearances Table (Real Flow & Actual Order) */}
            <div className="overflow-x-auto mb-3 rounded border border-slate-200">
              <table className="w-full text-left text-[8.5px] sm:text-[9.5px] border-collapse">
                <thead>
                  <tr className="bg-[#b03a2e] text-white">
                    <th className="py-1 px-2 font-bold">University Department / Section</th>
                    <th className="py-1 px-2 font-bold">Clearance Authority</th>
                    <th className="py-1 px-2 font-bold">Formal Clearance State</th>
                    <th className="py-1 px-2 font-bold text-center">Verification Seal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {tableRows.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="py-0.5 sm:py-1 px-2 font-bold text-slate-800">{row.dept}</td>
                      <td className="py-0.5 sm:py-1 px-2 text-slate-600">{row.auth}</td>
                      <td className="py-0.5 sm:py-1 px-2 font-bold text-[#166534]">{row.state}</td>
                      <td className="py-0.5 sm:py-1 px-2 font-bold text-blue-600 text-center tracking-wider text-[8px] sm:text-[9px]">
                        VERIFIED ONLINE
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Digital Signatures & Central Seal */}
            <div className="flex justify-between items-center pt-1 pb-2 px-2 sm:px-6">
              
              {/* Left: Administrative Officer */}
              <div className="text-center">
                <span className="font-serif text-[10.5px] sm:text-xs text-blue-900/80 italic transform -rotate-2 block mb-0.5">
                  Approved Digitally
                </span>
                <div className="w-28 sm:w-36 h-[1px] bg-slate-400 mx-auto mb-0.5"></div>
                <p className="font-bold text-slate-900 text-[9.5px] sm:text-[10.5px]">Administrative Officer</p>
                <p className="text-[7.5px] sm:text-[8.5px] text-slate-500">RGUKT-A.P., IIIT RK Valley</p>
              </div>

              {/* Center: Official Seal Badge */}
              <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full border-2 border-[#22c55e] bg-[#f0fdf4] flex flex-col items-center justify-center text-center p-1 shadow-xs shrink-0">
                <span className="text-[5px] sm:text-[5.5px] font-bold text-[#166534] uppercase tracking-wider">OFFICIAL SEAL</span>
                <span className="text-[6.5px] sm:text-[7.5px] font-extrabold text-[#15803d] uppercase tracking-wide leading-tight">VERIFIED</span>
                <span className="text-[5px] sm:text-[5.5px] font-bold text-[#166534] uppercase tracking-wider">DIGITAL NDC</span>
              </div>

              {/* Right: Director */}
              <div className="text-center">
                <span className="font-serif text-[10.5px] sm:text-xs text-blue-900/80 italic transform -rotate-2 block mb-0.5">
                  Approved Digitally
                </span>
                <div className="w-28 sm:w-36 h-[1px] bg-slate-400 mx-auto mb-0.5"></div>
                <p className="font-bold text-slate-900 text-[9.5px] sm:text-[10.5px]">Director</p>
                <p className="text-[7.5px] sm:text-[8.5px] text-slate-500">RGUKT-A.P., IIIT RK Valley</p>
              </div>

            </div>

            {/* Official Footer Note */}
            <div className="border-t border-slate-200 pt-1 text-center text-[7px] sm:text-[8px] text-slate-400 leading-tight">
              <p>Official Document - RGUKT Clearance Automation Hub - Valid without physical seal if verified online</p>
              <p className="mt-0.5">Certificate Authentication Reference: <span className="font-mono">{certNumber}</span></p>
            </div>

          </div>
        </div>
      </div>
      
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
            background: white !important;
          }
          body * {
            visibility: hidden;
          }
          .printable-area, .printable-area * {
            visibility: visible;
          }
          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 6mm !important;
            box-sizing: border-box;
            background: white !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
      `}} />

      {/* Google Drive Upload Animated Modal */}
      <DriveUploadModal
        isOpen={driveModalOpen}
        onClose={() => setDriveModalOpen(false)}
        status={driveUploadStatus}
        fileName={`${student.studentId}_Official_No_Due_Certificate.pdf`}
        shareableUrl={driveShareableUrl}
        errorMessage={driveErrorMessage}
        onRetry={handleSaveToDrive}
      />
    </div>
  );
}
