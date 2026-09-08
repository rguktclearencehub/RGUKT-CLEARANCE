import React, { useState } from 'react';
import { CloudUpload, CheckCircle2, AlertCircle, Copy, Check, X, FileText, ExternalLink } from 'lucide-react';

export interface DriveUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: 'idle' | 'uploading' | 'success' | 'error';
  fileName?: string;
  shareableUrl?: string | null;
  errorMessage?: string | null;
  onRetry?: () => void;
}

export default function DriveUploadModal({
  isOpen,
  onClose,
  status,
  fileName = 'Official_No_Due_Certificate.pdf',
  shareableUrl,
  errorMessage,
  onRetry
}: DriveUploadModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || status === 'idle') return null;

  const handleCopyLink = () => {
    if (!shareableUrl) return;
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-md flex items-center justify-center p-4 z-[300] animate-in fade-in duration-300">
      <style>{`
        @keyframes driveIndeterminate {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(110%); }
          100% { transform: translateX(330%); }
        }
        @keyframes driveCheckPop {
          0% { transform: scale(0.3); opacity: 0; }
          60% { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes drivePulseRing {
          0% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.25); opacity: 0.2; }
          100% { transform: scale(0.95); opacity: 0.7; }
        }
      `}</style>
      <div 
        className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 relative overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Gradient Decorative Bar */}
        <div className={`absolute top-0 left-0 w-full h-1.5 transition-colors duration-500 ${
          status === 'uploading' 
            ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 animate-pulse' 
            : status === 'success' 
            ? 'bg-gradient-to-r from-emerald-500 to-green-600' 
            : 'bg-red-500'
        }`} />

        {/* Close button (available once not actively uploading) */}
        {status !== 'uploading' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* UPLOADING STATE ANIMATION */}
        {status === 'uploading' && (
          <div className="flex flex-col items-center text-center py-4">
            {/* Animated Concentric Pulsing Rings */}
            <div className="relative mb-6 flex items-center justify-center">
              <div 
                className="w-24 h-24 rounded-full bg-blue-100/60 absolute"
                style={{ animation: 'drivePulseRing 2s ease-in-out infinite' }}
              />
              <div className="w-20 h-20 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center relative z-10 shadow-inner">
                <CloudUpload className="w-10 h-10 text-blue-600 animate-bounce" />
              </div>
            </div>

            <h3 className="font-headline-md text-2xl font-bold text-slate-900 mb-2">
              Uploading to Google Drive...
            </h3>
            <p className="text-sm text-slate-600 max-w-xs mb-6 leading-relaxed">
              Securing and uploading your official No Due Certificate to your Google Drive storage.
            </p>

            {/* Smooth Infinite Loading Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden relative shadow-inner p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-500 rounded-full w-2/5"
                style={{ animation: 'driveIndeterminate 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
              />
            </div>

            <span className="text-xs font-semibold text-blue-600 mt-4 tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
              Please wait while uploading...
            </span>
          </div>
        )}

        {/* SUCCESS STATE ANIMATION */}
        {status === 'success' && (
          <div className="flex flex-col items-center text-center py-2 animate-in zoom-in-95 duration-400">
            {/* Success Checkmark with Pop Animation */}
            <div 
              className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm"
              style={{ animation: 'driveCheckPop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
            >
              <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            </div>

            <h3 className="font-headline-md text-2xl font-bold text-slate-900 mb-1.5">
              Uploaded to Google Drive!
            </h3>
            <p className="text-sm text-slate-600 mb-5 max-w-xs">
              Your official certificate has been backed up to Google Drive successfully.
            </p>

            {/* Document Card Info */}
            <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-5 text-left flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-xs">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block font-bold text-xs text-slate-800 truncate" title={fileName}>
                  {fileName}
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" /> Backed up to Cloud
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full space-y-2.5">
              {shareableUrl && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-600" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <a
                    href={shareableUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-blue-200 shadow-xs cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open in Drive</span>
                  </a>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md hover:shadow-emerald-600/25 cursor-pointer active:scale-98"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {status === 'error' && (
          <div className="flex flex-col items-center text-center py-2 animate-in zoom-in-95 duration-400">
            <div className="w-20 h-20 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 shadow-sm">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>

            <h3 className="font-headline-md text-2xl font-bold text-slate-900 mb-2">
              Upload Failed
            </h3>
            <p className="text-sm text-slate-600 mb-6 max-w-xs leading-relaxed">
              {errorMessage || 'Unable to save certificate to Google Drive. Please check your internet connection and try again.'}
            </p>

            <div className="w-full flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
