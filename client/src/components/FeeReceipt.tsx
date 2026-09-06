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

  const fees = clearances.filter(d => d.feeDue > 0);

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

      {/* Printable Receipt Area */}
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-4 sm:p-6 relative overflow-hidden print:shadow-none print:max-w-3xl print:p-8 mt-16 sm:mt-0 mb-8 sm:mb-0 shrink-0">
        
        {/* Background decorative elements */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-green-50 rounded-full opacity-50 blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-blue-50 rounded-full opacity-50 blur-3xl"></div>

        <div className="border-[6px] sm:border-[8px] border-double border-slate-200 p-4 sm:p-8 relative z-10 bg-white/50 backdrop-blur-sm rounded-xl">
          
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
            
            <div className="w-12 sm:w-20 shrink-0 hidden md:block"></div>
          </div>

          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-bold text-green-700 font-serif border-b-2 border-green-200 inline-block pb-1 sm:pb-2 px-4 sm:px-6">
              OFFICIAL FEE RECEIPT
            </h2>
          </div>

          <div className="flex justify-between items-start text-sm sm:text-base text-slate-700 mb-6 sm:mb-8">
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

          <div className="mb-6 sm:mb-8 border border-slate-300 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm sm:text-base">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-300">
                <tr>
                  <th className="py-3 px-4 font-bold">Department</th>
                  <th className="py-3 px-4 font-bold text-right">Fee Due (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {fees.map((f, idx) => (
                  <tr key={idx} className="bg-white">
                    <td className="py-3 px-4 font-medium text-slate-700">{f.departmentName}</td>
                    <td className="py-3 px-4 font-medium text-slate-900 text-right">₹{f.feeDue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <th className="py-4 px-4 font-bold text-slate-800 text-lg">Total Amount Paid</th>
                  <th className="py-4 px-4 font-bold text-green-700 text-right text-lg">₹{totalFeeDue.toFixed(2)}</th>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-center">
            <p className="text-green-800 font-medium text-sm sm:text-base">
              Payment successfully received and verified against Reference ID: 
              <span className="block text-green-900 font-bold text-lg mt-1 tracking-wider">{paymentReferenceId}</span>
            </p>
          </div>

          <div className="mt-8 sm:mt-12 text-center">
            <div className="h-8 sm:h-12 flex items-end justify-center mb-1">
              <span className="font-serif text-lg sm:text-xl text-blue-900/60 italic transform -rotate-2 block">Accounts Verified</span>
            </div>
            <p className="font-bold text-slate-900 border-t border-slate-300 pt-1 sm:pt-2 w-48 text-center text-xs sm:text-sm mx-auto">
              Finance Office (FO)
            </p>
          </div>
          
        </div>
      </div>
      
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:bg-white {
            background-color: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:p-8 {
            padding: 2rem !important;
          }
          .fixed {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
          }
          .z-\\[200\\] > div:last-child {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .z-\\[200\\] > div:last-child * {
            visibility: visible;
          }
        }
      `}} />
    </div>
  );
}
