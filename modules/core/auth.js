/**
 * FIA CLEAN & CARE - Authentication & PIN Security Module
 */

import { state } from './state.js';
import { syncToFirebase, pullFromFirebase } from './db.js';
import {
    isBiometricAvailable,
    isBiometricEnrolled,
    registerBiometricDevice,
    authenticateBiometric,
    disableBiometric
} from './biometrics.js';

export function isMasterKey() {
    return false;
}

export function isAuthorizedPin(entered, activePin) {
    if (!entered) return false;
    const clean = String(entered).trim();
    let saved = '1234';
    try {
        saved = localStorage.getItem('fia_app_pin') || (state && state.appPin) || (window.state && window.state.appPin) || activePin || '1234';
    } catch(e) {
        saved = activePin || '1234';
    }
    return clean === String(saved).trim();
}

export function verifyLoginPin() {
    const input = document.getElementById('loginPinInput');
    const entered = (input ? input.value : '').trim();
    let savedLocal = '1234';
    try { savedLocal = localStorage.getItem('fia_app_pin') || '1234'; } catch(e) {}
    const active = (state.appPin || savedLocal || '1234').trim();
    if (isAuthorizedPin(entered, active)) {
        state.isLoggedIn = true;
        if (window.state) window.state.isLoggedIn = true;
        window._isLoggedInFlag = true;
        try {
            sessionStorage.setItem('fia_logged_in', 'true');
        } catch(e) {}

        if (typeof window._dismissLoginOverlay === 'function') {
            window._dismissLoginOverlay();
        } else {
            const overlay = document.getElementById('loginOverlay');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.setAttribute('hidden', 'true');
                overlay.style.setProperty('display', 'none', 'important');
            }
            const mainApp = document.getElementById('mainAppContainer');
            if (mainApp) {
                mainApp.classList.remove('hidden');
                mainApp.removeAttribute('hidden');
                mainApp.style.removeProperty('display');
                mainApp.style.setProperty('display', 'block', 'important');
            }
        }
        history.replaceState({ loggedIn: true, tab: 'home' }, "", "#home");
        if (input) input.value = '';
        if (typeof window.switchTab === 'function') {
            try { window.switchTab('home', false); } catch(e) {}
        }
        if (typeof window.renderAll === 'function') {
            try { window.renderAll(); } catch(e) {}
        }
    } else {
        alert("Incorrect PIN! Please try again.");
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

export function logoutApp() {
    state.isLoggedIn = false;
    window._isLoggedInFlag = false;
    state.isPreviewOpen = false;
    try {
        sessionStorage.removeItem('fia_logged_in');
        sessionStorage.removeItem('fia_auth');
    } catch(e) {}
    try {
        if (window.closeBarcodeScanner) window.closeBarcodeScanner();
    } catch(e) {}
    ['billPreviewModal','recordViewModal','settingsModal','changePinModal','resetPinModal','dueAmountListModal','lowStockListModal','customerConsolidatedDetailModal','supplierConsolidatedDetailModal','backupModal','barcodeScannerModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('[id^="section"]').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });
    const mainApp = document.getElementById('mainAppContainer');
    if (mainApp) {
        mainApp.classList.add('hidden');
        mainApp.setAttribute('hidden', 'true');
        mainApp.style.setProperty('display', 'none', 'important');
    }
    if (typeof window._showLoginOverlay === 'function') {
        window._showLoginOverlay();
    } else {
        const overlay = document.getElementById('loginOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.removeAttribute('hidden');
            overlay.style.removeProperty('display');
            overlay.style.setProperty('display', 'flex', 'important');
            const pin = document.getElementById('loginPinInput');
            if (pin) { pin.value = ''; setTimeout(() => pin.focus(), 80); }
        }
    }
    try {
        history.replaceState({ loggedIn: false }, '', '#login');
    } catch(e) {}
}

export function togglePinVisibility(inputId, buttonId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    const showSvg = document.getElementById('eyeIconShow');
    const hideSvg = document.getElementById('eyeIconHide');
    if (showSvg && hideSvg) {
        if (showing) {
            showSvg.classList.remove('hidden');
            hideSvg.classList.add('hidden');
        } else {
            showSvg.classList.add('hidden');
            hideSvg.classList.remove('hidden');
        }
    } else {
        const btn = document.getElementById(buttonId);
        if (btn) btn.textContent = showing ? '👁️' : '🙈';
    }
}

export function openChangePinModal() {
    const cpCur = document.getElementById('cpCurrent');
    const cpNew = document.getElementById('cpNew');
    if (cpCur) cpCur.value = '';
    if (cpNew) cpNew.value = '';
    const modal = document.getElementById('changePinModal');
    if (modal) modal.classList.remove('hidden');
    if (cpCur) cpCur.focus();
}

export function closeChangePinModal() {
    const modal = document.getElementById('changePinModal');
    if (modal) modal.classList.add('hidden');
}

export function submitChangePin() {
    const current = (document.getElementById('cpCurrent')?.value || '').trim();
    const newP = (document.getElementById('cpNew')?.value || '').trim();
    const activePin = (state.appPin || '1234').trim();
    if (!isAuthorizedPin(current, activePin)) {
        alert("Current PIN is incorrect!");
        return;
    }
    if (newP.length < 3) {
        alert("New PIN must be at least 3 digits.");
        return;
    }
    state.appPin = newP;
    try { localStorage.setItem('fia_app_pin', newP); } catch(e) {}
    syncToFirebase();
    alert("✓ PIN updated successfully!");
    closeChangePinModal();
    const loginInput = document.getElementById('loginPinInput');
    if (loginInput) {
        loginInput.value = newP;
        loginInput.focus();
    }
}

export function openResetPinModal() {
    const adminEmailInput = document.getElementById('rpAdminEmail');
    const adminPassInput = document.getElementById('rpAdminPass');
    const rPin = document.getElementById('rpNewDirect');
    const status = document.getElementById('rpMasterStatus');

    if (adminEmailInput) {
        let savedEmail = '';
        if (window.FB_AUTH && window.FB_AUTH.currentUser && window.FB_AUTH.currentUser.email) {
            savedEmail = window.FB_AUTH.currentUser.email;
        } else {
            savedEmail = document.getElementById('cloudAuthEmail')?.value || '';
        }
        adminEmailInput.value = savedEmail;
    }
    if (adminPassInput) adminPassInput.value = '';
    if (rPin) rPin.value = '';
    if (status) { status.textContent = ''; status.classList.add('hidden'); }
    const modal = document.getElementById('resetPinModal');
    if (modal) modal.classList.remove('hidden');
    if (adminEmailInput && !adminEmailInput.value) {
        adminEmailInput.focus();
    } else if (adminPassInput) {
        adminPassInput.focus();
    }
}

export function closeResetPinModal() {
    const modal = document.getElementById('resetPinModal');
    if (modal) modal.classList.add('hidden');
}

export async function verifyAdminAndResetPin() {
    const email = (document.getElementById('rpAdminEmail')?.value || '').trim();
    const pass = document.getElementById('rpAdminPass')?.value || '';
    const newPin = (document.getElementById('rpNewDirect')?.value || '').trim();
    const status = document.getElementById('rpMasterStatus');
    const btn = document.getElementById('rpSaveBtn');

    if (!email || !pass) {
        if (status) { status.textContent = '⚠️ Please enter your Firebase Admin Email and Password.'; status.classList.remove('hidden'); }
        return;
    }
    if (newPin.length < 3) {
        if (status) { status.textContent = '⚠️ New PIN must be at least 3 digits.'; status.classList.remove('hidden'); }
        return;
    }

    if (!window.FB_AUTH) {
        if (status) { status.textContent = '⚠️ Firebase is initializing. Please check your internet connection.'; status.classList.remove('hidden'); }
        return;
    }

    if (btn) {
        btn.textContent = 'Verifying with Firebase...';
        btn.disabled = true;
    }

    try {
        await window.FB_AUTH.signInWithEmailAndPassword(email, pass);
        // Authentication succeeded with Firebase!
        state.appPin = newPin;
        try { localStorage.setItem('fia_app_pin', newPin); } catch(e) {}
        syncToFirebase();
        alert('✓ Admin identity successfully verified!\nSecurity PIN updated to: ' + newPin);
        closeResetPinModal();
        const loginInput = document.getElementById('loginPinInput');
        if (loginInput) { loginInput.value = newPin; loginInput.focus(); }
    } catch (err) {
        console.warn('Admin reset verification failed:', err);
        if (status) {
            status.textContent = '⚠️ Verification failed: ' + (err.message || 'Invalid admin credentials');
            status.classList.remove('hidden');
        }
    } finally {
        if (btn) {
            btn.textContent = 'Verify & Save PIN';
            btn.disabled = false;
        }
    }
}

export const verifyMasterKeyAndReset = verifyAdminAndResetPin;

export function openSettingsModal() { 
    document.getElementById('settingsModal')?.classList.remove('hidden'); 
    if (typeof updateCloudAuthUI === 'function') {
        updateCloudAuthUI(window.FB_AUTH ? window.FB_AUTH.currentUser : null);
    }
    if (typeof updateBiometricUI === 'function') {
        updateBiometricUI();
    }
}
export function closeSettingsModal() { document.getElementById('settingsModal')?.classList.add('hidden'); }

export function saveNewPin() {
    const newPin = (document.getElementById('newPinInput')?.value || '').trim();
    if (newPin.length >= 3) {
        state.appPin = newPin;
        try { localStorage.setItem('fia_app_pin', newPin); } catch(e) {}
        syncToFirebase();
        alert("Security PIN updated successfully!");
        closeSettingsModal();
    } else {
        alert("PIN must be at least 3 digits.");
    }
}

// ================= FIREBASE CLOUD SECURITY & DEVICE AUTHORIZATION =================
export function updateCloudAuthUI(user) {
    const badge = document.getElementById('cloudAuthBadge');
    const inputContainer = document.getElementById('cloudAuthInputsContainer');
    const activeContainer = document.getElementById('cloudAuthActiveContainer');
    const userEmailEl = document.getElementById('cloudAuthUserEmail');

    if (user && user.email) {
        if (badge) {
            badge.textContent = 'Protected (Admin: ' + user.email + ')';
            badge.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 shadow-sm';
        }
        if (inputContainer) inputContainer.classList.add('hidden');
        if (activeContainer) activeContainer.classList.remove('hidden');
        if (userEmailEl) userEmailEl.textContent = user.email;
    } else if (user && (user.isAnonymous || user.uid)) {
        if (badge) {
            badge.textContent = 'Protected (Cloud Connected)';
            badge.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 shadow-sm';
        }
        if (inputContainer) inputContainer.classList.remove('hidden');
        if (activeContainer) activeContainer.classList.remove('hidden');
        if (userEmailEl) userEmailEl.textContent = 'Device Authenticated (Cloud Synced)';
    } else {
        if (badge) {
            badge.textContent = 'Admin Authorization Required';
            badge.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800';
        }
        if (inputContainer) inputContainer.classList.remove('hidden');
        if (activeContainer) activeContainer.classList.add('hidden');
        if (userEmailEl) userEmailEl.textContent = '';
    }
}

let inFlightAuthPromise = null;
let isAutoSigningIn = false;

export function autoSignInFirebase() {
    if (!window.FB_AUTH) return Promise.resolve(null);
    if (window.FB_AUTH.currentUser) return Promise.resolve(window.FB_AUTH.currentUser);
    if (inFlightAuthPromise) return inFlightAuthPromise;

    const persistencePromise = (window.firebase && firebase.auth && firebase.auth.Auth && firebase.auth.Auth.Persistence)
        ? window.FB_AUTH.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(e => console.warn('Auth persistence notice:', e))
        : Promise.resolve();

    inFlightAuthPromise = persistencePromise.then(() => {
        if (window.FB_AUTH.currentUser) return window.FB_AUTH.currentUser;
        return window.FB_AUTH.signInAnonymously()
            .then(cred => {
                const user = cred ? cred.user : null;
                console.log('Firebase Cloud Auth Active (Anonymous):', user ? user.uid : 'connected');
                updateCloudAuthUI(user);
                return user;
            })
            .catch(err => {
                console.warn('Firebase Anonymous Auto-Auth notice:', err?.code || err);
                updateCloudAuthUI(null);
                return null;
            });
    }).finally(() => {
        inFlightAuthPromise = null;
    });

    return inFlightAuthPromise;
}

export function ensureFirebaseAuth() {
    if (!window.FB_AUTH) return Promise.resolve(null);
    if (window.FB_AUTH.currentUser) return Promise.resolve(window.FB_AUTH.currentUser);
    return autoSignInFirebase();
}

export function loginFirebaseAuth() {
    const email = (document.getElementById('cloudAuthEmail')?.value || '').trim();
    const pass = document.getElementById('cloudAuthPassword')?.value || '';
    const btn = document.getElementById('cloudAuthLoginBtn');

    if (!email || !pass) {
        alert('Please enter your Firebase Admin Email and Password.');
        return;
    }
    if (!window.FB_AUTH) {
        alert('Firebase Authentication is initializing or unavailable. Please check your internet connection.');
        return;
    }

    if (btn) {
        btn.textContent = 'Authorizing device...';
        btn.disabled = true;
    }

    // Set persistence to LOCAL so the login token survives browser closes, device restarts, and PWA relaunches
    window.FB_AUTH.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => window.FB_AUTH.signInWithEmailAndPassword(email, pass))
        .then((userCred) => {
            alert(`✓ Device successfully authorized as:\n${userCred.user.email}\n\nYour app can now securely sync with locked cloud database.`);
            updateCloudAuthUI(userCred.user);
            const passInput = document.getElementById('cloudAuthPassword');
            if (passInput) passInput.value = '';
            if (typeof window.attachRealtimeListener === 'function') window.attachRealtimeListener();
            if (typeof pullFromFirebase === 'function') pullFromFirebase();
        })
        .catch((err) => {
            console.error('Firebase Auth Login Error:', err);
            let msg = err.message || err.code || 'Authentication failed.';
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                msg = 'Incorrect Email or Password! Please check the credentials created in Firebase Console.';
            } else if (err.code === 'auth/network-request-failed') {
                msg = 'Network request failed. Please check your internet connection.';
            }
            alert('Authentication Error: ' + msg);
        })
        .finally(() => {
            if (btn) {
                btn.textContent = '🔑 Authorize This Device';
                btn.disabled = false;
            }
        });
}

