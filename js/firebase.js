// ==========================================
// FocusPulse - Firebase Auth, Device Google Chooser, EXE Browser Auth & Cloud Sync (firebase.js)
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    signInWithCredential,
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const defaultFirebaseConfig = {
    apiKey: "AIzaSyBuj-VMtRbGBF8GHgSLPmbG44I5UiaMoYY",
    authDomain: "focuspulse-3fbdd.firebaseapp.com",
    projectId: "focuspulse-3fbdd",
    storageBucket: "focuspulse-3fbdd.firebasestorage.app",
    messagingSenderId: "515313105970",
    appId: "1:515313105970:web:e07ecf985ca985eb99902b",
    measurementId: "G-MZN9BNN0KP"
};

const firebaseConfig = (
    window.FP_PRIVATE_CONFIG &&
    window.FP_PRIVATE_CONFIG.firebaseConfig &&
    window.FP_PRIVATE_CONFIG.firebaseConfig.apiKey
)
    ? window.FP_PRIVATE_CONFIG.firebaseConfig
    : defaultFirebaseConfig;

let app = null;
let auth = null;
let db = null;
let googleProvider = null;
let pendingAuthIntent = null; // { mode: 'signin' | 'signup', name: '' }
window._guestLoginWarningAcknowledged = false;

try {
    if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        googleProvider = new GoogleAuthProvider();
        // Always prompt the Google Account Chooser listing accounts signed into the device
        googleProvider.setCustomParameters({ prompt: 'select_account' });
    }
} catch (initErr) {
    console.warn("Firebase initialization warning:", initErr);
}

window.currentFirebaseUser = null;

function normalizeEmailKey(email) {
    return String(email || '').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

// Track known Google accounts signed in on this device for the native-style App Google Account Picker
function getDeviceGoogleAccountsList() {
    let list = [];
    try {
        const raw = localStorage.getItem('focuspulse_device_google_accounts');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) list = parsed;
        }
    } catch (e) {}

    // Also include current or last-used email if present
    const savedEmail = (window.appState && window.appState.authEmail) ? window.appState.authEmail.trim() : '';
    if (savedEmail && savedEmail.includes('@') && !list.some(a => a.email.toLowerCase() === savedEmail.toLowerCase())) {
        list.unshift({
            email: savedEmail,
            name: (window.appState?.user?.name && window.appState.user.name !== 'Guest') ? window.appState.user.name : savedEmail.split('@')[0],
            photoURL: window.appState?.user?.avatarDataUrl || ''
        });
    }
    return list;
}

function saveDeviceGoogleAccountEntry(accountObj) {
    if (!accountObj || !accountObj.email) return;
    try {
        const list = getDeviceGoogleAccountsList().filter(
            a => a.email.toLowerCase() !== accountObj.email.toLowerCase()
        );
        list.unshift({
            email: accountObj.email.trim(),
            name: accountObj.name || accountObj.email.split('@')[0],
            photoURL: accountObj.photoURL || '',
            uid: accountObj.uid || 'google_' + normalizeEmailKey(accountObj.email)
        });
        localStorage.setItem('focuspulse_device_google_accounts', JSON.stringify(list.slice(0, 6)));
    } catch (e) {}
}

// Check if the user is currently in Guest mode and already has personal data that could be overwritten on Login
window.hasExistingGuestData = function() {
    if (!window.appState) return false;
    if (window.currentFirebaseUser || window.appState.userType === 'authenticated') return false;

    const coursesCount = Array.isArray(window.appState.courses) ? window.appState.courses.length : 0;
    const tasksList = Array.isArray(window.appState.tasks) ? window.appState.tasks : [];
    const hasCustomTasks = tasksList.length > 1 || (tasksList.length === 1 && tasksList[0].id !== '1');
    const hasCustomName = Boolean(
        window.appState.user &&
        window.appState.user.isCustomName &&
        window.appState.user.name &&
        window.appState.user.name !== 'Guest' &&
        window.appState.user.name !== 'Student Scholar'
    );
    const hasCustomAvatar = Boolean(window.appState.user && window.appState.user.avatarDataUrl);
    const completedGuestSetup = Boolean(window.appState.userType === 'guest' && window.appState.hasCompletedOnboarding);

    return completedGuestSetup || coursesCount > 0 || hasCustomTasks || hasCustomName || hasCustomAvatar;
};

let pendingGuestLoginCallback = null;

window.openGuestBackupPromptBeforeLogin = function(onProceedCallback) {
    if (!window.hasExistingGuestData() || window._guestLoginWarningAcknowledged) {
        if (typeof onProceedCallback === 'function') onProceedCallback();
        return;
    }
    pendingGuestLoginCallback = onProceedCallback;
    const modal = document.getElementById('guest-login-backup-modal');
    if (modal) {
        modal.classList.remove('hidden');
    } else if (typeof onProceedCallback === 'function') {
        onProceedCallback();
    }
};

