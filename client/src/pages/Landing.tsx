import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="w-screen h-screen relative bg-[#faf7ef] overflow-hidden">
      <iframe 
        src="/landing.html" 
        className="w-full h-full border-none" 
        title="RGUKT Clearance Hub Animation"
      />
      
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-1000 delay-1000 fill-mode-both">
        <button 
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 bg-[#d91515] text-white px-8 py-4 rounded-full font-headline-sm text-lg font-bold shadow-lg hover:bg-[#b81010] hover:scale-105 hover:shadow-xl transition-all duration-300 ring-4 ring-white/20"
        >
          <span>Proceed to Portal</span>
          <LogIn className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
