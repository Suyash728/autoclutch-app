import React, { useState, useEffect } from 'react';
import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider, setCachedAccessToken } from '../firebase';
import { AlertCircle } from 'lucide-react';

interface LoginScreenProps {
  onLoginStart?: () => void;
  onLoginError?: (error: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginStart,
  onLoginError,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            setCachedAccessToken(credential.accessToken);
          }
        }
      })
      .catch((err) => {
        console.error("Error getting redirect result:", err);
      });
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    if (onLoginStart) onLoginStart();

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedAccessToken(credential.accessToken);
      }
    } catch (err: any) {
      console.error("Auth error during popup:", err);
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/popup-closed-by-user') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          console.error("Redirect auth failed:", redirectErr);
          const errMsg = redirectErr?.message || "Google Sign-In failed. Please try again.";
          setError(errMsg);
          if (onLoginError) onLoginError(errMsg);
        }
      } else {
        const errMsg = err?.message || "Google Sign-In failed. Please try again.";
        setError(errMsg);
        if (onLoginError) onLoginError(errMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#13121b] text-[#e4e1ed] font-sans flex flex-col justify-center items-center relative overflow-hidden select-none">
      
      {/* ========================================== */}
      {/* DESKTOP BACKGROUND AND LAYOUT             */}
      {/* ========================================== */}
      <div 
        className="absolute inset-0 pointer-events-none overflow-hidden hidden md:block" 
        style={{ background: 'radial-gradient(circle at center, rgba(26,18,68,0.8) 0%, #13121b 100%)' }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#5B4FE3]/20 rounded-full blur-[150px] mix-blend-screen animate-flux-slow" />
        <div className="absolute -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#c4c0ff]/10 rounded-full blur-[120px] mix-blend-screen animate-flux-fast left-1/2 top-1/2" />
      </div>

      <main className="hidden md:flex flex-1 w-full min-h-screen relative items-center justify-center z-10">
        <div className="relative z-10 w-full max-w-[520px] px-6 md:px-0 animate-fade-in-up">
          <div className="bg-[#271f5c]/25 backdrop-blur-2xl rounded-[32px] border border-white/5 shadow-2xl p-10 md:p-14 flex flex-col items-center text-center relative overflow-hidden group">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            {/* Logo area */}
            <div className="relative w-32 h-32 mb-10">
              <div className="absolute inset-0 bg-[#5B4FE3]/30 rounded-[2rem] blur-[30px] group-hover:blur-[40px] transition-all duration-700"></div>
              <div className="relative w-full h-full rounded-[2rem] p-1 bg-gradient-to-b from-white/20 to-white/0 shadow-2xl overflow-hidden">
                <img alt="AutoClutch" className="w-full h-full object-cover rounded-[1.8rem] bg-[#0e0d16] scale-110" src="/shared/assets/autoclutch_icon_dark.png" />
              </div>
            </div>

            {/* Main title */}
            <h2 className="text-[32px] font-extrabold text-[#e4e1ed] mb-4 leading-tight tracking-tight">
              Your autonomous deadline co-pilot.
            </h2>

            {/* Subtitle */}
            <p className="text-base text-[#c8c4d7] mb-12 max-w-[320px]">
              Never miss a clutch moment. Connect your workspace to initiate the neural flux engine.
            </p>

            {/* Error badge if any */}
            {error && (
              <div className="mb-6 w-full p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-left">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-medium leading-relaxed">{error}</p>
              </div>
            )}

            {/* Action button */}
            <button 
              id="google-signin-desktop-btn"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-4 px-8 rounded-full bg-[#5B4FE3] text-white font-semibold text-sm transition-all duration-300 hover:bg-[#4232CA] hover:text-white active:scale-[0.98] shadow-[0_0_20px_rgba(91,79,227,0.25)] hover:shadow-[0_0_40px_rgba(91,79,227,0.4)] border border-[#5B4FE3]/30 group/btn relative overflow-hidden cursor-pointer"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover/btn:translate-y-[0%] transition-transform duration-300 ease-out"></div>
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin relative z-10" />
              ) : (
                <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.14-4.53z" fill="#EA4335"></path>
                </svg>
              )}
              <span className="relative z-10 tracking-widest uppercase">Continue with Google</span>
            </button>

            {/* Bottom text */}
            <p className="text-xs font-semibold tracking-widest text-[#c8c4d7]/50 mt-8 uppercase">
              Secure, seamless, and intelligent.
            </p>
          </div>
        </div>
      </main>

      {/* ========================================== */}
      {/* MOBILE BACKGROUND AND LAYOUT              */}
      {/* ========================================== */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(91,79,227,0.2),_#13121b_70%)] pointer-events-none z-0 block md:hidden" />
      
      <main className="flex md:hidden w-full max-w-md px-6 flex-col items-center z-10 relative py-4">
        {/* Icon Area with Ambient Glow */}
        <div className="relative w-32 h-32 mb-12">
          <div className="absolute inset-0 bg-[#5B4FE3]/30 rounded-[2rem] blur-[30px]"></div>
          <div className="relative w-full h-full rounded-[2rem] p-1 bg-gradient-to-b from-white/20 to-white/0 shadow-2xl overflow-hidden">
            <img alt="AutoClutch" className="w-full h-full object-cover rounded-[1.8rem] bg-[#0e0d16] scale-110" src="/shared/assets/autoclutch_icon_dark.png" />
          </div>
        </div>

        {/* Text Content */}
        <div className="text-center mb-12 flex flex-col gap-4">
          <h1 className="text-[28px] font-extrabold tracking-tight text-[#e4e1ed] leading-tight">
            Your autonomous deadline co-pilot.<br />Never miss a clutch moment.
          </h1>
          <p className="text-base text-[#c8c4d7] max-w-[280px] mx-auto leading-relaxed">
            AutoClutch securely connects to your Calendar, Gmail, and Tasks to plan your work autonomously.
          </p>
        </div>

        {/* Error badge if any */}
        {error && (
          <div className="mb-6 w-full p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-left">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-medium leading-relaxed">{error}</p>
          </div>
        )}

        {/* Action Area */}
        <div className="w-full flex flex-col gap-4">
          <button 
            id="google-signin-mobile-btn"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white text-[#0e0d16] font-bold text-sm py-4 px-6 rounded-full shadow-[0_8px_32px_rgba(91,79,227,0.15)] hover:scale-[0.98] active:scale-95 transition-all duration-200 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-[#0e0d16]/30 border-t-[#0e0d16] rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
            )}
            Continue with Google
          </button>
          <p className="text-center text-[10px] text-[#c8c4d7]/50 mt-4 leading-normal">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </main>
    </div>
  );
};