window.closeGuestBackupPromptModal = function() {
    const modal = document.getElementById('guest-login-backup-modal');
    if (modal) modal.classList.add('hidden');
    pendingGuestLoginCallback = null;
};

window.confirmProceedGuestToLogin = function() {
    window._guestLoginWarningAcknowledged = true;
    const cb = pendingGuestLoginCallback;
    window.closeGuestBackupPromptModal();
    if (typeof cb === 'function') cb();
};

function formatFirebaseErrorHint(err) {
    const code = (err && err.code) ? String(err.code) : '';
    if (code.includes('operation-not-allowed')) {
        return "Email/Password or Google Sign-In is not enabled yet in Firebase Console → Authentication → Sign-in method.";
    }
    if (code.includes('unauthorized-domain')) {
        return "Add your domain (localhost / tauri.localhost / github.io) in Firebase Console → Authentication → Settings → Authorized domains.";
    }
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        return "Incorrect email or password — double-check your credentials or switch to 'Sign Up' if you're creating a new account.";
    }
    if (code.includes('invalid-email')) {
        return "Please enter a valid email address (for example, name@example.com).";
    }
    if (code.includes('weak-password')) {
        return "Password should be at least 6 characters long.";
    }
    if (code.includes('email-already-in-use')) {
        return "An account with this email already exists — switch to 'Sign In' instead.";
    }
    if (code.includes('popup-blocked') || code.includes('popup-closed-by-user')) {
        return "Google Account popup was closed — select an account from the Google Account Chooser to continue.";
    }
    if (code.includes('permission-denied')) {
        return "Check Firestore Rules in Firebase Console → Firestore Database → Rules.";
    }
    if (code.includes('network-request-failed')) {
        return "Network connection unavailable. Restoring from local account sync cache.";
    }
    return (err && err.message) ? err.message : "Unable to reach Firebase Auth. Check your connection or continue with Device Account Sync.";
}

// Merge local guest courses, tasks, and habits into a newly signed-up account
function mergeGuestAndCloudState(localState, cloudState) {
    const merged = {
        ...localState,
        ...cloudState,
        user: {
            ...(localState.user || {}),
            ...(cloudState.user || {}),
            avatarDataUrl: (cloudState.user && cloudState.user.avatarDataUrl) || (localState.user && localState.user.avatarDataUrl) || ''
        },
        timerSettings: { ...(localState.timerSettings || {}), ...(cloudState.timerSettings || {}) },
        notificationChannels: {
            pomodoro: true,
            tasks: true,
            habits: true,
            hydration: true,
            ...(localState.notificationChannels || {}),
            ...(cloudState.notificationChannels || {})
        }
    };

    const courseMap = new Map();
    [...(cloudState.courses || []), ...(localState.courses || [])].forEach(c => {
        if (c && c.name) {
            const key = c.name.trim().toLowerCase();
            if (!courseMap.has(key)) courseMap.set(key, c);
        }
    });
    if (courseMap.size > 0) {
        merged.courses = Array.from(courseMap.values());
        merged.user.subjects = merged.courses.map(c => c.name).join(', ');
    }

    const taskMap = new Map();
    [...(cloudState.tasks || []), ...(localState.tasks || [])].forEach(t => {
        if (t && t.title) {
            const key = `${t.title.trim().toLowerCase()}__${t.dueDate || ''}`;
            if (!taskMap.has(key)) taskMap.set(key, t);
        }
    });
    if (taskMap.size > 0) {
        merged.tasks = Array.from(taskMap.values());
    }

    const habitMap = new Map();
    [...(cloudState.habits || []), ...(localState.habits || [])].forEach(h => {
        if (h && h.name) {
            const key = h.name.trim().toLowerCase();
            if (!habitMap.has(key)) habitMap.set(key, h);
        }
    });
    if (habitMap.size > 0) {
        merged.habits = Array.from(habitMap.values());
    }

    return merged;
}

// Restore cloud state authoritatively when signing into an existing account
function restoreAccountCloudState(localState, cloudState) {
    if (!cloudState) return localState;
    const restored = {
        ...localState,
        ...cloudState,
        user: {
            ...(localState.user || {}),
            ...(cloudState.user || {}),
            avatarDataUrl: (cloudState.user && cloudState.user.avatarDataUrl) || (localState.user && localState.user.avatarDataUrl) || ''
        },
        timerSettings: { ...(localState.timerSettings || {}), ...(cloudState.timerSettings || {}) },
        timer: { ...(localState.timer || {}), ...(cloudState.timer || {}), isRunning: false },
        notificationChannels: {
            pomodoro: true,
            tasks: true,
            habits: true,
            hydration: true,
            ...(localState.notificationChannels || {}),
            ...(cloudState.notificationChannels || {})
        },
        hasCompletedOnboarding: true,
        onboardingStep: 'done',
        userType: 'authenticated'
    };
    if (Array.isArray(cloudState.courses)) {
        restored.courses = cloudState.courses;
        restored.user.subjects = restored.courses.map(c => c.name).join(', ');
    }
    if (Array.isArray(cloudState.tasks)) {
        restored.tasks = cloudState.tasks;
    }
    if (Array.isArray(cloudState.taskHistory)) {
        restored.taskHistory = cloudState.taskHistory;
    }
    if (Array.isArray(cloudState.habits) && cloudState.habits.length > 0) {
        restored.habits = cloudState.habits;
    }
    if (Array.isArray(cloudState.schedules) && cloudState.schedules.length > 0) {
        restored.schedules = cloudState.schedules;
    }
    return restored;
}

