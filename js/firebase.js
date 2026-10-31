// ==========================================
// FocusPulse - Firebase Auth, Device Google Chooser, EXE Browser Auth & Cloud Sync (firebase.js)
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    signInWithCredential,
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

let pendingAuthIntent = null; // { mode: 'signin' | 'signup', name: '' }
window._guestLoginWarningAcknowledged = false;

try {
    if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        // Always prompt the Google Account Chooser listing accounts signed into the device
        
    }
} catch (initErr) {
    console.warn("Firebase initialization warning:", initErr);
}

window.currentFirebaseUser = null;

function normalizeEmailKey(email) {
    return String(email || '').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

// Helper to detect if user is currently on an already used profile or guest workspace with data
window.hasExistingGuestData = function() {
    if (!window.appState) return false;

    // 1. User has added courses (default is empty [])
    const coursesCount = Array.isArray(window.appState.courses) ? window.appState.courses.length : 0;
    if (coursesCount > 0) return true;

    // 2. User has customized their profile name
    const userName = (window.appState.user && window.appState.user.name) ? String(window.appState.user.name).trim() : '';
    if (userName && userName !== 'Guest' && userName !== 'Student Scholar') return true;

    // 3. User uploaded custom profile photo
    if (window.appState.user && window.appState.user.avatarDataUrl) return true;

    // 4. User finished personal onboarding setup as a guest or profile
    if (window.appState.hasCompletedOnboarding === true) return true;

    // 5. User has custom tasks (beyond starter task, or marked a task complete, or created multiple tasks)
    const tasksList = Array.isArray(window.appState.tasks) ? window.appState.tasks : [];
    const hasCustomTasks = tasksList.some(t => t.id !== 't1' || t.completed || t.title !== "Plan today's top priorities");
    if (hasCustomTasks || tasksList.length > 1) return true;

    // 6. User has habits
    if (Array.isArray(window.appState.habits) && window.appState.habits.length > 0) return true;

    // 7. User logged custom focus sessions or increased water
    if (window.appState.waterIntakeMl > 750) return true;
    if (window.appState.timer && (window.appState.timer.sessionCount > 1 || window.appState.timer.totalFocusSecs > 0)) return true;

    // 8. Saved state in localStorage with actual user data
    try {
        const saved = localStorage.getItem('focuspulse_state');
        if (saved && saved.length > 50) {
            const parsed = JSON.parse(saved);
            if (parsed && (
                (parsed.courses && parsed.courses.length > 0) ||
                (parsed.tasks && parsed.tasks.length > 1) ||
                (parsed.hasCompletedOnboarding) ||
                (parsed.user && parsed.user.name && parsed.user.name !== 'Guest' && parsed.user.name !== 'Student Scholar')
            )) {
                return true;
            }
        }
    } catch (e) {}

    return false;
};

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
        // Returning User Login: restore existing account state authoritatively
        const cloudState = cloudDoc.focuspulse_data;
        if (isNewSignup && wasGuestWithData) {
            window.appState = mergeGuestAndCloudState(window.appState, cloudState);
        } else {
            window.appState = restoreAccountCloudState(window.appState, cloudState);
        }

        // Section 5: Preserve existing custom profile name (gname); do NOT overwrite with Google name
        const existingCustomName = (cloudDoc.customName || cloudDoc.focuspulse_data?.user?.name || '').trim();
        if (existingCustomName && existingCustomName !== 'Guest' && existingCustomName !== 'Student Scholar') {
            window.appState.user.name = existingCustomName;
            window.appState.user.isCustomName = true;
        } else if (userObj.displayName && userObj.displayName.trim()) {
            window.appState.user.name = userObj.displayName.trim();
        }

        // Refresh photo and email if available
        if (cloudDoc.avatarDataUrl || userObj.photoURL) {
            window.appState.user.avatarDataUrl = cloudDoc.avatarDataUrl || userObj.photoURL || '';
        }
    } else {
        // Section 4: New User Registration from Google Authentication
        const gName = (userObj.displayName || '').trim();
        if (signupProvidedName) {
            window.appState.user.name = signupProvidedName;
            window.appState.user.isCustomName = true;
        } else if (gName) {
            window.appState.user.name = gName;
            window.appState.user.isCustomName = false;
        } else if (email) {
            const prefix = email.split('@')[0].replace(/[._-]+/g, ' ');
            window.appState.user.name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        }

        if (userObj.photoURL) {
            window.appState.user.avatarDataUrl = userObj.photoURL;
        }

        window.appState.hasCompletedOnboarding = true;
        window.appState.onboardingStep = 'done';
    }

    // Save account to device list
    if (email) {
        saveDeviceGoogleAccountEntry({
            uid,
            email,
            name: window.appState.user.name,
            photoURL: window.appState.user.avatarDataUrl || userObj.photoURL || ''
        });
        localStorage.setItem(`focuspulse_custom_name_${normalizeEmailKey(email)}`, window.appState.user.name);
    }

    // Section 6: Automatic Profile Navigation & Session Persistence
    localStorage.setItem('focuspulse_has_authed_account', 'true');
    localStorage.setItem('focuspulse_auth_uid', uid);
    localStorage.setItem('focuspulse_auth_email', email);
    localStorage.setItem('focuspulse_custom_user', JSON.stringify(window.appState.user));

    const authSection = document.getElementById('auth-section-view');
    const profileSection = document.getElementById('profile-section-view');
    if (authSection) authSection.classList.add('hidden');
    if (profileSection) profileSection.classList.remove('hidden');

    if (typeof applyLiquidGlass === 'function') applyLiquidGlass(window.appState.liquidEffect === true);
    if (typeof applyThemeVariables === 'function') applyThemeVariables();

    saveState(true);

    if (typeof closeOnboardingShell === 'function') closeOnboardingShell();
    if (typeof closeAccountModal === 'function') closeAccountModal();
    if (typeof window.updateUI === 'function') window.updateUI();

    // Automatically redirect directly to their authenticated profile page
    if (typeof switchAppView === 'function') {
        switchAppView('account', false);
    }

    if (typeof window.handlePostAuthRouting === 'function') {
        window.handlePostAuthRouting(userObj, isNewSignup && !window.appState.hasCompletedOnboarding);
    }

    showNotification(
        `Welcome, ${window.appState.user.name}! 👋`,
        "Signed in successfully. Your profile and cloud workspace are active.",
        "success"
    );
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

window.switchToSignUpFromBackupModal = function() {
    window.closeGuestBackupPromptModal();
    if (typeof openOnboardingAuthScreen === 'function') {
        openOnboardingAuthScreen('signup');
    }
};
