import React, { useState } from 'react';
import { Lock, KeyRound, Shield, Eye, EyeOff, X, CheckCircle2, ShieldCheck, Fingerprint } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import {
  isBiometricAvailable,
  isBiometricEnrolled,
  registerBiometricDevice,
  authenticateBiometric,
} from '../utils/biometrics';

interface PinModalProps {
  isOpen: boolean;
  appPin: string;
  onSuccess: () => void;
  onUpdatePin: (newPin: string) => void;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  appPin,
  onSuccess,
  onUpdatePin,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetMethod, setResetMethod] = useState<'current' | 'admin'>('current');
  const [currentPinCheck, setCurrentPinCheck] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [newPinDirect, setNewPinDirect] = useState('');
  const [showResetNewPin, setShowResetNewPin] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setErrorMsg('');
      setShowPassword(false);
      isBiometricAvailable().then((avail) => {
        setBiometricAvailable(avail);
        setBiometricEnrolled(isBiometricEnrolled());
      });
    }
  }, [isOpen]);

  const handleBiometricAction = async () => {
    setErrorMsg('');
    if (!biometricEnrolled) {
      const entered = pinInput.trim();
      const active = (appPin || '1234').trim();
      if (!entered) {
        setErrorMsg('Please enter password above first to register Fingerprint / Face ID.');
        return;
      }
      if (entered !== active) {
        setErrorMsg('Incorrect Password! Cannot register biometrics.');
        return;
      }

      try {
        setBiometricLoading(true);
        await registerBiometricDevice();
        setBiometricEnrolled(true);
        onSuccess();
      } catch (err: any) {
        if (err.name !== 'NotAllowedError') {
          setErrorMsg(err.message || 'Failed to setup biometrics');
        }
      } finally {
        setBiometricLoading(false);
      }
      return;
    }

    try {
      setBiometricLoading(true);
      await authenticateBiometric();
      onSuccess();
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        setErrorMsg('Biometric verification failed. Please use password.');
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = pinInput.trim();
    const active = (appPin || '1234').trim();
    if (entered === active) {
      setErrorMsg('');
      setPinInput('');
      onSuccess();
    } else {
      setErrorMsg('Incorrect Password! Please enter the valid system password.');
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (resetMethod === 'current') {
      if (currentPinCheck.trim() !== (appPin || '1234').trim()) {
        setResetError('Current password does not match active system password!');
        return;
      }
    } else {
      if (!adminEmail.trim() || !adminPassword) {
        setResetError('Please enter your Firebase Admin Email and Password.');
        return;
      }
      try {
        setResetSubmitting(true);
        await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
      } catch (err: any) {
        setResetError('Admin verification failed: ' + (err.message || 'Invalid admin credentials'));
        setResetSubmitting(false);
        return;
      } finally {
        setResetSubmitting(false);
      }
    }

    if (newPinDirect.trim().length < 2) {
      setResetError('New password must be at least 2 characters.');
      return;
    }

    const updatedPin = newPinDirect.trim();
    onUpdatePin(updatedPin);
    setResetSuccess(`Password updated successfully to "${updatedPin}"!`);
    setTimeout(() => {
      setShowResetModal(false);
      setCurrentPinCheck('');
      setAdminEmail('');
      setAdminPassword('');
      setNewPinDirect('');
      setResetSuccess('');
      setResetError('');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-100 via-indigo-50/50 to-sky-100/60 z-50 flex items-center justify-center p-4">
      {/* Subtle decorative background blur circles */}
      <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-sky-200/35 rounded-full blur-3xl pointer-events-none" />

      <div className="relative bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl max-w-sm w-full p-6 sm:p-8 shadow-xl shadow-slate-300/40 space-y-6 text-center overflow-hidden">
        {/* Top Accent Gradient Stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-blue-500 to-teal-400 absolute top-0 left-0" />

        <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
          <Lock className="w-6 h-6 text-indigo-600" />
        </div>

        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">FIA CLEAN & CARE</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">Enter password to login to the system</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter password"
              value={pinInput}
              autoComplete="new-password"
              name="current_system_lock_password"
              onChange={(e) => {
                setPinInput(e.target.value);
                setErrorMsg('');
              }}
              autoFocus
              className="keep-case w-full text-center text-lg font-mono font-bold p-3 pr-10 bg-slate-50/80 border-2 border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white transition outline-none text-slate-800 placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title={showPassword ? 'Hide Password' : 'Show Password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-600 animate-in fade-in">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white py-3 rounded-xl font-bold text-xs tracking-wider shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>LOGIN</span>
          </button>
        </form>

        {/* Modern Mobile In-Display Animated Fingerprint Scanner */}
        {biometricAvailable && (
          <div className="pt-1 flex flex-col items-center justify-center space-y-2">
            <div className="relative flex py-1 w-full items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                OR SCAN
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <div className="flex flex-col items-center justify-center pt-1 group">
              <button
                type="button"
                onClick={handleBiometricAction}
                disabled={biometricLoading}
                aria-label="Biometric Fingerprint Scanner"
                className="relative flex items-center justify-center focus:outline-none cursor-pointer active:scale-90 transition-transform duration-150"
              >
                {/* Radar Pulse Ping Waves (when enrolled) */}
                {biometricEnrolled && (
                  <>
                    <span className="absolute -inset-2 rounded-full bg-emerald-400/30 blur-xs animate-ping pointer-events-none"></span>
                    <span className="absolute -inset-1.5 rounded-full border border-emerald-500/30 pointer-events-none"></span>
                  </>
                )}

                {/* Circular Sensor Pod */}
                <div
                  className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                    biometricEnrolled
                      ? 'bg-gradient-to-b from-slate-900 via-slate-950 to-emerald-950 border-2 border-emerald-500/60 shadow-xl shadow-emerald-500/25 group-hover:border-emerald-400 group-hover:shadow-emerald-500/40'
                      : 'bg-gradient-to-b from-indigo-50 to-white border-2 border-indigo-300 shadow-md shadow-indigo-200/50 group-hover:border-indigo-500'
                  }`}
                >
                  <Fingerprint
                    className={`w-8 h-8 transition-colors ${
                      biometricEnrolled
                        ? 'text-emerald-400 group-hover:text-emerald-300 animate-pulse'
                        : 'text-indigo-600 group-hover:text-indigo-700'
                    }`}
                  />
                </div>
              </button>

              <span className="text-[11px] font-bold text-slate-500 mt-2 tracking-wide group-hover:text-emerald-700 transition">
                {biometricLoading
                  ? 'Scanning...'
                  : biometricEnrolled
                  ? 'Touch sensor to unlock'
                  : 'Tap to set up Fingerprint'}
              </span>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-slate-400 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setShowResetModal(true);
              setResetError('');
              setResetSuccess('');
              setCurrentPinCheck('');
              setNewPinDirect('');
              setAdminEmail('');
              setAdminPassword('');
            }}
            className="text-indigo-600 hover:text-indigo-800 hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer transition"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Change / Reset Password</span>
          </button>
        </div>
      </div>

      {/* Change / Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-6 space-y-4 text-left shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>Update System Password</span>
              </h3>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Method switch: with current password OR with Firebase Admin */}
            <div className="flex bg-slate-100 p-1 rounded-lg text-[11px] font-bold">
              <button
                type="button"
                onClick={() => {
                  setResetMethod('current');
                  setResetError('');
                }}
                className={`flex-1 py-1.5 rounded-md transition ${
                  resetMethod === 'current'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Using Current Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetMethod('admin');
                  setResetError('');
                }}
                className={`flex-1 py-1.5 rounded-md transition ${
                  resetMethod === 'admin'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Forgot? (Firebase Admin)
              </button>
            </div>

            {resetError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-700">
                {resetError}
              </div>
            )}

            {resetSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{resetSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordUpdate} className="space-y-3">
              {resetMethod === 'current' ? (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Current Active Password</label>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={currentPinCheck}
                    onChange={(e) => setCurrentPinCheck(e.target.value)}
                    required
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs font-mono outline-none focus:border-indigo-600"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Firebase Admin Email</label>
                    <input
                      type="email"
                      placeholder="admin@gmail.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                      className="w-full border border-slate-300 p-2 rounded-lg text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Firebase Admin Password</label>
                    <input
                      type="password"
                      placeholder="Enter Firebase password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                      className="w-full border border-slate-300 p-2 rounded-lg text-xs font-mono outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">New Password / PIN</label>
                <div className="relative">
                  <input
                    type={showResetNewPin ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={newPinDirect}
                    onChange={(e) => setNewPinDirect(e.target.value)}
                    required
                    className="w-full border border-slate-300 p-2 pr-9 rounded-lg text-xs font-mono outline-none focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetNewPin(!showResetNewPin)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showResetNewPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-xs"
                >
                  {resetSubmitting ? 'Verifying...' : 'Save Active Password'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-3 bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