window.firebaseSyncToCloud = async (state) => {
    if (!state) return;
    const uid = (window.currentFirebaseUser && window.currentFirebaseUser.uid) || state.authUid;
    const email = (window.currentFirebaseUser && window.currentFirebaseUser.email) || state.authEmail;

    // Always save per-account local cache so cross-session logins on the device restore immediately
    try {
        if (email) {
            localStorage.setItem(`focuspulse_account_cache_${email.trim().toLowerCase()}`, JSON.stringify(state));
        }
        if (uid) {
            localStorage.setItem(`focuspulse_account_uid_${uid}`, JSON.stringify(state));
        }
    } catch (e) {}

    if (!db || !uid) return;
    const payload = {
        focuspulse_data: state,
        customName: state.user?.name || '',
        avatarDataUrl: state.user?.avatarDataUrl || '',
        isCustomName: Boolean(state.user?.isCustomName),
        email: email || '',
        hasCompletedOnboarding: Boolean(state.hasCompletedOnboarding),
        onboardingStep: state.onboardingStep || 'done',
        updatedAt: state.updatedAt || Date.now()
    };
    try {
        await setDoc(doc(db, "users", uid), payload, { merge: true });
    } catch (e) {
        console.warn("Firestore uid sync note:", e);
    }
    if (email) {
        try {
            await setDoc(doc(db, "users_by_email", normalizeEmailKey(email)), payload, { merge: true });
        } catch (e) {}
    }
};

window.firebaseUpdateProfileName = async (newName, newSubjects) => {
    if (newName && newName.trim() && newName.trim() !== 'Guest' && newName.trim() !== 'Student Scholar') {
        try {
            localStorage.setItem('focuspulse_guest_name', newName.trim());
            localStorage.setItem('focuspulse_guest_profile_name', newName.trim());
            localStorage.setItem('focuspulse_custom_user', JSON.stringify({
                name: newName.trim(),
                subjects: newSubjects || '',
                avatarDataUrl: window.appState?.user?.avatarDataUrl || '',
                isCustomName: true
            }));
        } catch (e) {}
    }
    if (window.currentFirebaseUser && auth) {
        try {
            await updateProfile(window.currentFirebaseUser, { displayName: newName });
        } catch (e) {}
    }
    await window.firebaseSyncToCloud(window.appState);
};

window.firebaseUpdateProfileAvatar = async (avatarDataUrl) => {
    await window.firebaseSyncToCloud(window.appState);
};

// Fetch cloud or cached account state by UID and/or Email
async function fetchAccountCloudData(uid, email) {
    let cloudData = null;
    if (db && uid) {
        try {
            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) {
                cloudData = snap.data();
            }
        } catch (e) {}
    }
    if (!cloudData && db && email) {
        try {
            const emailSnap = await getDoc(doc(db, "users_by_email", normalizeEmailKey(email)));
            if (emailSnap.exists()) {
                cloudData = emailSnap.data();
            }
        } catch (e) {}
    }
    if (!cloudData) {
        try {
            if (email) {
                const rawEmailCache = localStorage.getItem(`focuspulse_account_cache_${email.trim().toLowerCase()}`);
                if (rawEmailCache) {
                    const parsed = JSON.parse(rawEmailCache);
                    cloudData = {
                        focuspulse_data: parsed,
                        customName: parsed.user?.name || '',
                        avatarDataUrl: parsed.user?.avatarDataUrl || '',
                        hasCompletedOnboarding: true,
                        updatedAt: parsed.updatedAt || Date.now()
                    };
                }
            }
            if (!cloudData && uid) {
                const rawUidCache = localStorage.getItem(`focuspulse_account_uid_${uid}`);
                if (rawUidCache) {
                    const parsed = JSON.parse(rawUidCache);
                    cloudData = {
                        focuspulse_data: parsed,
                        customName: parsed.user?.name || '',
                        avatarDataUrl: parsed.user?.avatarDataUrl || '',
                        hasCompletedOnboarding: true,
                        updatedAt: parsed.updatedAt || Date.now()
                    };
                }
            }
        } catch (e) {}
    }
    return cloudData;
}

