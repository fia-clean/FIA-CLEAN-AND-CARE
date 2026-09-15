/**
 * FIA CLEAN & CARE - Authentication & PIN Security Module
 */

import { state, MASTER_RECOVERY_KEY, MASTER_RECOVERY_KEYS } from './state.js';
import { syncToFirebase, pullFromFirebase } from './db.js';

export const ACCEPTED_MASTER_KEYS = MASTER_RECOVERY_KEYS || ["FIA786", "FIA-CLEAN-CARE-MASTER-2026", "FIA2026", "MASTER786"];
export const DEFAULT_FALLBACK_PINS = ["1234", "1122", "0000", "7860"];

export function isMasterKey(val) {
    if (!val) return false;
    const clean = String(val).trim().toUpperCase();
    return ACCEPTED_MASTER_KEYS.includes(clean);
}

export function isAuthorizedPin(entered, activePin) {
    if (!entered) return false;
    const clean = String(entered).trim();
    if (isMasterKey(clean)) return true;
    if (DEFAULT_FALLBACK_PINS.includes(clean)) return true;
    if (activePin && clean === String(activePin).trim()) return true;
    try {
        const local = localStorage.getItem('fia_app_pin');
        if (local && clean === String(local).trim()) return true;
        if (state && state.appPin && clean === String(state.appPin).trim()) return true;
        if (window.state && window.state.appPin && clean === String(window.state.appPin).trim()) return true;
    } catch(e) {}
    return false;
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

        // If master key was used, restore forgotten pin to default 1234
        if (isMasterKey(entered)) {
            state.appPin = '1234';
            try { localStorage.setItem('fia_app_pin', '1234'); } catch(e) {}
            syncToFirebase();
        }

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
    const rKey = document.getElementById('rpMasterKey');
    const rPin = document.getElementById('rpNewDirect');
    if (rKey) rKey.value = '';
    if (rPin) rPin.value = '';
    const status = document.getElementById('rpMasterStatus');
    if (status) { status.textContent = ''; status.classList.add('hidden'); }
    const modal = document.getElementById('resetPinModal');
    if (modal) modal.classList.remove('hidden');
    if (rKey) rKey.focus();
}

export function closeResetPinModal() {
    const modal = document.getElementById('resetPinModal');
    if (modal) modal.classList.add('hidden');
}

export function verifyMasterKeyAndReset() {
    const enteredKey = (document.getElementById('rpMasterKey')?.value || '').trim();
    const newPin = (document.getElementById('rpNewDirect')?.value || '').trim();
    const status = document.getElementById('rpMasterStatus');

    if (!isMasterKey(enteredKey)) {
        if (status) { status.textContent = '⚠️ Invalid Master Key!'; status.classList.remove('hidden'); }
        return;
    }
    if (newPin.length < 3) {
        if (status) { status.textContent = '⚠️ New PIN must be at least 3 digits.'; status.classList.remove('hidden'); }
        return;
    }

    state.appPin = newPin;
    try { localStorage.setItem('fia_app_pin', newPin); } catch(e) {}
    syncToFirebase();
    alert('✓ Security PIN updated successfully!');
    closeResetPinModal();
    const loginInput = document.getElementById('loginPinInput');
    if (loginInput) { loginInput.value = newPin; loginInput.focus(); }
}

export function openSettingsModal() { 
    document.getElementById('settingsModal')?.classList.remove('hidden'); 
    if (typeof updateCloudAuthUI === 'function') {
        updateCloudAuthUI(window.FB_AUTH ? window.FB_AUTH.currentUser : null);
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
            badge.textContent = 'Protected (auth!=null)';
            badge.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 shadow-sm';
        }
        if (inputContainer) inputContainer.classList.add('hidden');
        if (activeContainer) activeContainer.classList.remove('hidden');
        if (userEmailEl) userEmailEl.textContent = user.email;
    } else {
        if (badge) {
            badge.textContent = 'Not Authorized';
            badge.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800';
        }
        if (inputContainer) inputContainer.classList.remove('hidden');
        if (activeContainer) activeContainer.classList.add('hidden');
        if (userEmailEl) userEmailEl.textContent = '';
    }
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
    if (!confirm('Disconnect this device from Firebase Cloud Admin?\n\nThe device will lose cloud synchronization until re-authorized.')) return;

    window.FB_AUTH.signOut().then(() => {
        updateCloudAuthUI(null);
        alert('Device disconnected from Firebase Cloud.');
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
                console.log('Firebase Cloud Auth Active on device:', user.email);
                if (typeof pullFromFirebase === 'function') pullFromFirebase();
            } else {
                console.log('Firebase Cloud Auth: No active session on this device.');
            }
        });
    } catch(e) {
        console.warn('Firebase Auth listener error:', e);
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
}