export function logoutFirebaseAuth() {
    if (!window.FB_AUTH) return;
    if (!confirm('Disconnect this device from Firebase Cloud Admin?\n\nThe device will automatically continue using secure cloud synchronization.')) return;

    window.FB_AUTH.signOut().then(() => {
        updateCloudAuthUI(null);
        // Fall back seamlessly to anonymous connection
        autoSignInFirebase();
    }).catch(err => {
        console.error('Firebase signout error:', err);
    });
}

export function setupFirebaseAuthListener() {
    if (!window.FB_AUTH) return;
    try {
        window.FB_AUTH.onAuthStateChanged(function(user) {
            updateCloudAuthUI(user);
            if (user) {
                console.log('Firebase Cloud Auth Active on device:', user.email || ('Anonymous: ' + user.uid));
                if (typeof window.attachRealtimeListener === 'function') {
                    window.attachRealtimeListener();
                }
                if (navigator.onLine && typeof pullFromFirebase === 'function') {
                    pullFromFirebase();
                }
            } else {
                console.log('Firebase Cloud Auth: No active session. Connecting automatically...');
                if (!isAutoSigningIn && navigator.onLine) {
                    isAutoSigningIn = true;
                    autoSignInFirebase().finally(() => {
                        isAutoSigningIn = false;
                    });
                }
            }
        });
    } catch(e) {
        console.warn('Firebase Auth listener error:', e);
    }
}