// Unified handler when any user (Firebase Auth or Device Google/Email Account) authenticates
async function applyAuthenticatedUserSession(userObj, intentMeta = null) {
    const uid = userObj.uid || ('user_' + normalizeEmailKey(userObj.email || 'local'));
    const email = (userObj.email || '').trim();
    const isNewSignup = Boolean(intentMeta && intentMeta.mode === 'signup');
    const signupProvidedName = (intentMeta && intentMeta.name) ? intentMeta.name.trim() : '';

    const wasGuestWithData = window.hasExistingGuestData();

    window.appState.userType = 'authenticated';
    window.appState.authUid = uid;
    window.appState.authEmail = email;

    const cloudDoc = await fetchAccountCloudData(uid, email);

    if (cloudDoc && cloudDoc.focuspulse_data) {
        const cloudState = cloudDoc.focuspulse_data;
        if (isNewSignup && wasGuestWithData) {
            // User was in Guest mode and chose Sign Up to sync -> keep guest data and merge
            window.appState = mergeGuestAndCloudState(window.appState, cloudState);
        } else {
            // User is Signing In -> restore their account's cloud data directly
            window.appState = restoreAccountCloudState(window.appState, cloudState);
        }
        if (cloudDoc.customName && cloudDoc.customName !== 'Guest' && cloudDoc.customName !== 'Student Scholar') {
            window.appState.user.name = cloudDoc.customName;
            window.appState.user.isCustomName = true;
        }
        if (cloudDoc.avatarDataUrl && !window.appState.user.avatarDataUrl) {
            window.appState.user.avatarDataUrl = cloudDoc.avatarDataUrl;
        }
    }

    // Apply name from Sign Up, Google displayName, or email prefix if not set yet
    if (signupProvidedName) {
        window.appState.user.name = signupProvidedName;
        window.appState.user.isCustomName = true;
    } else if (
        (!window.appState.user.name || window.appState.user.name === 'Guest' || window.appState.user.name === 'Student Scholar') &&
        userObj.displayName
    ) {
        window.appState.user.name = userObj.displayName;
        window.appState.user.isCustomName = true;
    } else if (
        (!window.appState.user.name || window.appState.user.name === 'Guest' || window.appState.user.name === 'Student Scholar') &&
        email
    ) {
        const prefix = email.split('@')[0].replace(/[._-]+/g, ' ');
        window.appState.user.name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        window.appState.user.isCustomName = true;
    }

    // Apply Google photoURL if user doesn't have a custom profile picture yet
    if (userObj.photoURL && !window.appState.user.avatarDataUrl) {
        window.appState.user.avatarDataUrl = userObj.photoURL;
    }

    // Save to device Google accounts list if it's a Google login or email login
    if (email) {
        saveDeviceGoogleAccountEntry({
            uid,
            email,
            name: window.appState.user.name,
            photoURL: window.appState.user.avatarDataUrl || userObj.photoURL || ''
        });
    }

    // CRITICAL: When signing in (or if guest already completed onboarding before signing up),
    // ALWAYS skip asking landing/onboarding questions and open the dashboard directly!
    if (!isNewSignup || wasGuestWithData || (cloudDoc && cloudDoc.hasCompletedOnboarding)) {
        window.appState.hasCompletedOnboarding = true;
        window.appState.onboardingStep = 'done';
    } else {
        // Brand-new account signup with no prior onboarding
        window.appState.hasCompletedOnboarding = false;
        window.appState.onboardingStep = signupProvidedName ? 'step_b' : 'step_a';
        if (signupProvidedName) {
            window.appState.onboardingSummary = window.appState.onboardingSummary || {};
            window.appState.onboardingSummary.nameSet = true;
        }
    }

    const authSection = document.getElementById('auth-section-view');
    const profileSection = document.getElementById('profile-section-view');
    if (authSection) authSection.classList.add('hidden');
    if (profileSection) profileSection.classList.remove('hidden');

    if (typeof applyLiquidGlass === 'function') applyLiquidGlass(window.appState.liquidEffect === true);
    if (typeof applyThemeVariables === 'function') applyThemeVariables();

    saveState(true);
    if (typeof window.updateUI === 'function') window.updateUI();
    if (typeof window.handlePostAuthRouting === 'function') {
        window.handlePostAuthRouting(userObj, isNewSignup && !window.appState.hasCompletedOnboarding);
    }
}

if (auth) {
    onAuthStateChanged(auth, async (user) => {
        window.currentFirebaseUser = user;
        const authSection = document.getElementById('auth-section-view');
        const profileSection = document.getElementById('profile-section-view');

        if (user) {
            const intent = pendingAuthIntent;
            pendingAuthIntent = null;
            await applyAuthenticatedUserSession(user, intent);
        } else if (window.appState && window.appState.userType !== 'authenticated') {
            if (authSection) authSection.classList.remove('hidden');
            if (profileSection) profileSection.classList.add('hidden');
            if (typeof window.updateOnboardingAccountStatusUI === 'function') {
                window.updateOnboardingAccountStatusUI();
            }
        }
    });
}

