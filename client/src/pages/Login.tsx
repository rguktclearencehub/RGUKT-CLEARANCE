import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { auth, googleProvider, db } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, writeBatch, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

const KNOWN_DEPARTMENT_EMAILS = [
  'hostel@university.edu',
  'sports@university.edu',
  'physicslab@university.edu',
  'chemistrylab@university.edu',
  'biologylab@university.edu',
  'coe@university.edu',
  'hod@university.edu',
  'library@university.edu',
  'itinfra@university.edu',
  'scholarshipoffice@university.edu',
  'fo@university.edu',
  'accounts@university.edu',
  'ao@university.edu',
  'director@university.edu',
  'deanofacademics@university.edu',
  'dsw@university.edu',
  'dsw@dept.rgukt.in'
];

export default function Login() {
  const [loginType, setLoginType] = useState<'student' | 'department'>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeptAlert, setShowDeptAlert] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        if (userData.role === 'STUDENT') {
          navigate('/student/dashboard', { replace: true });
        } else if (userData.role === 'ADMIN') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/department/dashboard', { replace: true });
        }
      } catch (e) {
        console.error("Error parsing stored user", e);
      }
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (loginType === 'student' && email.toLowerCase().endsWith('@dept.rgukt.in')) {
      setShowDeptAlert(true);
      setLoading(false);
      return;
    }
    
    try {
      let user;
      try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        user = result.user;
      } catch (signInErr: any) {
        if (signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/wrong-password') {
           try {
             const createResult = await createUserWithEmailAndPassword(auth, email, password);
             user = createResult.user;
           } catch (createErr: any) {
             if (createErr.code === 'auth/email-already-in-use') {
               throw new Error('Invalid password. Please try again.');
             }
             throw createErr;
           }
        } else {
           throw signInErr;
        }
      }
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      let userData;
      if (!userSnap.exists()) {
        const batch = writeBatch(db);
        
        let userRole = loginType === 'student' ? 'STUDENT' : 'DEPARTMENT';
        if (user.email && user.email.toLowerCase().startsWith('admin')) {
          userRole = 'ADMIN';
        }

        userData = {
          email: user.email,
          name: user.email?.split('@')[0] || 'Unknown',
          role: userRole,
          createdAt: new Date().toISOString()
        };
        batch.set(userRef, userData);
        
        if (loginType === 'student') {
          const studentRef = doc(db, 'students', user.uid);
          batch.set(studentRef, {
            userId: user.uid,
            studentId: `G-${Math.floor(Math.random() * 1000000)}`,
            program: 'B.Tech',
            year: 1,
          });
        }
        
        await batch.commit();
      } else {
        userData = userSnap.data();
        
        // Auto-fix accidentally incorrect roles for known departments
        if (user.email && (KNOWN_DEPARTMENT_EMAILS.includes(user.email.toLowerCase()) || user.email.toLowerCase().endsWith('@dept.rgukt.in')) && userData.role !== 'DEPARTMENT') {
          userData.role = 'DEPARTMENT';
          await updateDoc(userRef, { role: 'DEPARTMENT' });
        }
        
        // Auto-fix admin role
        if (user.email && user.email.toLowerCase().startsWith('admin') && userData.role !== 'ADMIN') {
          userData.role = 'ADMIN';
          await updateDoc(userRef, { role: 'ADMIN' });
        }
      }
      
      localStorage.setItem('user', JSON.stringify({ id: user.uid, ...userData }));
      
      if (userData.role === 'STUDENT') {
        navigate('/student/dashboard', { replace: true });
      } else if (userData.role === 'ADMIN') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/department/dashboard', { replace: true });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('gdrive_token', credential.accessToken);
      }
      const user = result.user;
      
      const emailLower = user.email?.trim().toLowerCase() || '';
      if (!(emailLower.endsWith('@rgukt.ac.in') || emailLower.endsWith('@rguktrkv.ac.in'))) {
        const rejectedEmail = user.email;
        await auth.signOut();
        throw new Error(`Email "${rejectedEmail}" is not allowed. Please use your @rgukt.ac.in or @rguktrkv.ac.in account.`);
      }
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      let userData;
      
      if (!userSnap.exists()) {
        const batch = writeBatch(db);
        const extractedId = user.email?.split('@')[0].toUpperCase() || '';
        
        const q = query(collection(db, 'students'), where('Collage ID', '==', extractedId));
        const querySnapshot = await getDocs(q);
        
        let fetchedName = user.displayName || user.email?.split('@')[0] || 'Unknown';
        if (!querySnapshot.empty) {
          const studentDoc = querySnapshot.docs[0].data();
          if (studentDoc.Name) fetchedName = studentDoc.Name;
        }
        
        userData = {
          email: user.email,
          name: fetchedName,
          role: loginType === 'student' ? 'STUDENT' : 'DEPARTMENT',
          createdAt: new Date().toISOString()
        };
        batch.set(userRef, userData);
        
        if (loginType === 'student') {
          const studentRef = doc(db, 'students', user.uid);
          batch.set(studentRef, {
            userId: user.uid,
            studentId: extractedId || `G-${Math.floor(Math.random() * 1000000)}`,
            program: 'B.Tech',
            year: 1,
          });
        }
        
        await batch.commit();
      } else {
        userData = userSnap.data();
        
        // Auto-fix accidentally incorrect roles for known departments
        if (user.email && KNOWN_DEPARTMENT_EMAILS.includes(user.email.toLowerCase()) && userData.role !== 'DEPARTMENT') {
          userData.role = 'DEPARTMENT';
          await updateDoc(userRef, { role: 'DEPARTMENT' });
        }
      }
      
      localStorage.setItem('user', JSON.stringify({ id: user.uid, ...userData }));
      
      if (userData.role === 'STUDENT') {
        navigate('/student/dashboard', { replace: true });
      } else if (userData.role === 'ADMIN') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/department/dashboard', { replace: true });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 font-body-md antialiased bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/back.jpeg')" }}
    >
      
      {/* Overlay to decrease background opacity */}
      <div className="absolute inset-0 bg-white/60"></div>

      {/* Main Card */}
      <div className="bg-white rounded-[2rem] shadow-2xl flex flex-col w-full max-w-[600px] overflow-hidden min-h-[500px] relative z-10">
        
        {/* Login Form Container */}
        <div className="w-full p-8 lg:p-12 flex flex-col items-center justify-center relative bg-white">
          
          <div className="w-full max-w-[460px] flex flex-col items-center text-center">
            
            {/* Logo Icon */}
            <div className="mb-4">
              <img src="/logo.png" alt="RGUKT Logo" className="w-20 h-20 object-contain rounded-full mx-auto" />
            </div>
            
            <h2 className="text-2xl font-headline-md font-bold text-slate-800 tracking-tight text-center mb-5">
              Welcome to RGUKT CLEARANCE
            </h2>

            {/* Login Type Toggle */}
            <div className="w-full bg-slate-100 p-1 rounded-lg flex mb-5">
              <button 
                onClick={() => setLoginType('student')}
                className={`flex-1 py-1.5 font-label-sm text-sm rounded-md transition-all duration-300 ${loginType === 'student' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Student
              </button>
              <button 
                onClick={() => setLoginType('department')}
                className={`flex-1 py-1.5 font-label-sm text-sm rounded-md transition-all duration-300 ${loginType === 'department' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Department
              </button>
            </div>
            
            <form onSubmit={handleLogin} className="w-full space-y-3 text-left mb-6">
              <div className="space-y-1">
                <label className="block font-label-sm text-xs text-slate-700 ml-1" htmlFor="email">
                  {loginType === 'student' ? 'Student Email' : 'Department Email'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input 
                    className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg font-body-sm text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#5b21b6] focus:border-[#5b21b6] transition-colors bg-white outline-none" 
                    id="email" 
                    placeholder={loginType === 'student' ? "student@university.edu" : "library@university.edu"} 
                    required 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="block font-label-sm text-xs text-slate-700 ml-1" htmlFor="password">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input 
                    className="block w-full pl-9 pr-9 py-2 border border-slate-200 rounded-lg font-body-sm text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#5b21b6] focus:border-[#5b21b6] transition-colors bg-white outline-none" 
                    id="password" 
                    placeholder="••••••••" 
                    required 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-400 hover:text-[#5b21b6] transition-colors">
                    <EyeOff className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {error && <p className="text-xs text-red-500 text-center font-medium pt-1">{error}</p>}

              <button 
                disabled={loading}
                className="w-full bg-[#1e293b] text-white font-label-sm text-sm py-2.5 px-4 rounded-lg hover:bg-[#0f172a] transition-colors duration-300 shadow-sm flex justify-center items-center gap-2 mt-1 disabled:opacity-70" 
                type="submit"
              >
                <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <div className={`w-full transition-opacity duration-300 ${loginType === 'student' ? 'opacity-100' : 'opacity-0 pointer-events-none select-none'}`}>
              <div className="w-full flex items-center mb-6 mt-1">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink-0 mx-3 font-label-sm text-xs text-slate-400">OR CONTINUE WITH</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                {/* Google Button */}
                <button 
                  type="button"
                  onClick={() => handleGoogleAuth()}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors shadow-sm mb-2 disabled:opacity-70"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                  </svg>
                  <span className="font-bold text-slate-700 text-xs tracking-wide">SIGN IN WITH GOOGLE</span>
                </button>
            </div>

            <p className="mt-5 text-center text-[11px] text-slate-500 leading-relaxed max-w-[280px]">
              By continuing, you indicate that you have read, understood and agree to RGUKT CLEARANCE's <a href="#" className="text-blue-600 font-semibold hover:underline">Terms of Service</a> and <a href="#" className="text-blue-600 font-semibold hover:underline">Privacy Policy</a>
            </p>

          </div>
        </div>
      </div>

      {/* Custom Department Login Alert Modal */}
      {showDeptAlert && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-backdrop-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-modal-in">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Department Login Detected</h3>
              <p className="text-sm text-slate-500 mb-6">
                This is a department email. Please login using the department login section.
              </p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setShowDeptAlert(false)}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setShowDeptAlert(false);
                    setLoginType('department');
                  }}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Go to Department
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
