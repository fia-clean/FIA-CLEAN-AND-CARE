/**
 * FIA CLEAN & CARE - Biometric Authentication (WebAuthn / Passkeys) Module
 * Supports Touch ID / Face ID (iOS) & Fingerprint / Face Unlock (Android)
 * Fully local to the device; does not affect cloud database or backups.
 */

// Utility: ArrayBuffer to Base64 string
export function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Utility: Base64 string to ArrayBuffer
export function base64ToBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Check if the current browser and device hardware support WebAuthn biometrics
 * Must be in a secure context (HTTPS or localhost)
 */
export async function isBiometricAvailable() {
    try {
        if (!window.isSecureContext) {
            return false;
        }
        if (!window.PublicKeyCredential) {
            return false;
        }
        if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
            return false;
        }
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return !!available;
    } catch (e) {
        console.warn('Biometric availability check failed:', e);
        return false;
    }
}

/**
 * Check if biometrics has been enrolled on this specific device
 */
export function isBiometricEnrolled() {
    try {
        const enabled = localStorage.getItem('fia_biometric_enabled') === 'true';
        const credId = localStorage.getItem('fia_biometric_cred_id');
        return !!(enabled && credId);
    } catch (e) {
        return false;
    }
}

/**
 * Register biometric credential on this device (Fingerprint / Face ID)
 */
export async function registerBiometricDevice() {
    const isAvail = await isBiometricAvailable();
    if (!isAvail) {
        throw new Error('Biometric hardware is not available or supported on this device/browser.');
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    // Relying Party configuration
    const rpConfig = {
        name: 'FIA CLEAN & CARE'
    };
    const hostname = window.location.hostname;
    // Only set rp.id if hostname is a valid domain or localhost (not raw IP)
    if (hostname && !/^[0-9.]+$/.test(hostname)) {
        rpConfig.id = hostname;
    }

    const createOptions = {
        publicKey: {
            challenge: challenge,
            rp: rpConfig,
            user: {
                id: userId,
                name: 'fia_user_' + Date.now(),
                displayName: 'FIA Clean User'
            },
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },   // ES256
                { type: 'public-key', alg: -257 }  // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform', // Fingerprint, Face ID, Screen Lock
                userVerification: 'required',
                residentKey: 'preferred'
            },
            timeout: 60000,
            attestation: 'none'
        }
    };

    const credential = await navigator.credentials.create(createOptions);
    if (!credential) {
        throw new Error('Biometric registration was cancelled or failed.');
    }

    const credIdBase64 = bufferToBase64(credential.rawId);
    localStorage.setItem('fia_biometric_cred_id', credIdBase64);
    localStorage.setItem('fia_biometric_enabled', 'true');
    return true;
}

/**
 * Authenticate using registered biometric credential
 */
export async function authenticateBiometric() {
    const enrolled = isBiometricEnrolled();
    if (!enrolled) {
        throw new Error('Biometrics not registered yet on this device.');
    }

    const credIdBase64 = localStorage.getItem('fia_biometric_cred_id');
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const getOptions = {
        publicKey: {
            challenge: challenge,
            timeout: 60000,
            userVerification: 'required',
            allowCredentials: [
                {
                    id: base64ToBuffer(credIdBase64),
                    type: 'public-key'
                }
            ]
        }
    };

    const assertion = await navigator.credentials.get(getOptions);
    if (!assertion) {
        throw new Error('Biometric verification cancelled.');
    }
    return true;
}

/**
 * Disable biometrics on this device
 */
export function disableBiometric() {
    try {
        localStorage.removeItem('fia_biometric_cred_id');
        localStorage.removeItem('fia_biometric_enabled');
    } catch (e) {}
}