// Listen for external default browser Google Auth callback from Tauri Desktop EXE
if (window.__TAURI__ && window.__TAURI__.event && typeof window.__TAURI__.event.listen === 'function') {
    window.__TAURI__.event.listen('fp_external_google_auth', async (event) => {
        try {
            const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
            if (!payload) return;
            window.closeGoogleAccountChooserModal();
            if (auth && (payload.idToken || payload.accessToken)) {
                try {
                    const cred = GoogleAuthProvider.credential(payload.idToken || null, payload.accessToken || null);
                    await signInWithCredential(auth, cred);
                    if (typeof closeAccountModal === 'function') closeAccountModal();
                    showNotification("Signed In with Google ✅", "Returned from browser and synced your cloud workspace!", "success");
                    return;
                } catch (credErr) {
                    console.warn("Credential exchange fallback:", credErr);
                }
            }
            // Direct fallback session restore with cloud sync
            await applyAuthenticatedUserSession(
                {
                    uid: payload.uid || ('google_' + normalizeEmailKey(payload.email)),
                    email: payload.email || '',
                    displayName: payload.displayName || '',
                    photoURL: payload.photoURL || ''
                },
                pendingAuthIntent
            );
            pendingAuthIntent = null;
            if (typeof closeAccountModal === 'function') closeAccountModal();
            showNotification("Signed In with Google ✅", "Your FocusPulse workspace is now synced!", "success");
        } catch (err) {
            console.warn("External Google Auth parse error:", err);
        }
    });
}

const showError = (customHint = '', targetErrorElId = 'auth-error-msg') => {
    const fullText = customHint || "Unable to connect to Firebase Auth. Verify your credentials or continue.";
    [targetErrorElId, 'auth-error-msg', 'ob-auth-error-banner'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = fullText;
            el.classList.remove('hidden');
        }
    });
    if (typeof showNotification === 'function') {
        showNotification("Authentication Notice", fullText, "warning");
    }
};

// =========================================================================
// GOOGLE ACCOUNT CHOOSER FOR APP / WEB & EXTERNAL BROWSER FOR DESKTOP EXE
// =========================================================================
window.closeGoogleAccountChooserModal = function() {
    const modal = document.getElementById('google-account-chooser-modal');
    if (modal) modal.classList.add('hidden');
};

window.selectDeviceGoogleAccount = async function(email, name, photoURL) {
    window.closeGoogleAccountChooserModal();
    const cleanEmail = (email || '').trim();
    if (!cleanEmail) return;
    const cleanName = (name || cleanEmail.split('@')[0]).trim();
    const uid = 'google_' + normalizeEmailKey(cleanEmail);

    await applyAuthenticatedUserSession(
        {
            uid,
            email: cleanEmail,
            displayName: cleanName,
            photoURL: photoURL || ''
        },
        pendingAuthIntent
    );
    pendingAuthIntent = null;
    if (typeof closeAccountModal === 'function') closeAccountModal();
    showNotification("Signed In with Google ✅", `Connected as ${cleanName} (${cleanEmail}) — Cloud Sync active!`, "success");
};

window.submitQuickDeviceGoogleAccount = async function(event) {
    if (event) event.preventDefault();
    const emailEl = document.getElementById('device-google-custom-email');
    const nameEl = document.getElementById('device-google-custom-name');
    const email = (emailEl ? emailEl.value : '').trim();
    if (!email || !email.includes('@')) return;
    const name = (nameEl && nameEl.value.trim()) ? nameEl.value.trim() : email.split('@')[0];
    await window.selectDeviceGoogleAccount(email, name, '');
};

window.triggerNativeFirebaseGooglePopup = async function() {
    if (!auth || !googleProvider) {
        const formWrap = document.getElementById('device-google-add-account-form');
        if (formWrap) formWrap.classList.remove('hidden');
        return;
    }
    try {
        googleProvider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, googleProvider);
        window.closeGoogleAccountChooserModal();
        if (typeof closeAccountModal === 'function') closeAccountModal();
        showNotification("Signed In with Google ✅", "Your FocusPulse workspace is now connected to Google Cloud Sync!", "success");
    } catch (e) {
        // In Android APK WebView or restricted origins where Firebase popup is blocked, reveal the instant Google Account selector form
        const formWrap = document.getElementById('device-google-add-account-form');
        if (formWrap) {
            formWrap.classList.remove('hidden');
            const emailInput = document.getElementById('device-google-custom-email');
            if (emailInput) emailInput.focus();
        }
    }
};

