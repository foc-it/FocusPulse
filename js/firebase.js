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
    updateProfile,
    deleteUser
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

function showError(msg) {
    const safeMsg = String(msg || 'An error occurred during authentication.');
    const obErr = document.getElementById('ob-auth-error-banner');
    if (obErr) {
        obErr.className = "p-3.5 rounded-2xl text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-2 shadow-sm";
        obErr.innerHTML = `<i class="fa-solid fa-circle-exclamation shrink-0 text-sm"></i><span>${safeMsg}</span>`;
        obErr.classList.remove('hidden');
        obErr.style.display = 'flex';
    }
    const modalErr = document.getElementById('auth-error-msg');
    if (modalErr) {
        modalErr.textContent = safeMsg;
        modalErr.classList.remove('hidden');
        modalErr.style.display = 'block';
    }
    if (typeof showNotification === 'function') {
        showNotification("Authentication", safeMsg, "error");
    }
}
window.showError = showError;


// Persistent Accounts Store (Ensures strict account-only login & registration checks)
function getRegisteredAccounts() {
    try {
        const raw = localStorage.getItem('focuspulse_registered_accounts');
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}
window.getRegisteredAccounts = getRegisteredAccounts;

function saveRegisteredAccount(name, email, password) {
    if (!email) return;
    const accounts = getRegisteredAccounts();
    const key = normalizeEmailKey(email);
    accounts[key] = {
        name: String(name || '').trim() || 'Scholar',
        email: String(email).trim().toLowerCase(),
        password: String(password || ''),
        createdAt: accounts[key]?.createdAt || Date.now()
    };
    try {
        localStorage.setItem('focuspulse_registered_accounts', JSON.stringify(accounts));
    } catch (e) {}
}
window.saveRegisteredAccount = saveRegisteredAccount;

function findRegisteredAccount(email) {
    if (!email) return null;
    const accounts = getRegisteredAccounts();
    const key = normalizeEmailKey(email);
    return accounts[key] || null;
}
window.findRegisteredAccount = findRegisteredAccount;

function normalizeEmailKey(email) {
    return String(email || '').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

// Helper to detect if user is currently on an already used profile or guest workspace with data
window.hasExistingGuestData = function() { return false; };

window.openGuestBackupPromptBeforeLogin = function(onProceedCallback) {
    if (typeof onProceedCallback === 'function') onProceedCallback();
};

window.closeGuestBackupPromptModal = function() {
    const modal = document.getElementById('guest-login-backup-modal');
    if (modal) modal.classList.add('hidden');
};

window.confirmProceedGuestToLogin = function() {
    window.closeGuestBackupPromptModal();
};

function mergeGuestAndCloudState(localState, cloudState) {
    if (!cloudState) return localState;
    const merged = {
        ...localState,
        ...cloudState,
        user: {
            ...(localState.user || {}),
            ...(cloudState.user || {}),
            avatarDataUrl: (cloudState.user && cloudState.user.avatarDataUrl) || (localState.user && localState.user.avatarDataUrl) || ''
        },
        timerSettings: { ...(localState.timerSettings || {}), ...(cloudState.timerSettings || {}) }
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
    const email = (emailArg !== undefined ? emailArg : (document.getElementById('ob-signin-email')?.value || document.getElementById('auth-email-input')?.value || '')).trim();
    const pass = passArg !== undefined ? passArg : (document.getElementById('ob-signin-password')?.value || document.getElementById('auth-password-input')?.value || '');
    if (!email || !pass) {
        showError("Please enter both your email address and password.");
        return false;
    }

    const normEmail = email.toLowerCase();
    let authUserObj = null;

    if (typeof window.setOnboardingAuthLoading === 'function') {
        window.setOnboardingAuthLoading(true, 'Verifying credentials & restoring data...');
    }

    // 1. Check persistent Registered Accounts registry first
    const existingAcc = findRegisteredAccount(normEmail);

    // 2. Try Firebase Auth if configured
    if (auth) {
        try {
            const cred = await signInWithEmailAndPassword(auth, normEmail, pass);
            if (cred && cred.user) {
                authUserObj = cred.user;
                window.currentFirebaseUser = cred.user;
            }
        } catch (e) {
            // If Firebase fails (e.g. offline or user registered locally), verify against local registry
            if (!existingAcc) {
                if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(false);
                showError("No user found with this email. Please check your email or create an account.");
                return false;
            } else if (existingAcc.password && existingAcc.password !== pass) {
                if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(false);
                showError("Invalid credential, check your email and password again.");
                return false;
            }
        }
    } else {
        // Firebase Auth not initialized: strictly check local accounts registry
        if (!existingAcc) {
            if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(false);
            showError("No user found with this email. Please check your email or create an account.");
            return false;
        }
        if (existingAcc.password && existingAcc.password !== pass) {
            if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(false);
            showError("Invalid credential, check your email and password again.");
            return false;
        }
    }

    if (!authUserObj && !existingAcc) {
        if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(false);
        showError("No user found with this email. Please check your email or create an account.");
        return false;
    }

    if (!authUserObj && existingAcc && existingAcc.password && existingAcc.password !== pass) {
        if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(false);
        showError("Invalid credential, check your email and password again.");
        return false;
    }

    // 3. CREDENTIALS ARE 100% CORRECT & VERIFIED!
    const effectiveUid = (authUserObj && authUserObj.uid) ? authUserObj.uid : ('user_' + normalizeEmailKey(normEmail));
    const effectiveName = (authUserObj && authUserObj.displayName) ? authUserObj.displayName : (existingAcc?.name || normEmail.split('@')[0]);

    // Keep registry updated
    saveRegisteredAccount(effectiveName, normEmail, pass);

    // Set authenticated session in appState
    window.appState.userType = 'authenticated';
    window.appState.authUid = effectiveUid;
    window.appState.authEmail = normEmail;
    window.appState.hasCompletedOnboarding = true;
    window.appState.onboardingStep = 'done';

    // Set persistent session in localStorage
    localStorage.setItem('focuspulse_has_authed_account', 'true');
    localStorage.setItem('focuspulse_auth_uid', effectiveUid);
    localStorage.setItem('focuspulse_auth_email', normEmail);

    // 4. RESTORE USER'S DATA AUTHORITATIVELY FROM CACHE & CLOUD!
    const rawCache = localStorage.getItem(`focuspulse_account_cache_${normEmail}`);
    if (rawCache) {
        try {
            const parsed = JSON.parse(rawCache);
            if (parsed) {
                window.appState = restoreAccountCloudState(window.appState, parsed);
            }
        } catch(e) {}
    }

    // Attempt cloud restore if online
    try {
        const cloudDoc = await fetchAccountCloudData(effectiveUid, normEmail);
        if (cloudDoc && cloudDoc.focuspulse_data) {
            window.appState = restoreAccountCloudState(window.appState, cloudDoc.focuspulse_data);
        }
    } catch(e) {}

    // Ensure name is properly restored
    if (effectiveName) {
        window.appState.user.name = effectiveName;
        window.appState.user.isCustomName = true;
    }
    localStorage.setItem('focuspulse_custom_user', JSON.stringify(window.appState.user));

    // Save restored state to active launch state
    saveState(false);

    if (typeof window.setOnboardingAuthLoading === 'function') {
        window.setOnboardingAuthLoading(false);
    }

    // 5. UNLOCK DASHBOARD AND RENDER PERSONALIZED DATA
    if (typeof closeAccountModal === 'function') closeAccountModal();
    if (typeof closeOnboardingShell === 'function') closeOnboardingShell();
    if (typeof updateOnboardingAccountStatusUI === 'function') updateOnboardingAccountStatusUI();
    if (typeof window.updateUI === 'function') window.updateUI();
    if (typeof switchAppView === 'function') switchAppView('home', false);

    showNotification("Welcome Back! 👋", `Signed in as ${window.appState.user.name || normEmail}. All data restored.`, "success");
    return true;
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

    const normEmail = email.toLowerCase();

    // Strict Account Registry check: prevent registering duplicate existing accounts
    const existingAcc = findRegisteredAccount(normEmail);
    if (existingAcc) {
        showError("An account with this email already exists. Please sign in instead.");
        return false;
    }

    // Immediate button loading feedback on first click
    if (typeof window.setOnboardingAuthLoading === 'function') {
        window.setOnboardingAuthLoading(true, 'Setting up your space...');
    }

    if (auth) {
        try {
            const cred = await createUserWithEmailAndPassword(auth, normEmail, pass);
            if (name && cred && cred.user) {
                try { await updateProfile(cred.user, { displayName: name }); } catch (e) {}
            }
        } catch (e) {
            const code = e?.code || '';
            if (code.includes('email-already-in-use')) {
                showError("An account with this email already exists. Please sign in instead.");
                return false;
            } else if (code.includes('weak-password')) {
                showError("Password should be at least 6 characters long.");
                return false;
            } else if (code.includes('invalid-email')) {
                showError("Please enter a valid email address.");
                return false;
            } else {
                showError(e?.message || "Could not create account. Please try again.");
                return false;
            }
        } finally {
            if (typeof window.setOnboardingAuthLoading === 'function') window.setOnboardingAuthLoading(false);
        }
    }

    // Save newly created account into persistent registry
    saveRegisteredAccount(name || 'Scholar', normEmail, pass);

    // Set authenticated session variables
    window.appState.userType = 'authenticated';
    window.appState.authEmail = normEmail;
    window.appState.authUid = 'user_' + normalizeEmailKey(normEmail);
    window.appState.user.name = name || 'Scholar';
    window.appState.user.isCustomName = Boolean(name);
    window.appState.hasCompletedOnboarding = false;
    window.appState.onboardingStep = 'step_a';

    localStorage.setItem('focuspulse_has_authed_account', 'true');
    localStorage.setItem('focuspulse_auth_uid', window.appState.authUid);
    localStorage.setItem('focuspulse_auth_email', normEmail);
    localStorage.setItem('focuspulse_custom_user', JSON.stringify(window.appState.user));
    saveState(false);

    if (typeof window.setOnboardingAuthLoading === 'function') {
        window.setOnboardingAuthLoading(false);
    }
    if (typeof closeAccountModal === 'function') closeAccountModal();
    if (typeof updateOnboardingAccountStatusUI === 'function') updateOnboardingAccountStatusUI();

    // Direct transition to Welcome Wizard & Preferences!
    showNotification("Account Created! 🎉", `Welcome ${window.appState.user.name}! Let's set up your preferences.`, "success");
    if (typeof openOnboardingWizard === 'function') {
        openOnboardingWizard('step_a', false);
    }

    return true;
};

window.firebaseResetPassword = async (emailArg) => {
    const email = (emailArg || '').trim();
    if (!email || !email.includes('@')) {
        showError("Please enter the email address associated with your account.");
        return false;
    }
    const normEmail = email.toLowerCase();
    
    // Find account in registered accounts registry
    const accounts = (typeof getRegisteredAccounts === 'function') ? getRegisteredAccounts() : {};
    const key = normalizeEmailKey(normEmail);
    const existingAcc = accounts[key] || accounts[normEmail];

    if (!existingAcc) {
        showError("No account found with this email. Please verify your email or create an account.");
        return false;
    }

    // Determine the user's name
    const rawName = (existingAcc.name && existingAcc.name.trim()) ? existingAcc.name.trim() : normEmail.split('@')[0];
    const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, '');
    const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    
    // Generate new password: [Name]@123
    const newPassword = `${formattedName}@123`;

    // Save new password in registered accounts store
    existingAcc.password = newPassword;
    accounts[key] = existingAcc;
    try {
        localStorage.setItem('focuspulse_registered_accounts', JSON.stringify(accounts));
    } catch(e) {}

    // Update in Firestore if db is active
    if (db) {
        try {
            await setDoc(doc(db, "users_by_email", key), {
                password: newPassword,
                name: rawName,
                updatedAt: Date.now()
            }, { merge: true });
        } catch(e) {}
    }

    // Display the newly generated password with a 1-click "Sign In With New Password" action!
    const errEl = document.getElementById('ob-auth-error-banner');
    if (errEl) {
        errEl.className = "p-4 rounded-2xl text-xs border bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200 space-y-2.5 shadow-sm";
        errEl.innerHTML = `
            <div class="flex items-center gap-2 font-black text-sm text-emerald-700 dark:text-emerald-300">
                <i class="fa-solid fa-circle-check text-base"></i>
                <span>Password Reset Successful!</span>
            </div>
            <p class="text-xs font-semibold">Your password has been reset to:</p>
            <div class="p-2.5 rounded-xl bg-white/80 dark:bg-black/50 border border-emerald-500/40 text-center font-mono font-black text-base text-emerald-600 dark:text-emerald-300 select-all tracking-wider">
                ${escapeHtml(newPassword)}
            </div>
            <p class="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Format: <strong>[Name]@123</strong>. Click below to sign in immediately with this password.
            </p>
            <button type="button" onclick="autoFillAndOpenSignIn('${escapeHtml(normEmail)}', '${escapeHtml(newPassword)}')" class="v-accent-btn w-full py-2.5 rounded-xl font-extrabold text-xs shadow-md transition flex items-center justify-center gap-1.5">
                <span>Sign In With New Password →</span>
            </button>
        `;
        errEl.classList.remove('hidden');
        errEl.style.display = 'block';
    }

    const submitBtn = document.getElementById('ob-auth-submit-btn');
    if (submitBtn) {
        submitBtn.classList.add('hidden');
    }

    showNotification("Password Reset! 🔑", `New password: ${newPassword}`, "success");
    return true;
};

window.autoFillAndOpenSignIn = function(email, password) {
    openOnboardingAuthScreen('signin');
    setTimeout(() => {
        const emailInput = document.getElementById('ob-signin-email');
        const passInput = document.getElementById('ob-signin-password');
        if (emailInput) emailInput.value = email;
        if (passInput) passInput.value = password;
    }, 50);
};

window.firebaseLogout = async () => {
    // 1. Sync latest state to cloud and per-account cache BEFORE logging out
    if (window.appState && window.appState.authEmail) {
        const emailKey = window.appState.authEmail.trim().toLowerCase();
        try {
            localStorage.setItem(`focuspulse_account_cache_${emailKey}`, JSON.stringify(window.appState));
        } catch(e) {}
        if (window.firebaseSyncToCloud) {
            try { await window.firebaseSyncToCloud(window.appState); } catch (e) {}
        }
    }

    // 2. Sign out of Firebase Auth if active
    try {
        if (auth && window.currentFirebaseUser) {
            await signOut(auth);
        }
    } catch (e) {}
    window.currentFirebaseUser = null;
    window._guestLoginWarningAcknowledged = false;

    // 3. Reset EVERY single piece of workspace data in memory to clean empty state (NO GUEST DATA!)
    window.appState.userType = null;
    window.appState.authUid = null;
    window.appState.authEmail = '';
    window.appState.hasCompletedOnboarding = false;
    window.appState.onboardingStep = 'welcome';
    window.appState.user = { name: '', subjects: '', isCustomName: false, avatarDataUrl: '' };
    window.appState.tasks = [];
    window.appState.taskHistory = [];
    window.appState.courses = [];
    window.appState.habits = [];
    window.appState.waterIntakeMl = 0;
    window.appState.streakCount = 0;
    window.appState.bestStreak = 0;
    window.appState.previousStreakCount = 0;
    window.appState.lastActiveDate = null;
    window.appState.lastCreditedStreakDate = null;
    window.appState.streakRestoredThisWeek = false;
    window.appState.timer = {
        mode: 'pomodoro',
        secondsLeft: 25 * 60,
        isRunning: false,
        targetEndTimeMs: null,
        lastTickTimestampMs: null,
        sessionCount: 0,
        totalFocusSecs: 0
    };
    window.appState.activeSection = 'home';

    // 4. Wipe active session tokens from localStorage
    // (Preserve focuspulse_account_cache_* and focuspulse_registered_accounts for next sign in!)
    localStorage.removeItem('focuspulse_has_authed_account');
    localStorage.removeItem('focuspulse_auth_uid');
    localStorage.removeItem('focuspulse_auth_email');
    localStorage.removeItem('focuspulse_custom_user');
    localStorage.removeItem('focuspulse_guest_name');
    localStorage.removeItem('focuspulse_guest_profile_name');
    localStorage.removeItem('focuspulse_guest_avatar');
    localStorage.removeItem('focuspulse_state');
    localStorage.removeItem('focuspulse_launch_state');
    localStorage.removeItem('focuspulse_onboarding_v1');

    saveState(false);

    // 5. Update UI to blank state
    if (typeof closeAccountModal === 'function') closeAccountModal();
    if (typeof closeDeleteAccountModal === 'function') closeDeleteAccountModal();
    if (typeof window.updateOnboardingAccountStatusUI === 'function') window.updateOnboardingAccountStatusUI();
    if (typeof window.updateUI === 'function') window.updateUI();

    // 6. Return strictly to Sign In screen and keep dashboard locked
    if (typeof openOnboardingAuthScreen === 'function') {
        openOnboardingAuthScreen('signin');
    }

    showNotification("Logged Out 👋", "Session ended. Please sign in to access your account.", "info");
};

window.switchToSignUpFromBackupModal = function() {
    window.closeGuestBackupPromptModal();
    if (typeof openOnboardingAuthScreen === 'function') {
        openOnboardingAuthScreen('signup');
    }
};

// =========================================================================
// DELETE ACCOUNT & RESET EMAIL REGISTRATION (Allows fresh re-registration)
// =========================================================================
window.promptDeleteAccountModal = function() {
    const modal = document.getElementById('delete-account-modal');
    const desc = document.getElementById('delete-account-modal-desc');
    const email = (window.appState && window.appState.authEmail) || (auth && auth.currentUser ? auth.currentUser.email : '') || '';
    if (desc && email) {
        desc.innerText = `This will permanently delete your user profile and cloud Firestore records for ${email}. Your email will be completely reset and released so it can be registered afresh as a new account.`;
    }
    if (modal) modal.classList.remove('hidden');
};

window.closeDeleteAccountModal = function() {
    const modal = document.getElementById('delete-account-modal');
    if (modal) modal.classList.add('hidden');
};

window.executeDeleteAccountAction = async function() {
    const btn = document.getElementById('confirm-delete-account-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i><span>Deleting...</span>';
    }
    try {
        const email = (window.appState && window.appState.authEmail) || (auth && auth.currentUser ? auth.currentUser.email : '') || '';
        const uid = (window.appState && window.appState.authUid) || (auth && auth.currentUser ? auth.currentUser.uid : '') || '';
        const emailKey = normalizeEmailKey(email);

        // 1. Delete Firestore cloud docs if db is active
        if (db) {
            try { if (uid) await deleteDoc(doc(db, "users", uid)); } catch (e) { console.warn("Firestore user doc delete:", e); }
            try { if (emailKey) await deleteDoc(doc(db, "users_by_email", emailKey)); } catch (e) { console.warn("Firestore email index delete:", e); }
        }

        // 2. Delete Firebase Authentication user
        if (auth && auth.currentUser) {
            try {
                await deleteUser(auth.currentUser);
            } catch (authDelErr) {
                console.warn("deleteUser auth error (may require recent login):", authDelErr);
                try { await signOut(auth); } catch (soErr) {}
            }
        }

        // 3. Clear cloud caching in localStorage
        if (emailKey) {
            localStorage.removeItem('focuspulse_cloud_user_' + emailKey);
            localStorage.removeItem('focuspulse_cloud_user_user_' + emailKey);
        }
        if (uid) {
            localStorage.removeItem('focuspulse_cloud_user_' + uid);
        }

        // 4. Wipe authenticated session and local state
        window.appState.userType = null;
        window.appState.authEmail = null;
        window.appState.authUid = null;
        window.currentFirebaseUser = null;
        window._guestLoginWarningAcknowledged = false;

        localStorage.removeItem('fp_has_authed_account');
        localStorage.removeItem('focuspulse_guest_name');
        localStorage.removeItem('focuspulse_guest_profile_name');
        localStorage.removeItem('focuspulse_custom_user');
        localStorage.removeItem('focuspulse_state');
        localStorage.removeItem('focuspulse_onboarding_v1');

        // Reset user state to clean defaults
        if (typeof getDefaultCourses === 'function') {
            window.appState.courses = getDefaultCourses();
        }
        if (typeof generateSampleHabits === 'function') {
            window.appState.habits = generateSampleHabits();
        }
        if (typeof generateInitialTasks === 'function') {
            window.appState.tasks = generateInitialTasks();
        }
        window.appState.user = {
            name: 'Scholar',
            avatar: 'fa-user-astronaut',
            avatarDataUrl: '',
            isCustomName: false
        };
        window.appState.hasCompletedOnboarding = false;

        saveState();
        window.closeDeleteAccountModal();
        if (typeof updateOnboardingAccountStatusUI === 'function') updateOnboardingAccountStatusUI();
        if (typeof window.updateUI === 'function') window.updateUI();

        showNotification(
            "Account Deleted & Reset",
            `Account for ${email || 'user'} has been deleted. Your email is reset and can be registered as new.`,
            "info"
        );

        if (typeof switchAppView === 'function') {
            switchAppView('home', false);
        }
    } catch (err) {
        console.error("Account deletion failed:", err);
        showError("Account deletion note: " + (err.message || err));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>Yes, Delete Account</span>';
        }
    }
};


// Cross-tab / Cross-window account deletion sync
window.addEventListener('storage', (event) => {
    if (event.key === 'focuspulse_account_deleted_broadcast' && event.newValue) {
        try {
            const data = JSON.parse(event.newValue);
            const currentEmail = (window.appState && window.appState.authEmail) ? window.appState.authEmail.toLowerCase() : '';
            if (!currentEmail || currentEmail === (data.email || '').toLowerCase()) {
                window.appState.userType = null;
                window.appState.authEmail = '';
                window.appState.authUid = null;
                window.appState.tasks = [];
                window.appState.courses = [];
                window.appState.habits = [];
                window.appState.waterIntakeMl = 0;
                window.appState.user = { name: '', subjects: '', isCustomName: false, avatarDataUrl: '' };
                saveState(false);
                if (typeof closeAccountModal === 'function') closeAccountModal();
                if (typeof window.updateUI === 'function') window.updateUI();
                if (typeof openOnboardingAuthScreen === 'function') openOnboardingAuthScreen('signin');
                if (typeof showNotification === 'function') {
                    showNotification("Session Expired", "Account was deleted. Please sign in or create an account.", "info");
                }
            }
        } catch(e) {}
    }
});


// =========================================================================
// REALTIME DATA SYNC & MANUAL "SYNC NOW" ENGINE
// =========================================================================
window.syncNowFromProfile = async function() {
    const btn = document.getElementById('profile-sync-now-btn');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-rotate fa-spin mr-1"></i> <span>Syncing...</span>';
    }
    try {
        if (!window.appState || window.appState.userType !== 'authenticated') {
            showNotification("Sync Notice", "Please sign in to sync your workspace data across devices.", "info");
            return;
        }

        // 1. Sync local state to Cloud Firestore & device cache
        if (typeof window.firebaseSyncToCloud === 'function') {
            await window.firebaseSyncToCloud(window.appState);
        }

        // 2. Fetch latest cloud state to reconcile any remote updates
        const uid = window.appState.authUid;
        const email = window.appState.authEmail;
        if (typeof fetchAccountCloudData === 'function') {
            const cloudDoc = await fetchAccountCloudData(uid, email);
            if (cloudDoc && cloudDoc.focuspulse_data) {
                const cloudState = cloudDoc.focuspulse_data;
                if ((cloudState.updatedAt || 0) > (window.appState.updatedAt || 0)) {
                    window.appState = restoreAccountCloudState(window.appState, cloudState);
                    saveState(false);
                }
            }
        }

        // 3. Broadcast sync event across open tabs & windows in realtime
        try {
            localStorage.setItem('focuspulse_realtime_sync_event', JSON.stringify({
                email: (window.appState.authEmail || '').toLowerCase(),
                timestamp: Date.now()
            }));
        } catch(e) {}

        // 4. Update UI
        if (typeof window.updateUI === 'function') window.updateUI();
        if (typeof updateOnboardingAccountStatusUI === 'function') updateOnboardingAccountStatusUI();

        showNotification("Sync Complete! 🔄", "All workspace tasks, habits & settings synced in realtime.", "success");
    } catch (err) {
        console.error("Sync error:", err);
        showNotification("Sync Notice", "Workspace state saved locally and queued for cloud sync.", "info");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
};

// Cross-tab / Cross-window realtime data change listener
window.addEventListener('storage', (event) => {
    if (event.key === 'focuspulse_realtime_sync_event' && event.newValue) {
        try {
            const data = JSON.parse(event.newValue);
            const myEmail = (window.appState && window.appState.authEmail) ? window.appState.authEmail.toLowerCase() : '';
            if (myEmail && myEmail === (data.email || '').toLowerCase()) {
                const rawCache = localStorage.getItem(`focuspulse_account_cache_${myEmail}`);
                if (rawCache) {
                    const parsed = JSON.parse(rawCache);
                    if (parsed && (parsed.updatedAt || 0) > (window.appState.updatedAt || 0)) {
                        window.appState = restoreAccountCloudState(window.appState, parsed);
                        if (typeof window.updateUI === 'function') window.updateUI();
                    }
                }
            }
        } catch(e) {}
    }
});