// ================= BIOMETRIC AUTHENTICATION (WEBAUTHN) =================
export async function updateBiometricUI() {
    try {
        const available = await isBiometricAvailable();
        const container = document.getElementById('biometricContainer');
        const btn = document.getElementById('biometricBtn');
        const label = document.getElementById('biometricBtnLabel');
        const settingsSection = document.getElementById('biometricSettingsSection');
        const settingsStatus = document.getElementById('biometricSettingsStatus');
        const settingsActionBtn = document.getElementById('biometricSettingsActionBtn');

        const enrolled = isBiometricEnrolled();

        // Login Overlay Biometric Button
        if (container) {
            if (available) {
                container.classList.remove('hidden');
                container.style.display = 'flex';
                if (label) {
                    label.textContent = enrolled 
                        ? 'Touch sensor to unlock' 
                        : 'Tap to set up Fingerprint';
                }
                const pulse = document.getElementById('biometricPulseRing');
                const pod = document.getElementById('biometricSensorPod');
                const icon = document.getElementById('biometricFingerprintIcon');
                if (pulse) {
                    if (enrolled) {
                        pulse.classList.remove('hidden');
                    } else {
                        pulse.classList.add('hidden');
                    }
                }
                if (pod) {
                    if (enrolled) {
                        pod.className = "relative w-16 h-16 rounded-full bg-gradient-to-b from-slate-900 via-slate-950 to-emerald-950 border-2 border-emerald-500/60 shadow-xl shadow-emerald-500/25 flex items-center justify-center transition-all group-hover:border-emerald-400 group-hover:shadow-emerald-500/40";
                    } else {
                        pod.className = "relative w-16 h-16 rounded-full bg-gradient-to-b from-indigo-50 to-white border-2 border-indigo-300 shadow-md shadow-indigo-200/50 flex items-center justify-center transition-all group-hover:border-indigo-500";
                    }
                }
                if (icon) {
                    if (enrolled) {
                        icon.className = "w-8 h-8 text-emerald-400 group-hover:text-emerald-300 transition-colors animate-pulse";
                    } else {
                        icon.className = "w-8 h-8 text-indigo-600 group-hover:text-indigo-700 transition-colors";
                    }
                }
            } else {
                container.classList.add('hidden');
                container.style.display = 'none';
            }
        }

        // Settings Modal Biometric Status
        if (settingsSection) {
            if (available) {
                settingsSection.classList.remove('hidden');
                settingsSection.style.removeProperty('display');
                if (settingsStatus) {
                    settingsStatus.textContent = enrolled ? 'Active on this device' : 'Not configured';
                    settingsStatus.className = enrolled 
                        ? 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
                }
                if (settingsActionBtn) {
                    settingsActionBtn.textContent = enrolled ? 'Remove Biometric' : 'Enable Biometric';
                    settingsActionBtn.className = enrolled 
                        ? 'text-xs text-rose-400 hover:text-rose-300 font-semibold underline cursor-pointer'
                        : 'text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline cursor-pointer';
                    settingsActionBtn.onclick = enrolled ? resetDeviceBiometrics : () => promptEnrollBiometricsFromSettings();
                }
            } else {
                settingsSection.classList.add('hidden');
            }
        }
    } catch (e) {
        console.warn('updateBiometricUI error:', e);
    }
}