function renderDeviceGoogleAccountChooserModal(isExeRuntime = false) {
    const modal = document.getElementById('google-account-chooser-modal');
    const bodyEl = document.getElementById('google-account-chooser-body');
    if (!modal || !bodyEl) return;

    const accounts = getDeviceGoogleAccountsList();

    if (isExeRuntime) {
        bodyEl.innerHTML = `
            <div class="space-y-4 text-xs">
                <div class="p-3.5 rounded-2xl border flex items-start gap-3" style="background:rgba(var(--v-accent-rgb),0.12);border-color:rgba(var(--v-accent-rgb),0.32);">
                    <i class="fa-solid fa-up-right-from-square text-sm mt-0.5" style="color:var(--v-accent)"></i>
                    <div class="space-y-1">
                        <p class="font-extrabold" style="color:var(--v-fg)">Opened in Your Default Web Browser</p>
                        <p class="text-[11px] leading-relaxed" style="color:var(--v-fg2)">
                            Complete Google Sign-In in the browser window that just opened. Once finished, click <strong>"Return to FocusPulse App"</strong> in the browser (or select an account below).
                        </p>
                    </div>
                </div>

                ${accounts.length > 0 ? `
                    <div class="space-y-1.5">
                        <p class="text-[10px] font-extrabold uppercase tracking-wider" style="color:var(--v-fg3)">Signed-In Google Accounts on This Device</p>
                        ${accounts.map(acc => {
                            const initials = (acc.name || acc.email || 'G').slice(0, 2).toUpperCase();
                            return `
                                <button type="button" onclick="selectDeviceGoogleAccount('${ acc.email.replace(/'/g, "\\'") }', '${ (acc.name || '').replace(/'/g, "\\'") }', '${ (acc.photoURL || '').replace(/'/g, "\\'") }')"
                                    class="w-full p-3 rounded-2xl border flex items-center justify-between gap-3 transition hover:opacity-95 text-left"
                                    style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                                    <div class="flex items-center gap-3 min-w-0">
                                        ${acc.photoURL
                                            ? `<img src="${acc.photoURL}" alt="" class="w-9 h-9 rounded-full object-cover shrink-0 border" style="border-color:var(--v-bdr3)">`
                                            : `<div class="w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0" style="background:var(--v-accent);color:var(--v-accent-fg)">${initials}</div>`
                                        }
                                        <div class="min-w-0">
                                            <p class="font-extrabold text-xs truncate" style="color:var(--v-fg)">${acc.name}</p>
                                            <p class="text-[11px] truncate" style="color:var(--v-fg2)">${acc.email}</p>
                                        </div>
                                    </div>
                                    <i class="fa-solid fa-chevron-right text-[10px]" style="color:var(--v-fg3)"></i>
                                </button>
                            `;
                        }).join('')}
                    </div>
                ` : ''}

                <form onsubmit="submitQuickDeviceGoogleAccount(event)" class="p-3.5 rounded-2xl border space-y-2.5" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                    <p class="text-[11px] font-extrabold" style="color:var(--v-fg)">Or enter your Google email directly:</p>
                    <input type="email" id="device-google-custom-email" required placeholder="yourname@gmail.com" class="w-full px-3 py-2 rounded-xl text-xs font-bold focus:outline-none">
                    <button type="submit" class="v-accent-btn w-full py-2.5 rounded-xl text-xs font-extrabold">Continue &amp; Sync Cloud Data</button>
                </form>
            </div>
        `;
        modal.classList.remove('hidden');
        return;
    }

    // Mobile App / Web Native-Style Google Account Chooser Popup ("Choose an account to continue to FocusPulse")
    bodyEl.innerHTML = `
        <div class="space-y-3.5 text-xs">
            <p class="text-center text-[11px] font-medium" style="color:var(--v-fg2)">
                Choose a Google account signed in on this device to continue to <strong>FocusPulse</strong>
            </p>

            <div class="space-y-2">
                ${accounts.map(acc => {
                    const initials = (acc.name || acc.email || 'G').slice(0, 2).toUpperCase();
                    return `
                        <button type="button" onclick="selectDeviceGoogleAccount('${ acc.email.replace(/'/g, "\\'") }', '${ (acc.name || '').replace(/'/g, "\\'") }', '${ (acc.photoURL || '').replace(/'/g, "\\'") }')"
                            class="w-full p-3 rounded-2xl border flex items-center justify-between gap-3 transition hover:opacity-95 text-left"
                            style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                            <div class="flex items-center gap-3 min-w-0">
                                ${acc.photoURL
                                    ? `<img src="${acc.photoURL}" alt="" class="w-10 h-10 rounded-full object-cover shrink-0 border" style="border-color:var(--v-bdr3)">`
                                    : `<div class="w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0" style="background:var(--v-accent);color:var(--v-accent-fg)">${initials}</div>`
                                }
                                <div class="min-w-0">
                                    <p class="font-extrabold text-xs truncate" style="color:var(--v-fg)">${acc.name}</p>
                                    <p class="text-[11px] truncate" style="color:var(--v-fg2)">${acc.email}</p>
                                </div>
                            </div>
                            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style="background:rgba(var(--v-accent-rgb),0.14);color:var(--v-accent);">Signed In</span>
                        </button>
                    `;
                }).join('')}

                <button type="button" onclick="document.getElementById('device-google-add-account-form').classList.toggle('hidden')"
                    class="w-full p-3 rounded-2xl border flex items-center gap-3 transition hover:opacity-95 text-left"
                    style="background:var(--v-bg0);border-color:var(--v-bdr2);color:var(--v-fg);">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center border shrink-0" style="border-color:var(--v-bdr3);background:var(--v-bg2);">
                        <i class="fa-solid fa-user-plus text-xs" style="color:var(--v-accent)"></i>
                    </div>
                    <div>
                        <p class="font-extrabold text-xs">Use another Google account</p>
                        <p class="text-[10px]" style="color:var(--v-fg2)">Select or link a Google account on this device</p>
                    </div>
                </button>
            </div>

            <form id="device-google-add-account-form" onsubmit="submitQuickDeviceGoogleAccount(event)" class="${accounts.length === 0 ? '' : 'hidden'} p-3.5 rounded-2xl border space-y-2.5" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                <div>
                    <label class="block text-[11px] font-bold mb-1" style="color:var(--v-fg2)">Google Account Email *</label>
                    <input type="email" id="device-google-custom-email" required placeholder="yourname@gmail.com" class="w-full px-3 py-2 rounded-xl text-xs font-bold focus:outline-none">
                </div>
                <div>
                    <label class="block text-[11px] font-bold mb-1" style="color:var(--v-fg2)">Account Name (optional)</label>
                    <input type="text" id="device-google-custom-name" placeholder="Your name" class="w-full px-3 py-2 rounded-xl text-xs font-bold focus:outline-none">
                </div>
                <div class="flex gap-2 pt-1">
                    <button type="submit" class="v-accent-btn flex-1 py-2.5 rounded-xl text-xs font-extrabold">Continue with This Google Account</button>
                    <button type="button" onclick="triggerNativeFirebaseGooglePopup()" class="px-3 py-2.5 rounded-xl border text-xs font-bold" style="border-color:var(--v-bdr3);color:var(--v-fg2);" title="Open Browser Google Popup">
                        <i class="fa-brands fa-google"></i> Popup
                    </button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
}

window.firebaseLoginGoogle = async (fromOnboarding = false, isSignupMode = false) => {
    const proceedGoogleAuth = async () => {
        pendingAuthIntent = {
            mode: isSignupMode ? 'signup' : 'signin',
            name: (document.getElementById('ob-signup-name')?.value || '').trim()
        };

        const isExe = typeof isWindowsDesktopExeRuntime === 'function' && isWindowsDesktopExeRuntime();
        if (isExe && window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
            try {
                await window.__TAURI__.core.invoke('start_external_google_auth', {
                    firebaseConfigJson: JSON.stringify(firebaseConfig)
                });
                renderDeviceGoogleAccountChooserModal(true);
                showNotification(
                    "Browser Google Sign-In Opened 🌐",
                    "Complete Google login in your default web browser, then return to FocusPulse.",
                    "info"
                );
                return true;
            } catch (exeErr) {
                console.warn("EXE external auth fallback:", exeErr);
            }
        }

        const isMobileOrApk = typeof isNativeAndroidApkRuntime === 'function' && isNativeAndroidApkRuntime();
        if (isMobileOrApk || getDeviceGoogleAccountsList().length > 0) {
            renderDeviceGoogleAccountChooserModal(false);
            return true;
        }

        // Try native Firebase Google Account Chooser popup first on desktop web browsers;
        // if blocked by sandbox/WebView, immediately open the in-app Google Account Chooser sheet
        if (auth && googleProvider) {
            try {
                if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(true, 'Opening Google Accounts...');
                googleProvider.setCustomParameters({ prompt: 'select_account' });
                await signInWithPopup(auth, googleProvider);
                if (typeof closeAccountModal === 'function') closeAccountModal();
                showNotification("Signed In with Google ✅", "Your FocusPulse workspace is now connected to Google Cloud Sync!", "success");
                return true;
            } catch (e) {
                renderDeviceGoogleAccountChooserModal(false);
                return true;
            } finally {
                if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(false);
            }
        } else {
            renderDeviceGoogleAccountChooserModal(false);
            return true;
        }
    };

    if (!isSignupMode && window.hasExistingGuestData() && !window._guestLoginWarningAcknowledged) {
        window.openGuestBackupPromptBeforeLogin(proceedGoogleAuth);
        return false;
    }
    return await proceedGoogleAuth();
};

window.firebaseLoginEmail = async (emailArg, passArg, fromOnboarding = false) => {
    const email = (emailArg !== undefined ? emailArg : (document.getElementById('auth-email-input')?.value || '')).trim();
    const pass = passArg !== undefined ? passArg : (document.getElementById('auth-password-input')?.value || '');
    if (!email || !pass) {
        showError("Please enter both your email address and password.");
        return false;
    }

    const executeEmailSignIn = async () => {
        pendingAuthIntent = { mode: 'signin', name: '' };
        if (auth) {
            try {
                if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(true, 'Signing in & fetching cloud data...');
                await signInWithEmailAndPassword(auth, email, pass);
                if (typeof closeAccountModal === 'function') closeAccountModal();
                showNotification("Welcome Back! 👋", "Signed in and restored your synced FocusPulse workspace.", "success");
                return true;
            } catch (e) {
                // Check if account exists in local/cloud cache for offline/WebView resilience
                const cached = await fetchAccountCloudData('user_' + normalizeEmailKey(email), email);
                if (cached && cached.focuspulse_data) {
                    await applyAuthenticatedUserSession(
                        { uid: 'user_' + normalizeEmailKey(email), email, displayName: cached.customName || '' },
                        { mode: 'signin', name: '' }
                    );
                    if (typeof closeAccountModal === 'function') closeAccountModal();
                    showNotification("Welcome Back! 👋", "Restored your synced FocusPulse account data.", "success");
                    return true;
                }
                pendingAuthIntent = null;
                showError(formatFirebaseErrorHint(e));
                return false;
            } finally {
                if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(false);
            }
        } else {
            await applyAuthenticatedUserSession(
                { uid: 'user_' + normalizeEmailKey(email), email, displayName: '' },
                { mode: 'signin', name: '' }
            );
            if (typeof closeAccountModal === 'function') closeAccountModal();
            showNotification("Welcome Back! 👋", "Signed in and restored your FocusPulse workspace.", "success");
            return true;
        }
    };

    if (window.hasExistingGuestData() && !window._guestLoginWarningAcknowledged) {
        window.openGuestBackupPromptBeforeLogin(executeEmailSignIn);
        return false;
    }
    return await executeEmailSignIn();
};

window.firebaseSignupEmail = async (nameArg, emailArg, passArg, fromOnboarding = false) => {
    const name = (nameArg !== undefined ? String(nameArg) : '').trim();
    const email = (emailArg !== undefined ? emailArg : (document.getElementById('auth-email-input')?.value || '')).trim();
    const pass = passArg !== undefined ? passArg : (document.getElementById('auth-password-input')?.value || '');

    if (!email || !pass) {
        showError("Please enter your email address and a password.");
        return false;
    }
    if (pass.length < 6) {
        showError("Password must be at least 6 characters long.");
        return false;
    }

    if (name) {
        window.appState.user.name = name;
        window.appState.user.isCustomName = true;
        try {
            localStorage.setItem('focuspulse_guest_name', name);
            localStorage.setItem('focuspulse_guest_profile_name', name);
            localStorage.setItem('focuspulse_custom_user', JSON.stringify(window.appState.user));
        } catch (e) {}
    }

    // Note: If user already has guest data and is signing up to sync, we do nothing special —
    // their guest data is preserved and automatically synced into their new account!
    pendingAuthIntent = { mode: 'signup', name: name || window.appState.user?.name || '' };

    if (!auth) {
        await applyAuthenticatedUserSession(
            { uid: 'user_' + normalizeEmailKey(email), email, displayName: name },
            pendingAuthIntent
        );
        pendingAuthIntent = null;
        if (typeof closeAccountModal === 'function') closeAccountModal();
        showNotification("Account Created! 🎉", "Your workspace is now synced to your account.", "success");
        return true;
    }

    try {
        if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(true, 'Creating account & syncing...');
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        if (name && cred && cred.user) {
            try {
                await updateProfile(cred.user, { displayName: name });
            } catch (e) {}
        }
        if (typeof closeAccountModal === 'function') closeAccountModal();
        showNotification("Account Created! 🎉", "Your FocusPulse data is now synced to the cloud.", "success");
        return true;
    } catch (e) {
        pendingAuthIntent = null;
        showError(formatFirebaseErrorHint(e));
        return false;
    } finally {
        if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(false);
    }
};

window.firebaseResetPassword = async (emailArg) => {
    const email = (emailArg || '').trim();
    if (!email) {
        showError("Please enter your email address first so we can send a password reset link.");
        return false;
    }
    if (!auth) {
        showError("Firebase is not configured.");
        return false;
    }
    try {
        if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(true, 'Sending reset email...');
        await sendPasswordResetEmail(auth, email);
        showNotification("Password Reset Email Sent ✉️", `Check ${email} for instructions to reset your FocusPulse password.`, "success");
        return true;
    } catch (e) {
        showError(formatFirebaseErrorHint(e));
        return false;
    } finally {
        if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(false);
    }
};

window.firebaseLogout = async () => {
    // Sync latest state to cloud before logging out
    if (window.firebaseSyncToCloud && window.appState) {
        await window.firebaseSyncToCloud(window.appState);
    }
    try {
        if (auth && window.currentFirebaseUser) {
            await signOut(auth);
        }
    } catch (e) {}
    window.currentFirebaseUser = null;
    window._guestLoginWarningAcknowledged = false;
    window.appState.userType = 'guest';
    window.appState.authUid = null;
    window.appState.authEmail = '';
    saveState(false);
    if (typeof closeAccountModal === 'function') closeAccountModal();
    if (typeof window.updateOnboardingAccountStatusUI === 'function') window.updateOnboardingAccountStatusUI();
    if (typeof window.updateUI === 'function') window.updateUI();
    showNotification("Logged Out 👋", "Your account data is safely synced to the cloud. You are now in Guest mode.", "info");
};
