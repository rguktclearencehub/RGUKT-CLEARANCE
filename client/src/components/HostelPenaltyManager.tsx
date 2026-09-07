import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, setDoc, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, AlertCircle, PlusCircle, CheckCircle2, Trash2 } from 'lucide-react';

export default function HostelPenaltyManager() {
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [student, setStudent] = useState<any>(null);
  const [searchError, setSearchError] = useState('');

  const [penalties, setPenalties] = useState<any[]>([]);
  const [isFetchingPenalties, setIsFetchingPenalties] = useState(false);

  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;
    
    setIsSearching(true);
    setSearchError('');
    setStudent(null);
    setPenalties([]);

    try {
      const q = query(collection(db, 'students'), where('studentId', '==', searchId.toUpperCase().trim()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setSearchError('Student not found. Please check the College ID.');
      } else {
        const studentData = snap.docs[0].data();
        setStudent(studentData);
        await fetchPenalties(studentData.studentId);
      }
    } catch (err) {
      console.error(err);
      setSearchError('Error searching database.');
    } finally {
      setIsSearching(false);
    }
  };

  const fetchPenalties = async (sid: string) => {
    setIsFetchingPenalties(true);
    try {
      const q = query(collection(db, 'hostelPenalties'), where('studentId', '==', sid));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // sort by date descending manually if no index exists
      data.sort((a: any, b: any) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dbTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dbTime - da;
      });
      setPenalties(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingPenalties(false);
    }
  };

  const handleAddPenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !reason.trim() || !amount) return;

    setIsAdding(true);
    try {
      const newPenalty = {
        studentId: student.studentId,
        reason: reason.trim(),
        amount: parseInt(amount, 10),
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'hostelPenalties'), newPenalty);
      
      // Refresh list
      await fetchPenalties(student.studentId);
      setReason('');
      setAmount('');
      
    } catch (err) {
      console.error(err);
      alert('Failed to add penalty.');
    } finally {
      setIsAdding(false);
    }
  };

  // Helper to format name
  const formatName = (name: string, id: string) => {
    if (!name || !id) return name || '';
    const regex = new RegExp('^' + id, 'i');
    return name.replace(regex, '').trim() || name;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/30 shadow-sm">
        <h2 className="font-headline-md text-2xl font-bold text-primary mb-2">Hostel Penalty Manager</h2>
        <p className="text-on-surface-variant font-body-md mb-6">Search for a student to view and add damage or breakage charges.</p>
        
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
            <input 
              type="text" 
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Enter College ID (e.g. R240384)" 
              className="w-full pl-12 pr-4 py-3 bg-surface border border-outline-variant/50 rounded-xl text-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors uppercase" 
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={isSearching}
            className="bg-primary hover:bg-primary-fixed text-on-primary px-8 py-3 rounded-xl font-label-lg font-semibold transition-colors shadow-sm disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchError && (
          <div className="mt-4 p-4 bg-error-container/20 border border-error-container text-error rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-label-md font-semibold">{searchError}</span>
          </div>
        )}
      </div>

      {student && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Student Info & Add Penalty Form */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                <span className="text-2xl font-bold">{student.name ? formatName(student.name, student.studentId).charAt(0).toUpperCase() : 'S'}</span>
              </div>
              <h3 className="font-headline-sm font-bold text-on-surface">{formatName(student.name, student.studentId)}</h3>
              <p className="text-on-surface-variant font-label-md mt-1">{student.studentId} • {student.program}</p>
            </div>

            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm">
              <h4 className="font-label-lg font-bold text-on-surface mb-4">Add New Penalty</h4>
              <form onSubmit={handleAddPenalty} className="space-y-4">
                <div>
                  <label className="block font-label-sm text-on-surface-variant mb-1">Reason (Damage/Breakage)</label>
                  <input 
                    type="text" 
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Broken window pane" 
                    className="w-full px-3 py-2 bg-surface border border-outline-variant/50 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    required
                  />
                </div>
                <div>
                  <label className="block font-label-sm text-on-surface-variant mb-1">Amount (₹)</label>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 500" 
                    className="w-full px-3 py-2 bg-surface border border-outline-variant/50 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    required
                    min="1"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isAdding}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-lg font-label-md font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <PlusCircle className="w-5 h-5" />
                  {isAdding ? 'Adding...' : 'Add Penalty'}
                </button>
              </form>
            </div>
          </div>

          {/* Penalty History Table */}
          <div className="lg:col-span-2">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm h-full flex flex-col">
              <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center">
                <h4 className="font-headline-sm font-bold text-on-surface">Penalty History</h4>
                <div className="bg-surface-variant/30 px-3 py-1 rounded-full text-sm font-semibold text-on-surface-variant">
                  {penalties.length} Records
                </div>
              </div>
              
              <div className="p-6 flex-1">
                {isFetchingPenalties ? (
                  <div className="h-40 flex items-center justify-center text-on-surface-variant">Loading penalties...</div>
                ) : penalties.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-center text-on-surface-variant">
                    <CheckCircle2 className="w-12 h-12 text-green-500/50 mb-2" />
                    <p className="font-label-md">No penalties found for this student.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {penalties.map(penalty => (
                      <div key={penalty.id} className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/30 hover:bg-surface/50 transition-colors">
                        <div>
                          <p className="font-label-lg font-bold text-on-surface">{penalty.reason}</p>
                          <p className="text-xs text-on-surface-variant mt-1">
                            {new Date(penalty.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <span className="font-headline-sm font-bold text-amber-700">₹{penalty.amount}</span>
                          <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${penalty.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                            {penalty.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
