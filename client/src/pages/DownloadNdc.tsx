import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  generateNDCPdfBlob,
  downloadPdfDirectly,
  uploadNdcToDrive,
  getDrivePreviewLink,
  convertDriveShareableToDownloadUrl
} from '../utils/pdfGenerator';
import { Award, Download, ExternalLink, ArrowLeft, CheckCircle2, AlertCircle, CloudUpload } from 'lucide-react';
import DriveUploadModal from '../components/DriveUploadModal';

export default function DownloadNdc() {
  const [searchParams] = useSearchParams();
  const reqId = searchParams.get('reqId') || searchParams.get('id');
  const studentId = searchParams.get('studentId') || searchParams.get('student_id');

  const [loading, setLoading] = useState(true);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveUploadStatus, setDriveUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [driveErrorMessage, setDriveErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadAndGenerateNdc() {
      if (!studentId && !reqId) {
        setError('Missing student or clearance reference parameter.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        let requestData: any = null;

        if (reqId) {
          const reqSnap = await getDoc(doc(db, 'clearanceRequests', reqId));
          if (reqSnap.exists()) {
            requestData = { id: reqSnap.id, ...reqSnap.data() };
            if (requestData.ndcDriveFileId) {
              setDriveFileId(requestData.ndcDriveFileId);
            }
            if (requestData.ndcDriveUrl || requestData.ndcDownloadUrl) {
              setDriveUrl(requestData.ndcDriveUrl || requestData.ndcDownloadUrl);
            }
          }
        }

        const sid = studentId || requestData?.studentId || '';
        const sData = {
          name: requestData?.studentName || requestData?.student?.name || requestData?.name || sid,
          studentId: sid,
          program: requestData?.programType || requestData?.program || 'B.Tech',
          department: requestData?.department || requestData?.branch || '',
          hostel: requestData?.presentHostel || requestData?.hostel || ''
        };

        setStudentInfo(sData);

        // Generate official vector No Due Certificate PDF
        const blob = await generateNDCPdfBlob(sData, requestData);
        setPdfBlob(blob);

        // Automatically trigger browser download
        downloadPdfDirectly(blob, `${sid}_Official_No_Due_Certificate.pdf`);
        setDownloaded(true);
      } catch (err: any) {
        console.error('Failed to generate NDC certificate:', err);
        setError(err.message || 'Unable to generate official NDC certificate. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadAndGenerateNdc();
  }, [reqId, studentId]);

  const handleManualDownload = () => {
    if (pdfBlob && studentInfo) {
      downloadPdfDirectly(pdfBlob, `${studentInfo.studentId}_Official_No_Due_Certificate.pdf`);
      setDownloaded(true);
    }
  };

  const handleSyncToDrive = async () => {
    if (!pdfBlob || !studentInfo) return;
    setDriveModalOpen(true);
    setDriveUploadStatus('uploading');
    setDriveErrorMessage(null);
    try {
      setIsUploadingToDrive(true);
      const res = await uploadNdcToDrive(pdfBlob, `${studentInfo.studentId}_Official_No_Due_Certificate.pdf`);
      if (res.fileId) setDriveFileId(res.fileId);
      if (res.shareableUrl) setDriveUrl(res.shareableUrl);
      setDriveUploadStatus('success');
    } catch (err: any) {
      console.error('Drive upload failed:', err);
      setDriveErrorMessage(err.message || 'Could not upload to Google Drive');
      setDriveUploadStatus('error');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 antialiased">
      <div className="bg-white max-w-lg w-full rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* University Header Banner */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-green-900 p-6 text-center text-white relative">
          <div className="w-16 h-16 bg-white rounded-full p-2 mx-auto mb-3 shadow-md flex items-center justify-center">
            <img src="/rgukt.png" alt="RGUKT Seal" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-lg font-bold uppercase tracking-wide">Rajiv Gandhi University of Knowledge Technologies</h2>
          <p className="text-xs text-emerald-100 mt-0.5">IIIT RK Valley Campus • Digital Clearance Hub</p>
        </div>

        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Generating Official No Due Certificate...</h3>
                <p className="text-xs text-slate-500 mt-1">Verifying departmental clearances and compiling vector PDF certificate</p>
              </div>
            </div>
          ) : error ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Could Not Generate Certificate</h3>
                <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">{error}</p>
              </div>
              <Link
                to="/student/dashboard"
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Go to Student Portal
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Success Notification */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">Official Certificate Ready!</h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Your official university No Due Certificate (NDC) PDF has been generated and download initiated.
                  </p>
                </div>
              </div>

              {/* Student Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Student Name:</span>
                  <span className="font-bold text-slate-800">{studentInfo?.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Student ID:</span>
                  <span className="font-bold text-slate-800">{studentInfo?.studentId}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Clearance Status:</span>
                  <span className="font-bold text-emerald-700">FULLY CLEARED (ZERO DUES)</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-700 font-bold">Document Type:</span>
                  <span className="font-extrabold text-emerald-800 text-sm">Official NDC (Vector PDF)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  onClick={handleManualDownload}
                  className="w-full bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Download NDC PDF Again
                </button>

                <button
                  onClick={handleSyncToDrive}
                  disabled={isUploadingToDrive}
                  className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold py-2.5 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CloudUpload className="w-4 h-4" />
                  {isUploadingToDrive ? 'Uploading to Drive...' : 'Save to Google Drive'}
                </button>

                {(driveFileId || driveUrl) && (
                  <a
                    href={driveFileId ? getDrivePreviewLink(driveFileId) : driveUrl!}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold py-2.5 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 text-xs transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View on Google Drive
                  </a>
                )}

                <Link
                  to="/student/dashboard"
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 text-xs transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Return to Student Clearance Hub
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 text-center">
          <p className="text-[11px] text-slate-500">
            RGUKT Clearance Hub • Valid without physical seal if verified online
          </p>
        </div>
      </div>

      {/* Google Drive Upload Animated Modal */}
      <DriveUploadModal
        isOpen={driveModalOpen}
        onClose={() => setDriveModalOpen(false)}
        status={driveUploadStatus}
        fileName={`${studentInfo?.studentId || 'Student'}_Official_No_Due_Certificate.pdf`}
        shareableUrl={driveUrl}
        errorMessage={driveErrorMessage}
        onRetry={handleSyncToDrive}
      />
    </div>
  );
}