export function onBiometricAuthSuccess() {
    state.isLoggedIn = true;
    if (window.state) window.state.isLoggedIn = true;
    window._isLoggedInFlag = true;
    try { sessionStorage.setItem('fia_logged_in', 'true'); } catch(e) {}
    if (typeof window._dismissLoginOverlay === 'function') {
        window._dismissLoginOverlay();
    } else {
        const overlay = document.getElementById('loginOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.setAttribute('hidden', 'true');
            overlay.style.setProperty('display', 'none', 'important');
        }
        const mainApp = document.getElementById('mainAppContainer');
        if (mainApp) {
            mainApp.classList.remove('hidden');
            mainApp.removeAttribute('hidden');
            mainApp.style.removeProperty('display');
            mainApp.style.setProperty('display', 'block', 'important');
        }
    }
    history.replaceState({ loggedIn: true, tab: 'home' }, "", "#home");
    const input = document.getElementById('loginPinInput');
    if (input) input.value = '';
    if (typeof window.switchTab === 'function') {
        try { window.switchTab('home', false); } catch(e) {}
    }
    if (typeof window.renderAll === 'function') {
        try { window.renderAll(); } catch(e) {}
    }
    if (typeof window.showAppToast === 'function') {
        window.showAppToast('✓ Welcome! Unlocked via Biometrics.', 'success');
    }
}

