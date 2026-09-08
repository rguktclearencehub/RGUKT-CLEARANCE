import { Printer, X, CheckCircle2 } from 'lucide-react';

interface FeeReceiptProps {
  student: {
    name: string;
    studentId: string;
    program: string;
  };
  clearances: any[];
  totalFeeDue: number;
  paymentReferenceId: string;
  onClose: () => void;
}

export default function FeeReceipt({ student, clearances, totalFeeDue, paymentReferenceId, onClose }: FeeReceiptProps) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  const fees = clearances.filter(d => (d.feeDue > 0 || d.status_fee === 'PAID'));

  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 z-[200] print:bg-white print:p-0 overflow-y-auto">
      
      {/* Non-printable controls */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 flex gap-3 print:hidden z-[210]">
        <button 
          onClick={handlePrint}
          className="bg-white text-primary px-4 py-2 sm:px-6 sm:py-2 rounded-full font-bold shadow-lg flex items-center gap-2 hover:bg-surface-variant transition-colors text-sm sm:text-base"
        >
          <Printer className="w-4 h-4 sm:w-5 sm:h-5" /> Download / Print
        </button>
        <button 
          onClick={onClose}
          className="w-9 h-9 sm:w-10 sm:h-10 bg-white text-primary rounded-full shadow-lg flex items-center justify-center hover:bg-error hover:text-white transition-colors"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* Main Printable Receipt Card */}
      <div className="bg-white text-slate-800 rounded-xl shadow-2xl p-4 sm:p-6 max-w-lg w-full border border-slate-200 print:shadow-none print:border-none print:m-0 print:p-0">
        
        {/* Border wrapper for classic look */}
        <div className="border-2 border-slate-800 p-4 sm:p-6 rounded-lg relative">
          
          {/* Header */}
          <div className="text-center border-b-2 border-slate-300 pb-3 sm:pb-4 mb-3 sm:mb-4">
            <h1 className="text-base sm:text-lg font-bold tracking-wide uppercase text-slate-900 font-serif">
              Rajiv Gandhi University of Knowledge Technologies
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-600 font-medium">Catering to the Educational Needs of Gifted Rural Youth</p>
            <p className="text-[9px] sm:text-[10px] text-slate-500">Andhra Pradesh / Telangana</p>
          </div>

          <div className="text-center mb-3 sm:mb-4">
            <h2 className="text-sm sm:text-base font-bold text-green-700 font-serif border-b-2 border-green-200 inline-block pb-1 px-4 sm:px-6">
              OFFICIAL FEE RECEIPT
            </h2>
          </div>

          <div className="flex justify-between items-start text-[10px] sm:text-xs text-slate-700 mb-3 sm:mb-4">
            <div>
              <p><span className="font-semibold text-slate-500 w-24 inline-block">Name:</span> <span className="font-bold text-slate-900">{student.name}</span></p>
              <p><span className="font-semibold text-slate-500 w-24 inline-block">Student ID:</span> <span className="font-bold text-slate-900">{student.studentId}</span></p>
              <p><span className="font-semibold text-slate-500 w-24 inline-block">Program:</span> <span className="font-bold text-slate-900">{student.program}</span></p>
            </div>
            <div className="text-right">
              <p><span className="font-semibold text-slate-500">Date:</span> <span className="font-bold text-slate-900">{currentDate}</span></p>
              <p className="mt-2 flex items-center justify-end gap-1 text-green-700 font-bold">
                <CheckCircle2 className="w-4 h-4" /> Verified
              </p>
            </div>
          </div>

          <div className="mb-3 sm:mb-4 border border-slate-300 rounded-lg overflow-hidden">
            <table className="w-full text-left text-[10px] sm:text-xs">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-300">
                <tr>
                  <th className="py-1 px-2 font-bold">Department</th>
                  <th className="py-1 px-2 font-bold text-right">Fee Due (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {fees.length > 0 ? (
                  fees.map((f, idx) => (
                    <tr key={idx} className="bg-white">
                      <td className="py-1 px-2 font-medium text-slate-700">{f.departmentName}</td>
                      <td className="py-1 px-2 font-medium text-slate-900 text-right">₹{(f.feeDue || 0).toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="bg-white">
                    <td colSpan={2} className="py-2.5 px-2 text-center text-slate-600 font-medium italic">
                      All university department dues cleared & verified
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-bold text-slate-800 text-sm">Total Amount Paid</th>
                  <th className="py-1.5 px-2 font-bold text-green-700 text-right text-sm">₹{(totalFeeDue || 0).toFixed(2)}</th>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-md p-2 mb-3 sm:mb-4 text-center">
            <p className="text-green-800 font-medium text-[10px] sm:text-xs">
              Payment successfully received and verified against Reference ID: 
              <span className="block text-green-900 font-bold text-sm mt-0.5 tracking-wider">{paymentReferenceId}</span>
            </p>
          </div>

          <div className="mt-3 sm:mt-4 text-center">
            <div className="h-4 sm:h-8 flex items-end justify-center mb-1">
              <span className="font-serif text-xs sm:text-sm text-blue-900/60 italic transform -rotate-2 block">Accounts Verified</span>
            </div>
            <p className="font-bold text-slate-900 border-t border-slate-300 pt-1 w-40 text-center text-[10px] sm:text-xs mx-auto">
              Finance Office (FO)
            </p>
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
    </div>
  );
}
