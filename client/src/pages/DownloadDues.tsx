import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  fetchDetailedStudentDues,
  generateDuesPdfBlob,
  downloadPdfDirectly,
  getDrivePreviewLink,
  type DepartmentDuesGroup
} from '../utils/pdfGenerator';
import { FileText, Download, ExternalLink, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export default function DownloadDues() {
  const [searchParams] = useSearchParams();
  const reqId = searchParams.get('reqId') || searchParams.get('id');
  const studentId = searchParams.get('studentId') || searchParams.get('student_id');

  const [loading, setLoading] = useState(true);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [duesGroups, setDuesGroups] = useState<DepartmentDuesGroup[]>([]);
  const [grandTotal, setGrandTotal] = useState<number>(0);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);

  useEffect(() => {
    async function loadAndGeneratePdf() {
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
            if (requestData.duesPdfFileId) {
              setDriveFileId(requestData.duesPdfFileId);
            }
          }
        }

        const sid = studentId || requestData?.studentId || '';
        const { groups, grandTotal: total } = await fetchDetailedStudentDues(sid, requestData);

        const sData = {
          name: requestData?.studentName || requestData?.student?.name || requestData?.name || sid,
          studentId: sid,
          program: requestData?.programType || requestData?.program || 'PUC',
          department: requestData?.department || requestData?.branch || '',
          hostel: requestData?.presentHostel || requestData?.hostel || ''
        };

        setStudentInfo(sData);
        setDuesGroups(groups);
        setGrandTotal(total > 0 ? total : (requestData?.totalFeeDue || 0));

        // Generate official vector PDF
        const blob = await generateDuesPdfBlob(
          '',
          sData,
          groups,
          total > 0 ? total : (requestData?.totalFeeDue || 0)
        );

        setPdfBlob(blob);

        // Automatically trigger browser download
        downloadPdfDirectly(blob, `${sid}_Official_RGUKT_Dues_Report.pdf`);
        setDownloaded(true);
      } catch (err: any) {
        console.error('Failed to generate dues report:', err);
        setError(err.message || 'Unable to generate official statement. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadAndGeneratePdf();
  }, [reqId, studentId]);

  const handleManualDownload = () => {
    if (pdfBlob && studentInfo) {
      downloadPdfDirectly(pdfBlob, `${studentInfo.studentId}_Official_RGUKT_Dues_Report.pdf`);
      setDownloaded(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 antialiased">
      <div className="bg-white max-w-lg w-full rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* University Header Banner */}
        <div className="bg-gradient-to-r from-red-800 via-red-700 to-red-900 p-6 text-center text-white relative">
          <div className="w-16 h-16 bg-white rounded-full p-2 mx-auto mb-3 shadow-md flex items-center justify-center">
            <img src="/rgukt.png" alt="RGUKT Seal" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-lg font-bold uppercase tracking-wide">Rajiv Gandhi University of Knowledge Technologies</h2>
          <p className="text-xs text-red-100 mt-0.5">IIIT RK Valley Campus • Digital Clearance Hub</p>
        </div>

        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 border-4 border-red-700 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Generating Official Statement...</h3>
                <p className="text-xs text-slate-500 mt-1">Itemizing department penalties and compiling vector PDF report</p>
              </div>
            </div>
          ) : error ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Could Not Generate Statement</h3>
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
                  <h4 className="text-sm font-bold text-emerald-900">PDF Report Generated!</h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Your official university dues statement has been compiled and the download has started.
                  </p>
                </div>
              </div>

              {/* Student Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Student:</span>
                  <span className="font-bold text-slate-800">{studentInfo?.name} ({studentInfo?.studentId})</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Clearance Reference:</span>
                  <span className="font-bold text-slate-800">{reqId || 'Active Application'}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-700 font-bold">Total Dues Pending:</span>
                  <span className="font-extrabold text-red-600 text-sm">Rs. {grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  onClick={handleManualDownload}
                  className="w-full bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Download PDF Again
                </button>

                {driveFileId && (
                  <a
                    href={getDrivePreviewLink(driveFileId)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold py-2.5 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 text-xs transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View on Google Drive
                  </a>
                )}

                <Link
                  to="/student/dashboard"
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 text-xs transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Return to Student Clearance Dashboard
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
    </div>
  );
}