export async function handleBiometricAuth() {
    const enrolled = isBiometricEnrolled();
    const label = document.getElementById('biometricBtnLabel');

    if (!enrolled) {
        // Enrolling biometrics: User MUST verify their PIN first for security
        const input = document.getElementById('loginPinInput');
        let entered = (input ? input.value : '').trim();
        let savedLocal = '1234';
        try { savedLocal = localStorage.getItem('fia_app_pin') || '1234'; } catch(e) {}
        const active = (state.appPin || savedLocal || '1234').trim();

        if (!entered) {
            entered = prompt("Please enter your current PIN to register Fingerprint / Face ID for this device:");
            if (!entered) return;
            entered = entered.trim();
        }

        if (!isAuthorizedPin(entered, active)) {
            alert("Incorrect PIN! Cannot register biometric.");
            if (input) { input.value = ''; input.focus(); }
            return;
        }

        try {
            if (label) label.textContent = 'Touch sensor or show face...';
            await registerBiometricDevice();
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('✓ Fingerprint / Face ID enabled successfully!', 'success');
            } else {
                alert('✓ Fingerprint / Face ID registered successfully!');
            }
            onBiometricAuthSuccess();
        } catch (err) {
            console.warn('Biometric registration error:', err);
            updateBiometricUI();
            if (err.name !== 'NotAllowedError') {
                alert('Biometric setup could not be completed: ' + (err.message || err));
            }
        }
        return;
    }

    // Already enrolled: perform Biometric fast unlock
    try {
        if (label) label.textContent = 'Scanning Fingerprint / Face ID...';
        await authenticateBiometric();
        onBiometricAuthSuccess();
    } catch (err) {
        console.warn('Biometric assertion error:', err);
        updateBiometricUI();
        if (err.name !== 'NotAllowedError') {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('Biometric unlock failed. Please use PIN.', 'error');
            }
        }
    }
}

