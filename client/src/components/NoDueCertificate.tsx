import { useState } from 'react';
import { Printer, X, Download, CloudUpload } from 'lucide-react';
import { generateNDCPdfBlob, downloadPdfDirectly, uploadNdcToDrive } from '../utils/pdfGenerator';
import DriveUploadModal from './DriveUploadModal';

interface NoDueCertificateProps {
  student: {
    name: string;
    studentId: string;
    program: string;
    department?: string;
    hostel?: string;
  };
  onClose: () => void;
}

export default function NoDueCertificate({ student, onClose }: NoDueCertificateProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveUploadStatus, setDriveUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [driveShareableUrl, setDriveShareableUrl] = useState<string | null>(null);
  const [driveErrorMessage, setDriveErrorMessage] = useState<string | null>(null);

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      const blob = await generateNDCPdfBlob(student);
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
      const blob = await generateNDCPdfBlob(student);
      const res = await uploadNdcToDrive(blob, `${student.studentId}_Official_No_Due_Certificate.pdf`);
      setDriveShareableUrl(res.shareableUrl || null);
      setDriveUploadStatus('success');
    } catch (err: any) {
      console.error('Failed to save to Google Drive:', err);
      setDriveErrorMessage(err.message || 'Failed to save certificate to Google Drive.');
      setDriveUploadStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 z-[200] print:bg-white print:p-0 overflow-y-auto">
      
      {/* Non-printable controls */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 flex flex-wrap gap-2 sm:gap-3 print:hidden z-[210]">
        <button
          onClick={handleDownloadPdf}
          disabled={isDownloading}
          className="bg-emerald-600 text-white px-3.5 py-2 sm:px-5 sm:py-2 rounded-full font-bold shadow-lg flex items-center gap-1.5 sm:gap-2 hover:bg-emerald-700 transition-colors text-xs sm:text-sm cursor-pointer disabled:opacity-60"
        >
          <Download className="w-4 h-4" /> {isDownloading ? 'Downloading...' : 'Download PDF'}
        </button>
        <button
          onClick={handleSaveToDrive}
          disabled={driveUploadStatus === 'uploading'}
          className="bg-blue-600 text-white px-3.5 py-2 sm:px-5 sm:py-2 rounded-full font-bold shadow-lg flex items-center gap-1.5 sm:gap-2 hover:bg-blue-700 transition-colors text-xs sm:text-sm cursor-pointer disabled:opacity-60"
        >
          <CloudUpload className="w-4 h-4" /> {driveUploadStatus === 'uploading' ? 'Saving...' : 'Save to Drive'}
        </button>
        <button 
          onClick={handlePrint}
          className="bg-white text-primary px-3.5 py-2 sm:px-5 sm:py-2 rounded-full font-bold shadow-lg flex items-center gap-1.5 sm:gap-2 hover:bg-surface-variant transition-colors text-xs sm:text-sm cursor-pointer"
        >
          <Printer className="w-4 h-4" /> Print
        </button>
        <button 
          onClick={onClose}
          className="w-8 h-8 sm:w-10 sm:h-10 bg-white text-primary rounded-full shadow-lg flex items-center justify-center hover:bg-error hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Printable Certificate Area */}
      <div className="printable-area bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-4 sm:p-6 relative overflow-hidden print:shadow-none print:max-w-4xl print:p-8 mt-16 sm:mt-0 mb-8 sm:mb-0 shrink-0">
        
        {/* Background decorative elements */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-blue-50 rounded-full opacity-50 blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-purple-50 rounded-full opacity-50 blur-3xl"></div>

        <div className="border-[6px] sm:border-[8px] border-double border-slate-200 p-4 sm:p-8 relative z-10 text-center bg-white/50 backdrop-blur-sm rounded-xl">
          
          <div className="flex items-center justify-between mb-6 sm:mb-8 border-b border-slate-300 pb-4 sm:pb-6">
            <div className="w-12 h-12 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
              <img src="/rgukt.png" alt="RGUKT Logo" className="w-full h-full object-contain" />
            </div>
            
            <div className="flex-1 text-center px-1 sm:px-2">
              <h1 className="text-[10px] sm:text-[13px] md:text-[16px] lg:text-[19px] font-bold text-[#b03a2e] mb-1 font-sans whitespace-nowrap">
                Rajiv Gandhi University of Knowledge Technologies
              </h1>
              <p className="text-[8px] sm:text-[10px] md:text-xs text-slate-700 font-medium leading-tight">
                (A.P. Government Act 18 of 2008)<br />
                IIIT RK Valley, RGUKT-A.P.<br />
                RK Valley (Idupulapaya), Vempalli (M), Y.S.R. Kadapa (Dist.), A.P-516330
              </p>
            </div>
            
            {/* Invisible spacer to perfectly center the text despite the left logo */}
            <div className="w-12 sm:w-20 shrink-0 hidden md:block"></div>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-blue-700 mb-4 sm:mb-6 font-serif border-b-2 border-blue-100 inline-block pb-1 sm:pb-2 px-4 sm:px-6">
            NO DUE CERTIFICATE
          </h2>

          <div className="text-sm sm:text-base text-slate-700 leading-relaxed max-w-xl mx-auto space-y-3 sm:space-y-4">
            <p>
              This is to certify that
            </p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 uppercase">
              {student.name}
            </p>
            <p>
              Bearing Student ID <span className="font-bold text-slate-900">{student.studentId}</span> and enrolled in the <span className="font-bold text-slate-900">{student.program}</span> program, has successfully completed the clearance process on <span className="font-bold text-slate-900">{currentDate}</span>.
            </p>
            <p>
              There are no outstanding dues, materials, or obligations pending with any department, laboratory, hostel, or administration office of the University.
            </p>
          </div>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-between items-center sm:items-end px-4 sm:px-12 gap-6 sm:gap-0">
            
            {/* Left: AO */}
            <div className="text-center">
              <div className="h-8 sm:h-12 flex items-end justify-center mb-1">
                <span className="font-serif text-lg sm:text-xl text-blue-900/60 italic transform -rotate-2 block">Approved Digitally</span>
              </div>
              <p className="font-bold text-slate-900 border-t border-slate-300 pt-1 sm:pt-2 w-40 text-center text-xs sm:text-sm">Administrative Officer</p>
            </div>
            
            {/* Right: Director */}
            <div className="text-center">
              <div className="h-8 sm:h-12 flex items-end justify-center mb-1">
                <span className="font-serif text-lg sm:text-xl text-blue-900/60 italic transform -rotate-2 block">Approved Digitally</span>
              </div>
              <p className="font-bold text-slate-900 border-t border-slate-300 pt-1 sm:pt-2 w-40 text-center text-xs sm:text-sm">Director</p>
            </div>

          </div>
          
        </div>
      </div>
      
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          html, body {
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          body * {
            visibility: hidden;
          }
          .printable-area {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm !important;
            height: 297mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 15mm !important;
            box-sizing: border-box;
            background: white !important;
            border-radius: 0 !important;
          }
          .printable-area > div {
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          .printable-area * {
            visibility: visible;
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
