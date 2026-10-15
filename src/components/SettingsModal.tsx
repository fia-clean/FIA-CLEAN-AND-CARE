import React, { useState } from 'react';
import {
  X,
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertCircle,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  History,
  Clock,
  RotateCcw,
  Fingerprint,
} from 'lucide-react';
import { exportJSONBackup } from '../utils/formatters';
import {
  isBiometricAvailable,
  isBiometricEnrolled,
  registerBiometricDevice,
  disableBiometric,
} from '../utils/biometrics';

interface SettingsModalProps {
  isOpen: boolean;
  allData: unknown;
  onClose: () => void;
  onRestoreBackup: (data: any) => void;
  onClearAllData?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  allData,
  onClose,
  onRestoreBackup,
  onClearAllData,
}) => {
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [vaultList, setVaultList] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('fia_backup_vault_history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      isBiometricAvailable().then((avail) => {
        setBioAvailable(avail);
        setBioEnrolled(isBiometricEnrolled());
      });
    }
  }, [isOpen]);

  const handleRestoreVaultSnapshot = (snap: any) => {
    if (!snap || !snap.data) return;
    if (
      window.confirm(
        `Restore snapshot from ${snap.displayLabel || new Date(snap.timestamp).toLocaleString()}? This will rollback active data to this version.`
      )
    ) {
      onRestoreBackup(snap.data);
      setStatusMessage({
        type: 'success',
        text: `Restored snapshot from ${snap.displayLabel || 'selected time'} successfully!`,
      });
      setTimeout(() => {
        setStatusMessage(null);
        onClose();
      }, 1500);
    }
  };

  if (!isOpen) return null;

  const handleDownloadBackup = () => {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `FIA_CLEAN_CARE_BACKUP_${dateStr}.json`;
      exportJSONBackup(
        {
          backupVersion: 2,
          app: 'FIA CLEAN & CARE',
          createdAt: new Date().toISOString(),
          data: allData,
        },
        filename
      );
      setStatusMessage({
        type: 'success',
        text: 'Backup file downloaded successfully!',
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: 'Failed to download backup file.',
      });
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '').trim();
        const json = JSON.parse(text);
        const data = json.data || json;
        onRestoreBackup(data);
        setStatusMessage({
          type: 'success',
          text: 'Backup restored successfully! All data updated.',
        });
        setTimeout(() => {
          setStatusMessage(null);
          onClose();
        }, 1200);
      } catch (err) {
        console.error(err);
        setStatusMessage({
          type: 'error',
          text: 'Invalid backup file. Please choose a valid JSON file.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Data Backup & Restore
              </h3>
              <p className="text-[11px] text-slate-500">Manage your business data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Automatic Backup Status Card */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-emerald-900">Automatic Backup Active</p>
            <p className="text-[11px] text-emerald-700">
              Rolling snapshots & multi-device merge protection enabled.
            </p>
          </div>
        </div>

        {/* Biometric Security Card */}
        {bioAvailable && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4 text-indigo-600" />
                <span>Biometric Authentication</span>
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  bioEnrolled
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {bioEnrolled ? 'Active' : 'Not Set'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Fingerprint scanner and Face ID unlock on this device.
            </p>
            <div className="flex justify-end pt-0.5">
              {bioEnrolled ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Disable biometric login for this device?')) {
                      disableBiometric();
                      setBioEnrolled(false);
                      setStatusMessage({
                        type: 'success',
                        text: 'Biometric authentication removed from this device.',
                      });
                      setTimeout(() => setStatusMessage(null), 3000);
                    }
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                >
                  Remove Biometric
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await registerBiometricDevice();
                      setBioEnrolled(true);
                      setStatusMessage({
                        type: 'success',
                        text: 'Fingerprint / Face ID successfully registered!',
                      });
                      setTimeout(() => setStatusMessage(null), 3000);
                    } catch (err: any) {
                      if (err.name !== 'NotAllowedError') {
                        setStatusMessage({
                          type: 'error',
                          text: err.message || 'Setup failed',
                        });
                      }
                    }
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                >
                  Enable Fingerprint / Face ID
                </button>
              )}
            </div>
          </div>
        )}

        {/* Status Message Notification */}
        {statusMessage && (
          <div
            className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Rolling Backup Vault / History */}
        <div className="space-y-2 border border-slate-200 bg-slate-50/70 p-3.5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-600" />
              <span>Automatic Vault History</span>
            </span>
            <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
              {vaultList.length} Snapshots
            </span>
          </div>
          <p className="text-[10px] text-slate-500">
            Rolling snapshots auto-saved before changes & updates. Click restore to rollback anytime.
          </p>

          {vaultList.length > 0 ? (
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {vaultList.map((snap) => (
                <div
                  key={snap.id || snap.timestamp}
                  className="bg-white hover:bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-2 shadow-2xs transition"
                >
                  <div>
                    <div className="font-bold text-slate-800 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{snap.displayLabel || new Date(snap.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      👥 {snap.custCount || 0} Custs • 📦 {snap.prodCount || 0} Prods • 🧾 {snap.saleCount || 0} Bills
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestoreVaultSnapshot(snap)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1 rounded transition flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restore</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 italic bg-white p-2.5 rounded-lg border border-dashed border-slate-200 text-center">
              Vault history records automatically on business transactions.
            </div>
          )}
        </div>

        {/* Actions Container */}
        <div className="space-y-3">
          {/* Download JSON Backup */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download JSON Backup</span>
            </button>
            <p className="text-[10px] text-slate-500 text-center">
              Saves full copy of all invoices, products, customers & day book
            </p>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-2 text-[10px] font-bold text-slate-400 uppercase">OR</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Restore from File */}
          <div className="space-y-1.5">
            <label className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs">
              <Upload className="w-4 h-4" />
              <span>Restore from JSON File</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleRestoreFile}
                className="hidden"
              />
            </label>
            <p className="text-[10px] text-slate-500 text-center">
              Restore previously downloaded JSON backup file
            </p>
          </div>

          {/* Reset / Clear Data to Empty FIA Slate */}
          {onClearAllData && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              {!showClearConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Reset / Clear All Records (Fresh Start)</span>
                </button>
              ) : (
                <div className="bg-rose-50 p-3 rounded-lg border border-rose-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Clear all data and start completely fresh?</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    This will clear all stock, bills, customers, and day book entries. Make sure you have downloaded a backup if needed.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClearAllData();
                        setShowClearConfirm(false);
                        setStatusMessage({
                          type: 'success',
                          text: 'All records cleared. System is completely clean!',
                        });
                        setTimeout(() => {
                          setStatusMessage(null);
                          onClose();
                        }, 1200);
                      }}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-1.5 rounded text-xs font-bold shadow-xs transition"
                    >
                      Yes, Clear All
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="px-3 bg-white text-slate-700 border border-slate-300 py-1.5 rounded text-xs font-semibold hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info & close */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-mono">FIA Clean & Care v2.0</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