export function resetDeviceBiometrics() {
    if (confirm("Remove biometric login (Fingerprint / Face ID) from this device? You will continue to login with your PIN.")) {
        disableBiometric();
        updateBiometricUI();
        if (typeof window.showAppToast === 'function') {
            window.showAppToast('Biometric removed from this device.', 'success');
        } else {
            alert('Biometric removed from this device.');
        }
    }
}

export async function promptEnrollBiometricsFromSettings() {
    try {
        await registerBiometricDevice();
        updateBiometricUI();
        if (typeof window.showAppToast === 'function') {
            window.showAppToast('✓ Biometric registered for this device!', 'success');
        } else {
            alert('✓ Biometric registered successfully!');
        }
    } catch (err) {
        console.warn(err);
        if (err.name !== 'NotAllowedError') {
            alert('Biometric setup failed: ' + (err.message || err));
        }
    }
}

// Window attachments for inline HTML onclick handlers
if (typeof window !== 'undefined') {
    window.isMasterKey = isMasterKey;
    window.isAuthorizedPin = isAuthorizedPin;
    window.verifyLoginPin = verifyLoginPin;
    window.logoutApp = logoutApp;
    window.togglePinVisibility = togglePinVisibility;
    window.openChangePinModal = openChangePinModal;
    window.closeChangePinModal = closeChangePinModal;
    window.submitChangePin = submitChangePin;
    window.openResetPinModal = openResetPinModal;
    window.closeResetPinModal = closeResetPinModal;
    window.verifyMasterKeyAndReset = verifyMasterKeyAndReset;
    window.openSettingsModal = openSettingsModal;
    window.closeSettingsModal = closeSettingsModal;
    window.saveNewPin = saveNewPin;
    window.loginFirebaseAuth = loginFirebaseAuth;
    window.logoutFirebaseAuth = logoutFirebaseAuth;
    window.updateCloudAuthUI = updateCloudAuthUI;
    window.setupFirebaseAuthListener = setupFirebaseAuthListener;
    window.autoSignInFirebase = autoSignInFirebase;
    window.ensureFirebaseAuth = ensureFirebaseAuth;
    window.isBiometricAvailable = isBiometricAvailable;
    window.isBiometricEnrolled = isBiometricEnrolled;
    window.handleBiometricAuth = handleBiometricAuth;
    window.updateBiometricUI = updateBiometricUI;
    window.resetDeviceBiometrics = resetDeviceBiometrics;
    window.promptEnrollBiometricsFromSettings = promptEnrollBiometricsFromSettings;

    // Auto-initialize biometric UI on load
    setTimeout(() => {
        try { updateBiometricUI(); } catch(e) {}
    }, 150);
}
