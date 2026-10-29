// ==========================================
// FocusPulse - Zenith AI Context-Aware Coach, Multi-Turn System Analyzer & Interactive Controller (ai.js)
// Supports Conversational Memory, Multi-Item Collection ("add 2 habits"), Assignment Solutions,
// Natural Language System Actions, and Inline Apply (Yes/No) Confirmation Above Input
// ==========================================

let pendingAiAction = null;
let activeAiFlow = null;
let aiVariantCounter = 0;

// Persistent in-memory conversation context so follow-ups ("I need answers", "both", "save to notes") work naturally
const aiConversationMemory = {
    messages: [],
    lastIntent: null,
    lastTopic: null,
    lastAnswerText: ''
};

const AI_COLOR_PALETTE = [
    { key: 'violet',  label: 'Violet',  hex: '#8b5cf6', aliases: ['violet', 'voilet', 'purple', 'purpel', 'lavender', 'amethyst'] },
    { key: 'indigo',  label: 'Indigo',  hex: '#5f5bf6', aliases: ['indigo', 'royal'] },
    { key: 'emerald', label: 'Emerald', hex: '#10b981', aliases: ['emerald', 'green', 'grn', 'mint', 'forest', 'tealgreen'] },
    { key: 'orange',  label: 'Orange',  hex: '#f97316', aliases: ['orange', 'org', 'amber', 'tangerine', 'coral'] },
    { key: 'magenta', label: 'Magenta', hex: '#d946ef', aliases: ['magenta', 'fuchsia', 'neonpink', 'hotpink'] },
    { key: 'cyan',    label: 'Cyan',    hex: '#06b6d4', aliases: ['cyan', 'teal', 'aqua', 'turquoise', 'sky'] },
    { key: 'gold',    label: 'Gold',    hex: '#eab308', aliases: ['gold', 'yellow', 'ylw', 'mustard', 'sun'] },
    { key: 'crimson', label: 'Crimson', hex: '#ef4444', aliases: ['crimson', 'red', 'scarlet', 'ruby'] },
    { key: 'blue',    label: 'Blue',    hex: '#3b82f6', aliases: ['blue', 'blu', 'navy', 'cobalt', 'ocean'] },
    { key: 'rose',    label: 'Rose',    hex: '#f43f5e', aliases: ['rose', 'pink', 'pnk', 'blush'] },
    { key: 'slate',   label: 'Silver / Slate', hex: '#64748b', aliases: ['silver', 'slate', 'grey', 'gray'] }
];

const BASIC_HABITS_PRESETS = [
    { name: 'Morning Hydration (500ml)', category: 'Health', color: 'blue', icon: '💧', targetPerWeek: 7 },
    { name: 'Read 20 Pages of Textbook', category: 'Learning', color: 'violet', icon: '📚', targetPerWeek: 5 },
    { name: '45m Strength / Cardio', category: 'Fitness', color: 'emerald', icon: '💪', targetPerWeek: 4 },
    { name: 'Deep Work Session (No Phone)', category: 'Productivity', color: 'amber', icon: '⚡', targetPerWeek: 5 },
    { name: '10m Evening Mindfulness', category: 'Mindfulness', color: 'rose', icon: '🧘', targetPerWeek: 7 }
];

const EXTRA_HABITS_PRESETS = [
    { name: 'Eat a Healthy Balanced Meal', category: 'Health', color: 'emerald', icon: '🥗', targetPerWeek: 7 },
    { name: '30m Outdoor Walk / Run', category: 'Fitness', color: 'orange', icon: '🏃', targetPerWeek: 5 },
    { name: '1hr Coding / Problem Solving', category: 'Learning', color: 'indigo', icon: '💻', targetPerWeek: 5 },
    { name: '8 Hours Quality Sleep', category: 'Health', color: 'violet', icon: '💤', targetPerWeek: 7 },
    { name: '1hr Evening Digital Detox', category: 'Mindfulness', color: 'cyan', icon: '📵', targetPerWeek: 6 }
];

const ALL_HABIT_SUGGESTIONS = [...BASIC_HABITS_PRESETS, ...EXTRA_HABITS_PRESETS];

const SUGGESTED_TASK_PRESETS = [
    'Complete Lecture Revision Notes',
    'Solve 10 Practice Problems',
    'Write Lab Report Summary',
    'Review Flashcards (Active Recall)',
    'Prepare Weekly Study Outline',
    'Read Next Textbook Chapter'
];

const SUGGESTED_COURSE_PRESETS = [
    { name: 'Biology', code: 'BI', color: '#10b981' },
    { name: 'Chemistry', code: 'CH', color: '#06b6d4' },
    { name: 'Data Structures', code: 'DS', color: '#8b5cf6' },
    { name: 'Linear Algebra', code: 'LA', color: '#f97316' },
    { name: 'World History', code: 'WH', color: '#eab308' },
    { name: 'English Literature', code: 'EL', color: '#f43f5e' }
];

function pickAiVariant(variants) {
    if (!Array.isArray(variants) || variants.length === 0) return '';
    const idx = aiVariantCounter % variants.length;
    aiVariantCounter++;
    return variants[idx];
}

function saveGeminiApiKey(val) {
    window.appState.geminiApiKey = (val || '').trim();
    saveState();
    showNotification(
        "AI Key Saved",
        window.appState.geminiApiKey
            ? "Custom Gemini API key saved."
            : "Using built-in Zenith AI direct answer engine.",
        "success"
    );
}

// Normalize typos in user commands (including "Hello me with..." -> "help me with...", "adddd" -> "add", etc.)
function normalizeAiCommandText(raw) {
    return String(raw || '')
        .trim()
        .replace(/^h+e+l+o+\s+me\b/i, 'help me')
        .replace(/\bh+l+p+\s+me\b/gi, 'help me')
        .replace(/\ba+s+i+g*n*m+e*n+t+(s?)\b/gi, 'assignment$1')
        .replace(/\ba+d{2,}\b/gi, 'add')
        .replace(/\be+d+i+t+\b/gi, 'edit')
        .replace(/\bc+h+a*n+g+e*\b/gi, 'change')
        .replace(/\bc+r+e+a+t+e*\b/gi, 'create')
        .replace(/\bd+e+l+e+t+e*\b/gi, 'delete')
        .replace(/\br+e+m+o+v+e*\b/gi, 'remove')
        .replace(/\bh+a+b+i+t+(s?)\b/gi, 'habit$1')
        .replace(/\bt+a+s+k+(s?)\b/gi, 'task$1')
        .replace(/\bc+o+u*r+[cs]+e*(s?)\b/gi, 'course$1')
        .replace(/\bc+o+l+o*u*r+(s?)\b/gi, 'color$1')
        .replace(/\bt+h+e+m+e*(s?)\b/gi, 'theme$1')
        .replace(/\bs+e+t+i+n+g*(s?)\b/gi, 'setting$1')
        .replace(/\bv+o+i+l+e+t+\b/gi, 'violet')
        .replace(/\bp+u+r+p+e+l+\b/gi, 'purple')
        .replace(/\s+/g, ' ')
        .trim();
}

// Parse number words or digits in requests like "Add a new two habits", "add 3 tasks", "add a couple of habits"
function extractRequestedItemCount(normText) {
    const wordMap = {
        'one': 1, 'a': 1, 'an': 1, 'single': 1,
        'two': 2, 'couple': 2, 'both': 2,
        'three': 3, 'few': 3,
        'four': 4,
        'five': 5,
        'six': 6,
        'seven': 7,
        'eight': 8,
        'nine': 9,
        'ten': 10
    };
    // Explicit digit (e.g. "add 2 habits", "add a new 3 habits")
    const digitMatch = normText.match(/\b(?:add|create|new|make)\s+(?:a\s+|new\s+|my\s+)*(\d+)\s+(?:new\s+|more\s+|custom\s+)?(?:habits?|tasks?|courses?)\b/i);
    if (digitMatch) {
        const n = parseInt(digitMatch[1], 10);
        if (n >= 1 && n <= 10) return n;
    }
    // Number word (e.g. "Add a new two habits", "add two new habits", "create three tasks")
    const wordMatch = normText.match(/\b(?:add|create|new|make)\s+(?:a\s+|new\s+|my\s+)*(one|two|three|four|five|six|seven|eight|nine|ten|couple|few|both)(?:\s+of)?\s+(?:new\s+|more\s+|custom\s+)?(?:habits?|tasks?|courses?)\b/i);
    if (wordMatch) {
        const w = wordMatch[1].toLowerCase();
        if (wordMap[w]) return wordMap[w];
    }
    return null;
}

function resolveAiColor(inputStr) {
    if (!inputStr) return null;
    const lower = normalizeAiCommandText(inputStr).toLowerCase();
    const hexMatch = lower.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i);
    if (hexMatch) {
        return { key: 'custom', label: hexMatch[0].toUpperCase(), hex: hexMatch[0] };
    }
    for (const col of AI_COLOR_PALETTE) {
        for (const alias of col.aliases) {
            const re = new RegExp(`\\b${alias}\\b`, 'i');
            if (re.test(lower)) {
                return col;
            }
        }
    }
    return null;
}

function getColorLabelByHex(hex) {
    if (!hex) return 'Indigo';
    const found = AI_COLOR_PALETTE.find(c => c.hex.toLowerCase() === String(hex).toLowerCase());
    return found ? `${found.label} (${found.hex})` : hex;
}

function findCourseFromText(queryStr) {
    const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
    if (!queryStr || courses.length === 0) return null;
    const clean = queryStr.trim();
    const lower = clean.toLowerCase();

    if (/^\d+$/.test(clean)) {
        const idx = parseInt(clean, 10) - 1;
        if (idx >= 0 && idx < courses.length) return courses[idx];
    }

    const exact = courses.find(c =>
        c.name.toLowerCase() === lower ||
        (c.code && c.code.toLowerCase() === lower)
    );
    if (exact) return exact;

    const partial = courses.find(c =>
        lower.includes(c.name.toLowerCase()) ||
        c.name.toLowerCase().includes(lower) ||
        (c.code && new RegExp(`\\b${c.code.toLowerCase()}\\b`).test(lower))
    );
    return partial || null;
}

function findTaskFromText(queryStr) {
    const tasks = (window.appState && Array.isArray(window.appState.tasks)) ? window.appState.tasks : [];
    const pending = tasks.filter(t => !t.completed);
    const pool = pending.length > 0 ? pending : tasks;
    if (!queryStr || pool.length === 0) return null;
    const clean = queryStr.trim();
    const lower = clean.toLowerCase();

    if (/^\d+$/.test(clean)) {
        const idx = parseInt(clean, 10) - 1;
        if (idx >= 0 && idx < pool.length) return pool[idx];
    }
    if (/^(?:first|1st|top|one)\b/i.test(lower)) return pool[0];
    if (/^(?:second|2nd|two)\b/i.test(lower) && pool[1]) return pool[1];
    if (/^(?:third|3rd|three)\b/i.test(lower) && pool[2]) return pool[2];

    const exact = pool.find(t => t.title.toLowerCase() === lower);
    if (exact) return exact;

    // Match by course or keywords (e.g. "physics", "optics", "calculus", "integration", "cs101", "binary tree")
    const words = lower.split(/\s+/).filter(w => w.length >= 3 && !['the', 'and', 'for', 'with', 'assignment', 'homework', 'task', 'help', 'answer', 'answers', 'need'].includes(w));
    for (const t of pool) {
        const hay = `${t.title} ${t.course || ''} ${t.description || ''}`.toLowerCase();
        if (hay.includes(lower) || words.some(w => hay.includes(w))) {
            return t;
        }
    }
    return null;
}

function recordConversationTurn(role, text, intent = null, topic = null) {
    aiConversationMemory.messages.push({
        role,
        text: String(text || ''),
        intent,
        timestamp: Date.now()
    });
    if (aiConversationMemory.messages.length > 24) {
        aiConversationMemory.messages.shift();
    }
    if (intent) aiConversationMemory.lastIntent = intent;
    if (topic) aiConversationMemory.lastTopic = topic;
    if (role === 'ai' && text) {
        aiConversationMemory.lastAnswerText = String(text);
    }
}

function appendUserChatBubble(text) {
    recordConversationTurn('user', text);
    const history = document.getElementById('ai-chat-history');
    if (!history) return;
    history.innerHTML += `
        <div class="flex justify-end">
            <div class="v-accent-btn bg-indigo-600 text-white p-2.5 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm font-medium">${escapeHtml(text)}</div>
        </div>
    `;
    history.scrollTop = history.scrollHeight;
}

function appendAiChatBubble(replyText, isSuccessAction = false, intentTag = null) {
    recordConversationTurn('ai', replyText, intentTag);
    const history = document.getElementById('ai-chat-history');
    if (!history) return;
    // Use inline span styling for backtick commands so they never break onto awkward vertical lines
    const formattedHtml = escapeHtml(replyText)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<span class="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-mono text-[10px]" style="display:inline-block;white-space:nowrap;">$1</span>')
        .replace(/\n/g, '<br>');

    if (isSuccessAction) {
        history.innerHTML += `
            <div class="flex gap-2">
                <div class="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5"><i class="fa-solid fa-check text-[10px]"></i></div>
                <div class="bg-emerald-500/15 border border-emerald-500/30 p-2.5 rounded-2xl rounded-tl-none max-w-[88%] text-emerald-900 dark:text-emerald-200 font-semibold leading-relaxed">${formattedHtml}</div>
            </div>
        `;
    } else {
        history.innerHTML += `
            <div class="flex gap-2">
                <div class="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5" style="color:var(--v-accent)">
                    <i class="fa-solid fa-robot text-[10px]"></i>
                </div>
                <div class="bg-white/70 dark:bg-white/10 border border-white/60 dark:border-white/10 p-3 rounded-2xl rounded-tl-none max-w-[88%] text-slate-900 dark:text-slate-100 font-medium leading-relaxed shadow-sm">${formattedHtml}</div>
            </div>
        `;
    }
    history.scrollTop = history.scrollHeight;
}

function hideAiInlinePopupTray() {
    const tray = document.getElementById('ai-inline-popup-tray');
    if (tray) {
        tray.classList.add('hidden');
        tray.innerHTML = '';
    }
    const modal = document.getElementById('ai-confirm-modal');
    if (modal) modal.classList.add('hidden');
}

function dismissAiInteractiveFlow() {
    activeAiFlow = null;
    pendingAiAction = null;
    hideAiInlinePopupTray();
}

// Render the inline "Apply (Yes) / No" confirmation popup directly above #ai-chat-input
function stageAiPendingAction(actionCmd, chatNote) {
    pendingAiAction = actionCmd;
    if (chatNote) {
        appendAiChatBubble(chatNote, false, 'confirm_action');
    }

    const modal = document.getElementById('ai-confirm-modal');
    if (modal) modal.classList.add('hidden');

    const tray = document.getElementById('ai-inline-popup-tray');
    if (!tray) return;

    let badgeHtml = `<div class="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-500 flex items-center justify-center shrink-0 text-xs"><i class="fa-solid fa-wand-magic-sparkles"></i></div>`;
    if (actionCmd.previewBadge) {
        const col = actionCmd.previewBadge.color || '#8b5cf6';
        const code = (actionCmd.previewBadge.code || 'CR').slice(0, 2).toUpperCase();
        badgeHtml = `<div class="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black uppercase shrink-0 shadow-sm" style="background:${col}24;color:${col};border:1.5px solid ${col}66;">${escapeHtml(code)}</div>`;
    } else if (actionCmd.previewColor) {
        badgeHtml = `<div class="w-8 h-8 rounded-xl shrink-0 shadow-sm border border-white/30" style="background:${actionCmd.previewColor};"></div>`;
    }

    tray.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div class="flex items-center gap-2.5 min-w-0">
                ${badgeHtml}
                <div class="min-w-0">
                    <p class="text-[10px] font-extrabold uppercase tracking-wider text-violet-500 dark:text-violet-400">Confirm Change</p>
                    <p id="ai-confirm-text" class="text-xs font-bold text-slate-900 dark:text-white leading-snug break-words">${escapeHtml(actionCmd.summary)}</p>
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button type="button" onclick="cancelAiAction()" class="px-3.5 py-1.5 rounded-xl bg-white/70 dark:bg-white/10 hover:bg-rose-500/15 hover:text-rose-500 text-slate-800 dark:text-slate-200 text-xs font-extrabold transition border border-white/40 dark:border-white/10">No</button>
                <button type="button" onclick="confirmAiAction()" class="v-accent-btn px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition shadow-md flex items-center gap-1.5">
                    <i class="fa-solid fa-check text-[10px]"></i>
                    <span>Apply (Yes)</span>
                </button>
            </div>
        </div>
    `;
    tray.classList.remove('hidden');
}

// Render interactive multi-step selector popups directly above #ai-chat-input
function renderAiFlowPopup() {
    const tray = document.getElementById('ai-inline-popup-tray');
    if (!tray) return;
    if (!activeAiFlow) {
        hideAiInlinePopupTray();
        return;
    }

    // Multi-item collection popup (e.g. "Add a new two habits", "add 3 tasks", "add 2 courses")
    if (activeAiFlow.step === 'collect_multiple_items') {
        const { entityType, targetCount, collected } = activeAiFlow;
        const remaining = Math.max(0, targetCount - collected.length);
        const typeLabel = entityType === 'habit' ? 'Habits' : (entityType === 'task' ? 'Tasks' : 'Courses');

        let candidateButtons = '';
        if (entityType === 'habit') {
            candidateButtons = ALL_HABIT_SUGGESTIONS.map((h, i) => {
                const isPicked = collected.some(item => item.name.toLowerCase() === h.name.toLowerCase());
                return `
                    <button type="button" onclick="handleAiMultiItemPick(${i})"
                        class="px-2.5 py-1 rounded-xl border text-[11px] font-bold transition flex items-center gap-1.5 ${isPicked ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm' : 'bg-white/70 dark:bg-white/10 hover:bg-indigo-500/20 border-white/40 dark:border-white/10'}">
                        <span>${isPicked ? '✓' : h.icon}</span>
                        <span>${escapeHtml(h.name)}</span>
                    </button>
                `;
            }).join('');
        } else if (entityType === 'task') {
            candidateButtons = SUGGESTED_TASK_PRESETS.map((title, i) => {
                const isPicked = collected.some(item => item.title.toLowerCase() === title.toLowerCase());
                return `
                    <button type="button" onclick="handleAiMultiItemPick(${i})"
                        class="px-2.5 py-1 rounded-xl border text-[11px] font-bold transition flex items-center gap-1.5 ${isPicked ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm' : 'bg-white/70 dark:bg-white/10 hover:bg-indigo-500/20 border-white/40 dark:border-white/10'}">
                        <span>${isPicked ? '✓' : '📌'}</span>
                        <span>${escapeHtml(title)}</span>
                    </button>
                `;
            }).join('');
        } else if (entityType === 'course') {
            candidateButtons = SUGGESTED_COURSE_PRESETS.map((c, i) => {
                const isPicked = collected.some(item => item.name.toLowerCase() === c.name.toLowerCase());
                return `
                    <button type="button" onclick="handleAiMultiItemPick(${i})"
                        class="px-2.5 py-1 rounded-xl border text-[11px] font-bold transition flex items-center gap-1.5 ${isPicked ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm' : 'bg-white/70 dark:bg-white/10 hover:bg-indigo-500/20 border-white/40 dark:border-white/10'}">
                        <span>${isPicked ? '✓' : '🎓'}</span>
                        <span>${escapeHtml(c.name)} [${c.code}]</span>
                    </button>
                `;
            }).join('');
        }

        const selectedSummary = collected.length > 0
            ? `<div class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Selected (${collected.length}/${targetCount}): ${collected.map(x => escapeHtml(x.name || x.title)).join(', ')}</div>`
            : `<div class="text-[11px] font-medium text-slate-500 dark:text-slate-400">Click ${remaining} option${remaining > 1 ? 's' : ''} below, or type your own in the chat box (comma-separated or one by one).</div>`;

        tray.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                        <i class="fa-solid fa-list-check"></i> Select ${targetCount} ${typeLabel} (${remaining} more needed)
                    </span>
                    <div class="flex items-center gap-1.5">
                        ${collected.length > 0 ? `<button type="button" onclick="finalizeMultiItemCollection()" class="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-extrabold">Review (${collected.length})</button>` : ''}
                        <button type="button" onclick="dismissAiInteractiveFlow()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>
                ${selectedSummary}
                <div class="flex flex-wrap gap-1.5">
                    ${candidateButtons}
                </div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    // Assignment selector popup ("Hello me with my assignment" / "Help me with my assignment")
    if (activeAiFlow.step === 'select_assignment') {
        const pendingTasks = ((window.appState && window.appState.tasks) || []).filter(t => !t.completed);
        const taskButtons = pendingTasks.slice(0, 5).map((t, idx) => `
            <button type="button" onclick="handleAiAssignmentPick(${idx})"
                class="px-2.5 py-1.5 rounded-xl bg-white/75 dark:bg-white/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-[11px] font-bold transition flex items-center gap-1.5 text-left">
                <span class="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-[9px] font-black">${escapeHtml(t.course || 'TASK')}</span>
                <span>${escapeHtml(t.title)}</span>
            </button>
        `).join('');

        tray.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5">
                        <i class="fa-solid fa-book-open-reader"></i> Select an Assignment for Direct Answers & Solutions
                    </span>
                    <button type="button" onclick="dismissAiInteractiveFlow()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    ${pendingTasks.length > 1 ? `
                        <button type="button" onclick="handleAiAssignmentPick('all')"
                            class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition shadow-sm">
                            ✨ Solve All ${pendingTasks.length} Assignments
                        </button>
                    ` : ''}
                    ${taskButtons}
                </div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    // Post-answer follow-up action bar (Save solution to Quick Study Notes or Mark Assignment Complete)
    if (activeAiFlow.step === 'post_assignment_actions') {
        const taskObj = activeAiFlow.taskId
            ? ((window.appState.tasks || []).find(t => t.id === activeAiFlow.taskId))
            : null;
        tray.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                    <i class="fa-solid fa-lightbulb"></i> Apply Solution to Workspace:
                </span>
                <div class="flex flex-wrap items-center gap-1.5">
                    <button type="button" onclick="handleAiSaveAnswerToNotes()" class="px-2.5 py-1 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold transition">
                        📝 Save to Quick Study Notes
                    </button>
                    ${taskObj && !taskObj.completed ? `
                        <button type="button" onclick="handleAiCompleteAssignmentTask('${escapeHtml(taskObj.id)}')" class="px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold transition">
                            ✅ Mark "${escapeHtml(taskObj.title)}" Done
                        </button>
                    ` : ''}
                    <button type="button" onclick="dismissAiInteractiveFlow()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    if (activeAiFlow.step === 'select_course') {
        const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
        const courseButtons = courses.map(c => {
            const col = c.color || '#5f5bf6';
            const code = (c.code || c.name.slice(0, 2)).slice(0, 2).toUpperCase();
            return `
                <button type="button" onclick="handleAiCourseSelectClick('${escapeHtml(c.id)}')"
                    class="px-2.5 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition hover:scale-[1.02]"
                    style="background:${col}15;border-color:${col}55;color:var(--v-fg);">
                    <span class="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black uppercase" style="background:${col}30;color:${col};">${escapeHtml(code)}</span>
                    <span>${escapeHtml(c.name)}</span>
                </button>
            `;
        }).join('');

        tray.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5">
                        <i class="fa-solid fa-graduation-cap"></i> Select a Course to Edit (or type course name below)
                    </span>
                    <button type="button" onclick="dismissAiInteractiveFlow()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    ${courseButtons}
                    <button type="button" onclick="handleAiStartAddNewCourse()" class="px-2.5 py-1.5 rounded-xl border border-dashed border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-bold transition flex items-center gap-1">
                        <i class="fa-solid fa-plus text-[10px]"></i> Add Course
                    </button>
                </div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    if (activeAiFlow.step === 'select_course_edit') {
        const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
        const course = courses.find(c => c.id === activeAiFlow.courseId);
        if (!course) {
            dismissAiInteractiveFlow();
            return;
        }
        const col = course.color || '#5f5bf6';
        const code = (course.code || course.name.slice(0, 2)).slice(0, 2).toUpperCase();

        const colorPills = AI_COLOR_PALETTE.slice(0, 10).map(item => `
            <button type="button" onclick="handleAiCourseColorPick('${item.key}')"
                class="px-2 py-1 rounded-lg border flex items-center gap-1.5 text-[11px] font-bold transition hover:scale-105"
                style="background:${item.hex}18;border-color:${item.hex}66;color:var(--v-fg);"
                title="Change colour to ${item.label}">
                <span class="w-3 h-3 rounded-full shrink-0" style="background:${item.hex};"></span>
                <span>${item.label}</span>
            </button>
        `).join('');

        tray.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <span class="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black uppercase" style="background:${col}28;color:${col};border:1px solid ${col}66;">${escapeHtml(code)}</span>
                        <span class="text-xs font-extrabold text-slate-900 dark:text-white">Editing ${escapeHtml(course.name)} — Pick Colour or Edit Option:</span>
                    </div>
                    <button type="button" onclick="dismissAiInteractiveFlow()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    ${colorPills}
                </div>
                <div class="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/20 dark:border-white/10">
                    <button type="button" onclick="handleAiCourseEditModePick('name')" class="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold transition">✏️ Change Name</button>
                    <button type="button" onclick="handleAiCourseEditModePick('code')" class="px-2.5 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-700 dark:text-violet-300 text-[11px] font-bold transition">🔤 Change 2-Letter Code</button>
                    <button type="button" onclick="handleAiCourseEditModePick('delete')" class="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 text-[11px] font-bold transition">🗑️ Delete Course</button>
                </div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    if (activeAiFlow.step === 'await_course_name' || activeAiFlow.step === 'await_course_code' || activeAiFlow.step === 'await_new_course_name') {
        const labelMap = {
            'await_course_name': `Type the new name for "${activeAiFlow.courseName}" in the box below`,
            'await_course_code': `Type the new 2-letter code for "${activeAiFlow.courseName}" (e.g. PY, CS, MA)`,
            'await_new_course_name': `Type the name of the new course to add (e.g. Biology, Data Structures)`
        };
        tray.innerHTML = `
            <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-indigo-600 dark:text-indigo-300 flex items-center gap-2">
                    <i class="fa-solid fa-keyboard"></i> ${escapeHtml(labelMap[activeAiFlow.step])}
                </span>
                <button type="button" onclick="dismissAiInteractiveFlow()" class="px-2.5 py-1 rounded-lg bg-white/60 dark:bg-white/10 text-[11px] font-bold">Cancel</button>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    if (activeAiFlow.step === 'select_theme') {
        const themePills = (typeof FP_THEMES !== 'undefined' ? FP_THEMES : []).map(t => `
            <button type="button" onclick="handleAiThemePick('solid', '${t.id}')"
                class="px-2.5 py-1 rounded-lg border flex items-center gap-1.5 text-[11px] font-bold transition hover:scale-105"
                style="background:var(--v-bg3);border-color:var(--v-bdr2);color:var(--v-fg);">
                <span class="w-3 h-3 rounded-full border border-white/30" style="background:${t.bg === '#ffffff' ? '#e2e8f0' : t.accent};"></span>
                <span>${escapeHtml(t.name)}</span>
            </button>
        `).join('');

        const accentSwatches = AI_COLOR_PALETTE.slice(0, 9).map(col => `
            <button type="button" onclick="handleAiThemePick('accent', '${col.key}')"
                class="px-2 py-1 rounded-lg border flex items-center gap-1 text-[10px] font-bold transition hover:scale-105"
                style="background:${col.hex}18;border-color:${col.hex}66;color:var(--v-fg);">
                <span class="w-2.5 h-2.5 rounded-full" style="background:${col.hex};"></span>
                <span>${col.label}</span>
            </button>
        `).join('');

        tray.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-fuchsia-500 dark:text-fuchsia-400 flex items-center gap-1.5">
                        <i class="fa-solid fa-palette"></i> Choose a Theme, Surface Mode, or Accent Colour
                    </span>
                    <button type="button" onclick="dismissAiInteractiveFlow()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="flex flex-wrap gap-1.5">${themePills}</div>
                <div class="flex flex-wrap gap-1.5 pt-1 border-t border-white/20 dark:border-white/10">
                    <button type="button" onclick="handleAiThemePick('surface', 'dark')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-white text-[11px] font-bold">🌙 Dark Mode</button>
                    <button type="button" onclick="handleAiThemePick('surface', 'light')" class="px-2.5 py-1 rounded-lg bg-white text-slate-900 border border-slate-300 text-[11px] font-bold">☀️ White Mode</button>
                    <button type="button" onclick="handleAiThemePick('liquid', 'toggle')" class="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-[11px] font-bold">✨ Toggle Liquid Glass</button>
                </div>
                <div class="flex flex-wrap gap-1 pt-1 border-t border-white/20 dark:border-white/10">${accentSwatches}</div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    if (activeAiFlow.step === 'select_habit') {
        const existingNames = new Set(((window.appState && window.appState.habits) || []).map(h => h.name.toLowerCase()));
        const missingBasicCount = BASIC_HABITS_PRESETS.filter(p => !existingNames.has(p.name.toLowerCase())).length;

        const presetButtons = ALL_HABIT_SUGGESTIONS.map((h, i) => `
            <button type="button" onclick="handleAiPresetHabitPick(${i})"
                class="px-2.5 py-1 rounded-xl bg-white/70 dark:bg-white/10 hover:bg-indigo-500/20 border border-white/40 dark:border-white/10 text-[11px] font-bold transition flex items-center gap-1.5">
                <span>${h.icon}</span>
                <span>${escapeHtml(h.name)}</span>
            </button>
        `).join('');

        tray.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                        <i class="fa-solid fa-fire"></i> Pick a Habit to Add or Type Custom Habit(s) Below
                    </span>
                    <button type="button" onclick="dismissAiInteractiveFlow()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    ${missingBasicCount > 0 ? `
                        <button type="button" onclick="handleAiAddAllBasicHabitsPick()" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition shadow-sm">
                            ✨ Add 5 Core Basic Habits
                        </button>
                    ` : `
                        <button type="button" onclick="handleAiAddAllExtraHabitsPick()" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition shadow-sm">
                            🚀 Add 5 Extra Starter Habits
                        </button>
                        <button type="button" onclick="handleAiAddAllBasicHabitsPick()" class="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold transition">
                            🔄 Reset Core 5 Habits
                        </button>
                    `}
                    ${presetButtons}
                </div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    if (activeAiFlow.step === 'select_setting') {
        tray.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-cyan-500 flex items-center gap-1.5">
                        <i class="fa-solid fa-sliders"></i> Quick Settings (Click Any Option to Confirm & Apply)
                    </span>
                    <button type="button" onclick="dismissAiInteractiveFlow()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    <button type="button" onclick="handleAiSettingPick('pomo_classic')" class="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">⏱️ Classic (25/5m)</button>
                    <button type="button" onclick="handleAiSettingPick('pomo_extended')" class="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">⏱️ Extended (50/10m)</button>
                    <button type="button" onclick="handleAiSettingPick('pomo_blitz')" class="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">⏱️ Blitz (15/3m)</button>
                    <button type="button" onclick="handleAiSettingPick('water_2500')" class="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 text-[11px] font-bold">💧 Goal 2500ml</button>
                    <button type="button" onclick="handleAiSettingPick('water_3000')" class="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 text-[11px] font-bold">💧 Goal 3000ml</button>
                    <button type="button" onclick="handleAiSettingPick('toggle_perf')" class="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 text-[11px] font-bold">⚡ Performance Mode</button>
                    <button type="button" onclick="handleAiSettingPick('toggle_liquid')" class="px-2.5 py-1 rounded-lg bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-700 dark:text-fuchsia-300 text-[11px] font-bold">✨ Liquid Glass</button>
                    <button type="button" onclick="handleAiSettingPick('toggle_sound')" class="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">🔊 Toggle Sound</button>
                    <button type="button" onclick="handleAiSettingPick('toggle_notif')" class="px-2.5 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-700 dark:text-violet-300 text-[11px] font-bold">🔔 Toggle Alerts</button>
                </div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }
}

// Multi-item picker handler (when user asked to add N habits/tasks/courses)
function handleAiMultiItemPick(index) {
    if (!activeAiFlow || activeAiFlow.step !== 'collect_multiple_items') return;
    const { entityType, targetCount, collected } = activeAiFlow;

    if (entityType === 'habit') {
        const candidate = ALL_HABIT_SUGGESTIONS[index];
        if (!candidate) return;
        const existingIdx = collected.findIndex(x => x.name.toLowerCase() === candidate.name.toLowerCase());
        if (existingIdx >= 0) {
            collected.splice(existingIdx, 1);
        } else {
            collected.push({ ...candidate });
        }
    } else if (entityType === 'task') {
        const title = SUGGESTED_TASK_PRESETS[index];
        if (!title) return;
        const existingIdx = collected.findIndex(x => x.title.toLowerCase() === title.toLowerCase());
        if (existingIdx >= 0) {
            collected.splice(existingIdx, 1);
        } else {
            collected.push({ title });
        }
    } else if (entityType === 'course') {
        const c = SUGGESTED_COURSE_PRESETS[index];
        if (!c) return;
        const existingIdx = collected.findIndex(x => x.name.toLowerCase() === c.name.toLowerCase());
        if (existingIdx >= 0) {
            collected.splice(existingIdx, 1);
        } else {
            collected.push({ ...c });
        }
    }

    if (collected.length >= targetCount) {
        finalizeMultiItemCollection();
    } else {
        renderAiFlowPopup();
    }
}

function finalizeMultiItemCollection() {
    if (!activeAiFlow || activeAiFlow.step !== 'collect_multiple_items') return;
    const { entityType, collected } = activeAiFlow;
    if (!collected || collected.length === 0) return;

    activeAiFlow = null;
    if (entityType === 'habit') {
        const namesList = collected.map(h => `"${h.name}"`).join(', ');
        stageAiPendingAction(
            {
                type: 'add_multiple_habits',
                items: collected,
                summary: `Add ${collected.length} habit${collected.length > 1 ? 's' : ''}: ${namesList}`
            },
            `🔥 Ready to add **${collected.length} habit${collected.length > 1 ? 's' : ''}** (${namesList}) to your Habit Flow Tracker. Click **Apply (Yes)** below to confirm.`
        );
    } else if (entityType === 'task') {
        const namesList = collected.map(t => `"${t.title}"`).join(', ');
        stageAiPendingAction(
            {
                type: 'add_multiple_tasks',
                items: collected,
                summary: `Add ${collected.length} task${collected.length > 1 ? 's' : ''}: ${namesList}`
            },
            `📌 Ready to add **${collected.length} task${collected.length > 1 ? 's' : ''}** (${namesList}) to your Smart Task Tracker. Click **Apply (Yes)** below to confirm.`
        );
    } else if (entityType === 'course') {
        const namesList = collected.map(c => `"${c.name}" [${c.code}]`).join(', ');
        stageAiPendingAction(
            {
                type: 'add_multiple_courses',
                items: collected,
                summary: `Add ${collected.length} course${collected.length > 1 ? 's' : ''}: ${namesList}`
            },
            `🎓 Ready to add **${collected.length} course${collected.length > 1 ? 's' : ''}** (${namesList}) to your Active Courses. Click **Apply (Yes)** below to confirm.`
        );
    }
}

// Generate direct, substantive academic solutions for a user's assignment or task
function buildAssignmentSolutionText(taskObj) {
    if (!taskObj) return '';
    const title = taskObj.title || 'Assignment';
    const lower = `${title} ${taskObj.course || ''} ${taskObj.description || ''}`.toLowerCase();

    if (lower.includes('optics') || lower.includes('physics') || lower.includes('refraction') || lower.includes('snell') || lower.includes('prism')) {
        return `🔬 **Solution Guide — ${title} (${taskObj.course || 'Physics'}):**\n` +
            `• **1. Snell's Law of Refraction:** **n₁ sin(θ₁) = n₂ sin(θ₂)**, where **n = c / v** is the refractive index. Passing from air (n₁ ≈ 1.00) into glass (n₂ ≈ 1.50), light bends **toward the normal** (θ₂ < θ₁).\n` +
            `• **2. Prism Minimum Deviation Formula:** **n = sin((A + Dₘ) / 2) / sin(A / 2)**, where **A** is the prism apex angle (60°) and **Dₘ** is the angle of minimum deviation.\n` +
            `• **3. Thin Lens & Error Analysis:** Use **1/f = 1/v − 1/u**. Key experimental sources of error: parallax error when aligning pins, finite glass slab thickness, and chromatic dispersion.`;
    }

    if (lower.includes('calculus') || lower.includes('integration') || lower.includes('integral') || lower.includes('by parts') || lower.includes('substitution')) {
        return `📐 **Solution Guide — ${title} (${taskObj.course || 'Calculus'}):**\n` +
            `• **1. Integration by Parts (LIATE Rule):** **∫ u dv = u·v − ∫ v du**. Choose **u** in priority order: **L**ogarithmic, **I**nverse trig, **A**lgebraic, **T**rigonometric, **E**xponential.\n` +
            `• **2. Worked Example (∫ x·eˣ dx):** Let u = x (du = dx) and dv = eˣ dx (v = eˣ). Then **∫ x·eˣ dx = x·eˣ − ∫ eˣ dx = eˣ(x − 1) + C**.\n` +
            `• **3. Trigonometric Substitution:** For **√(a² − x²)** use **x = a·sin(θ)**; for **√(a² + x²)** use **x = a·tan(θ)**; for **√(x² − a²)** use **x = a·sec(θ)**.`;
    }

    if (lower.includes('binary tree') || lower.includes('avl') || lower.includes('red-black') || lower.includes('cs101') || lower.includes('data structure')) {
        return `💻 **Solution Guide — ${title} (${taskObj.course || 'CS101'}):**\n` +
            `• **1. Tree Traversals (O(n) Time, O(h) Space):**\n` +
            `  - **In-Order (Left → Root → Right):** Visits BST nodes in sorted ascending order.\n` +
            `  - **Pre-Order (Root → Left → Right):** Used for cloning/serializing trees.\n` +
            `  - **Post-Order (Left → Right → Root):** Used for deleting/freeing nodes bottom-up.\n` +
            `• **2. AVL Self-Balancing Rotations:** Track balance factor **BF = height(left) − height(right) ∈ {−1, 0, 1}**. Fix imbalances via **LL (Right Rotate)**, **RR (Left Rotate)**, **LR (Left-Right)**, or **RL (Right-Left)** in O(1) pointer updates.\n` +
            `• **3. Complexity:** Search, Insertion, and Deletion all run in guaranteed **O(log n)** time.`;
    }

    return `📘 **Solution & Key Concepts — ${title} (${taskObj.course || 'Study Task'}):**\n` +
        `• **Core Thesis / Objective:** Define the primary formula, theorem, or problem statement for **${title}** first.\n` +
        `• **Step-by-Step Derivation:** Write out the given parameters, apply the governing equation/algorithm, and verify boundary cases.\n` +
        `• **Summary Conclusion:** State the final numerical or conceptual result clearly in 1–2 sentences.${taskObj.description ? `\n• **Task Notes:** ${taskObj.description}` : ''}`;
}

function handleAiAssignmentPick(idxOrAll) {
    const pendingTasks = ((window.appState && window.appState.tasks) || []).filter(t => !t.completed);
    if (idxOrAll === 'all') {
        appendUserChatBubble('Solve all my assignments');
        if (pendingTasks.length === 0) {
            dismissAiInteractiveFlow();
            appendAiChatBubble(`You currently have no pending assignments in your task list! Type any question or topic and I'll give you the direct answer.`, false, 'study_answer');
            return;
        }
        const combinedSolutions = pendingTasks.slice(0, 4).map(t => buildAssignmentSolutionText(t)).join('\n\n');
        activeAiFlow = { step: 'post_assignment_actions', taskId: pendingTasks[0].id };
        appendAiChatBubble(combinedSolutions, false, 'study_answer');
        renderAiFlowPopup();
        return;
    }

    const chosen = pendingTasks[idxOrAll];
    if (!chosen) return;
    appendUserChatBubble(chosen.title);
    const ans = buildAssignmentSolutionText(chosen);
    activeAiFlow = { step: 'post_assignment_actions', taskId: chosen.id };
    appendAiChatBubble(ans, false, 'study_answer');
    renderAiFlowPopup();
}

function handleAiSaveAnswerToNotes() {
    const cleanText = (aiConversationMemory.lastAnswerText || '').replace(/\*\*/g, '').trim();
    if (!cleanText) return;
    activeAiFlow = null;
    stageAiPendingAction(
        {
            type: 'append_study_notes',
            noteText: cleanText,
            summary: `Save the AI assignment solution into Quick Study Notes`
        },
        `📝 Ready to append this solution to your **Quick Study Notes**. Click **Apply (Yes)** below to confirm.`
    );
}

function handleAiCompleteAssignmentTask(taskId) {
    const taskObj = ((window.appState && window.appState.tasks) || []).find(t => t.id === taskId);
    if (!taskObj) return;
    activeAiFlow = null;
    stageAiPendingAction(
        {
            type: 'complete_task',
            query: taskObj.title,
            summary: `Mark assignment "${taskObj.title}" as completed`
        },
        `✅ Ready to mark **"${taskObj.title}"** as completed. Click **Apply (Yes)** below to confirm.`
    );
}

// Handlers for clicking popup options above the typefield
function handleAiCourseSelectClick(courseId) {
    const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    appendUserChatBubble(course.name);
    activeAiFlow = { step: 'select_course_edit', courseId: course.id, courseName: course.name };
    const code = (course.code || course.name.slice(0, 2)).slice(0, 2).toUpperCase();
    appendAiChatBubble(
        `✏️ Selected **[${code}] ${course.name}** (current colour: **${getColorLabelByHex(course.color)}**).\n` +
        `Which edit do you need? Pick an option below or type:\n` +
        `• \`change colour to violet\` — or \`change letters to PY\` — or \`change name to ...\``,
        false,
        'course_flow'
    );
    renderAiFlowPopup();
}

function handleAiStartAddNewCourse() {
    activeAiFlow = { step: 'await_new_course_name' };
    appendAiChatBubble(`🎓 What is the **name** of the new course you want to add? (e.g. \`Biology\`, \`Data Structures\`)`, false, 'course_flow');
    renderAiFlowPopup();
    const input = document.getElementById('ai-chat-input');
    if (input) input.focus();
}

function handleAiCourseColorPick(colorKey) {
    if (!activeAiFlow || !activeAiFlow.courseId) return;
    const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
    const course = courses.find(c => c.id === activeAiFlow.courseId);
    const colObj = AI_COLOR_PALETTE.find(c => c.key === colorKey);
    if (!course || !colObj) return;
    const code = (course.code || course.name.slice(0, 2)).slice(0, 2).toUpperCase();
    activeAiFlow = null;
    stageAiPendingAction(
        {
            type: 'edit_course',
            courseId: course.id,
            newColor: colObj.hex,
            colorLabel: colObj.label,
            previewBadge: { code, color: colObj.hex },
            summary: `Change "${course.name}" [${code}] colour to ${colObj.label} (${colObj.hex})`
        },
        `🎨 Ready to update **${course.name} [${code}]** colour to **${colObj.label} (${colObj.hex})**. Click **Apply (Yes)** below to confirm.`
    );
}

function handleAiCourseEditModePick(mode) {
    if (!activeAiFlow || !activeAiFlow.courseId) return;
    const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
    const course = courses.find(c => c.id === activeAiFlow.courseId);
    if (!course) return;
    const code = (course.code || course.name.slice(0, 2)).slice(0, 2).toUpperCase();

    if (mode === 'name') {
        activeAiFlow = { step: 'await_course_name', courseId: course.id, courseName: course.name };
        appendAiChatBubble(`✏️ Type the **new course name** for **${course.name} [${code}]**:`, false, 'course_flow');
        renderAiFlowPopup();
    } else if (mode === 'code') {
        activeAiFlow = { step: 'await_course_code', courseId: course.id, courseName: course.name };
        appendAiChatBubble(`🔤 Type the **new 2-letter badge code** for **${course.name}** (currently \`[${code}]\`):`, false, 'course_flow');
        renderAiFlowPopup();
    } else if (mode === 'delete') {
        activeAiFlow = null;
        stageAiPendingAction(
            {
                type: 'delete_course',
                courseId: course.id,
                courseName: course.name,
                summary: `Delete course "${course.name}" [${code}] from Active Courses`
            },
            `🗑️ Ready to delete **${course.name} [${code}]**. Click **Apply (Yes)** below to confirm.`
        );
    }
}

function handleAiThemePick(kind, value) {
    activeAiFlow = null;
    if (kind === 'solid') {
        const tObj = (typeof FP_THEMES !== 'undefined' ? FP_THEMES : []).find(t => t.id === value);
        const tName = tObj ? tObj.name : value;
        stageAiPendingAction(
            {
                type: 'set_solid_theme',
                themeId: value,
                themeName: tName,
                previewColor: tObj ? tObj.accent : '#5f5bf6',
                summary: `Switch application theme to "${tName}"`
            },
            `🎨 Ready to switch your theme to **${tName}**. Confirm below to apply.`
        );
    } else if (kind === 'surface') {
        stageAiPendingAction(
            {
                type: 'surface_mode',
                mode: value,
                summary: `Switch surface mode to ${value === 'light' ? 'White Mode' : 'Dark Mode'}`
            },
            `🎨 Ready to switch surface mode to **${value === 'light' ? 'White Mode' : 'Dark Mode'}**. Confirm below to apply.`
        );
    } else if (kind === 'liquid') {
        const nextState = !window.appState.liquidEffect;
        stageAiPendingAction(
            {
                type: 'set_liquid_glass',
                enabled: nextState,
                summary: `${nextState ? 'Enable' : 'Disable'} Liquid Glass visual mode`
            },
            `✨ Ready to **${nextState ? 'enable' : 'disable'} Liquid Glass Mode**. Confirm below to apply.`
        );
    } else if (kind === 'accent') {
        const colObj = AI_COLOR_PALETTE.find(c => c.key === value);
        if (!colObj) return;
        stageAiPendingAction(
            {
                type: 'set_accent_color',
                hex: colObj.hex,
                label: colObj.label,
                previewColor: colObj.hex,
                summary: `Change accent colour to ${colObj.label} (${colObj.hex})`
            },
            `🎨 Ready to change your accent colour to **${colObj.label} (${colObj.hex})**. Confirm below to apply.`
        );
    }
}

function handleAiAddAllBasicHabitsPick() {
    activeAiFlow = null;
    stageAiPendingAction(
        {
            type: 'add_basic_habits',
            summary: `Add / refresh the 5 FocusPulse Core Basic Habits (Hydration, Reading, Fitness, Deep Work, Mindfulness)`
        },
        `🔥 Ready to apply the **5 Core Basic Habits** to your Habit Flow Tracker. Confirm below to apply.`
    );
}

function handleAiAddAllExtraHabitsPick() {
    activeAiFlow = null;
    stageAiPendingAction(
        {
            type: 'add_multiple_habits',
            items: EXTRA_HABITS_PRESETS,
            summary: `Add 5 Extra Starter Habits (Healthy Meal, Walk/Run, Coding, 8h Sleep, Digital Detox)`
        },
        `🚀 Ready to add the **5 Extra Starter Habits** to your Habit Flow Tracker. Confirm below to apply.`
    );
}

function handleAiPresetHabitPick(idx) {
    const preset = ALL_HABIT_SUGGESTIONS[idx];
    if (!preset) return;
    activeAiFlow = null;
    stageAiPendingAction(
        {
            type: 'add_habit',
            name: preset.name,
            category: preset.category,
            color: preset.color,
            icon: preset.icon,
            targetPerWeek: preset.targetPerWeek,
            summary: `Add daily habit "${preset.name}" (${preset.icon} ${preset.category})`
        },
        `🔥 Ready to add habit **"${preset.name}"**. Confirm below to apply.`
    );
}

function handleAiSettingPick(settingKey) {
    activeAiFlow = null;
    if (settingKey === 'pomo_classic') {
        stageAiPendingAction({
            type: 'set_pomo_preset',
            name: 'Classic', focus: 25, short: 5, long: 15, count: 4,
            summary: 'Set Pomodoro Timer to Classic (25m Focus / 5m Short / 15m Long)'
        }, `⏱️ Ready to apply the **Classic (25/5m)** Pomodoro preset. Confirm below.`);
    } else if (settingKey === 'pomo_extended') {
        stageAiPendingAction({
            type: 'set_pomo_preset',
            name: 'Extended', focus: 50, short: 10, long: 20, count: 3,
            summary: 'Set Pomodoro Timer to Extended (50m Focus / 10m Short / 20m Long)'
        }, `⏱️ Ready to apply the **Extended (50/10m)** Pomodoro preset. Confirm below.`);
    } else if (settingKey === 'pomo_blitz') {
        stageAiPendingAction({
            type: 'set_pomo_preset',
            name: 'Blitz', focus: 15, short: 3, long: 10, count: 6,
            summary: 'Set Pomodoro Timer to Blitz (15m Focus / 3m Short / 10m Long)'
        }, `⏱️ Ready to apply the **Blitz (15/3m)** Pomodoro preset. Confirm below.`);
    } else if (settingKey === 'water_2500' || settingKey === 'water_3000') {
        const goal = settingKey === 'water_3000' ? 3000 : 2500;
        stageAiPendingAction({
            type: 'set_water_goal',
            goalMl: goal,
            summary: `Set Daily Hydration Goal to ${goal} ml`
        }, `💧 Ready to update your daily hydration goal to **${goal} ml**. Confirm below.`);
    } else if (settingKey === 'toggle_perf') {
        const nextVal = !window.appState.performanceMode;
        stageAiPendingAction({
            type: 'set_performance_mode',
            enabled: nextVal,
            summary: `${nextVal ? 'Enable' : 'Disable'} Low-Spec / Performance Mode`
        }, `⚡ Ready to **${nextVal ? 'enable' : 'disable'} Performance Mode**. Confirm below.`);
    } else if (settingKey === 'toggle_liquid') {
        const nextVal = !window.appState.liquidEffect;
        stageAiPendingAction({
            type: 'set_liquid_glass',
            enabled: nextVal,
            summary: `${nextVal ? 'Enable' : 'Disable'} Liquid Glass Mode`
        }, `✨ Ready to **${nextVal ? 'enable' : 'disable'} Liquid Glass Mode**. Confirm below.`);
    } else if (settingKey === 'toggle_sound') {
        const nextVal = window.appState.soundEnabled === false;
        stageAiPendingAction({
            type: 'set_sound_enabled',
            enabled: nextVal,
            summary: `${nextVal ? 'Enable' : 'Mute'} timer & alert sound effects`
        }, `🔊 Ready to **${nextVal ? 'enable' : 'mute'} sound effects**. Confirm below.`);
    } else if (settingKey === 'toggle_notif') {
        const nextVal = window.appState.notificationsEnabled === false;
        stageAiPendingAction({
            type: 'set_notifications_enabled',
            enabled: nextVal,
            summary: `${nextVal ? 'Enable' : 'Disable'} desktop & app notifications`
        }, `🔔 Ready to **${nextVal ? 'enable' : 'disable'} notifications**. Confirm below.`);
    }
}

function sendQuickAiPrompt(text) {
    const input = document.getElementById('ai-chat-input');
    if (input) {
        input.value = text;
        handleAiChatSubmit(new Event('submit'));
    }
}

// Parse comma/and-separated list of item names typed by the user (e.g. "Morning Run, Read 10 Pages" or "Coding and Stretching")
function splitMultiItemInput(rawStr) {
    const cleaned = rawStr
        .replace(/^(?:add|create|new|make)\s+(?:a\s+|new\s+)*(?:\d+|one|two|three|four|five|couple|few|both)?\s*(?:new\s+)?(?:habits?|tasks?|courses?)[:\s-]*/i, '')
        .trim();
    if (!cleaned) return [];
    if (cleaned.includes(',')) {
        return cleaned.split(',').map(s => s.replace(/^\s*(?:and|&)\s+/i, '').trim()).filter(Boolean);
    }
    if (/\s+(?:and|&)\s+/i.test(cleaned)) {
        return cleaned.split(/\s+(?:and|&)\s+/i).map(s => s.trim()).filter(Boolean);
    }
    return [cleaned];
}

// Handle user input when an interactive multi-step flow (activeAiFlow) is active
function processActiveAiFlowInput(rawPrompt) {
    if (!activeAiFlow) return false;
    const clean = rawPrompt.trim();
    const norm = normalizeAiCommandText(clean).toLowerCase();

    if (/^(?:cancel|exit|stop|nevermind|quit)$/i.test(norm)) {
        dismissAiInteractiveFlow();
        appendAiChatBubble(`Cancelled the current selection. Tell me what you'd like to do next!`);
        return true;
    }

    // Step 0A: Multi-item collection flow ("Add a new two habits", "add 3 tasks", "add 2 courses")
    if (activeAiFlow.step === 'collect_multiple_items') {
        // Check if the user switched to an unrelated global command (like "change settings" or "edit my courses")
        if (/^(?:change|edit)\s+(?:my\s+)?(?:settings?|themes?|courses?)\b/i.test(norm) || /\bhelp\b.*\bassignment/i.test(norm)) {
            activeAiFlow = null;
            hideAiInlinePopupTray();
            return false;
        }

        const { entityType, targetCount, collected } = activeAiFlow;
        const parts = splitMultiItemInput(clean);
        if (parts.length === 0) return false;

        for (const p of parts) {
            if (entityType === 'habit') {
                // Check if user typed a number referring to suggestion chip index (1-10)
                if (/^\d+$/.test(p)) {
                    const idx = parseInt(p, 10) - 1;
                    if (ALL_HABIT_SUGGESTIONS[idx]) {
                        collected.push({ ...ALL_HABIT_SUGGESTIONS[idx] });
                        continue;
                    }
                }
                const matchedPreset = ALL_HABIT_SUGGESTIONS.find(h => h.name.toLowerCase().includes(p.toLowerCase()));
                if (matchedPreset && p.length >= 4) {
                    collected.push({ ...matchedPreset });
                } else {
                    collected.push({ name: p, category: 'Productivity', color: 'violet', icon: '⚡', targetPerWeek: 5 });
                }
            } else if (entityType === 'task') {
                collected.push({ title: p });
            } else if (entityType === 'course') {
                const code = p.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CR';
                collected.push({ name: p, code, color: '#8b5cf6' });
            }
        }

        if (collected.length >= targetCount) {
            finalizeMultiItemCollection();
            return true;
        } else {
            const remaining = targetCount - collected.length;
            const latestName = collected[collected.length - 1].name || collected[collected.length - 1].title;
            const ordinal = collected.length === 1 ? '2nd' : (collected.length === 2 ? '3rd' : 'next');
            appendAiChatBubble(
                `👍 Got #${collected.length}: **${latestName}**! What is the **${ordinal} ${entityType}** you'd like to add? (${remaining} more needed — pick one below or type it in the box)`,
                false,
                'multi_item_flow'
            );
            renderAiFlowPopup();
            return true;
        }
    }

    // Step 0B: Waiting for assignment selection ("Hello me with my assignment" -> "I need answers" / "1" / "Physics")
    if (activeAiFlow.step === 'select_assignment') {
        const pendingTasks = ((window.appState && window.appState.tasks) || []).filter(t => !t.completed);
        if (/\b(?:i\s+need\s+answers?|give\s+(?:me\s+)?answers?|all|everything|both|solve\s+all|yes|sure|ok)\b/i.test(norm)) {
            if (pendingTasks.length === 0) {
                dismissAiInteractiveFlow();
                appendAiChatBubble(`You have no pending assignments in your task tracker right now. Type your assignment question or topic directly and I'll solve it for you!`, false, 'study_answer');
                return true;
            }
            const combined = pendingTasks.slice(0, 4).map(t => buildAssignmentSolutionText(t)).join('\n\n');
            activeAiFlow = { step: 'post_assignment_actions', taskId: pendingTasks[0].id };
            appendAiChatBubble(combined, false, 'study_answer');
            renderAiFlowPopup();
            return true;
        }

        const matchedTask = findTaskFromText(clean);
        if (matchedTask) {
            const ans = buildAssignmentSolutionText(matchedTask);
            activeAiFlow = { step: 'post_assignment_actions', taskId: matchedTask.id };
            appendAiChatBubble(ans, false, 'study_answer');
            renderAiFlowPopup();
            return true;
        }

        // If user typed a custom assignment topic/question directly while in select_assignment flow, exit flow and answer it!
        activeAiFlow = null;
        hideAiInlinePopupTray();
        return false;
    }

    // Step 0C: Post-assignment action tray active
    if (activeAiFlow.step === 'post_assignment_actions') {
        if (/\b(?:save|note|notes)\b/i.test(norm)) {
            handleAiSaveAnswerToNotes();
            return true;
        }
        if (/\b(?:complete|done|finish|mark)\b/i.test(norm) && activeAiFlow.taskId) {
            handleAiCompleteAssignmentTask(activeAiFlow.taskId);
            return true;
        }
        activeAiFlow = null;
        hideAiInlinePopupTray();
        return false;
    }

    // Step A: Waiting for user to pick a course to edit
    if (activeAiFlow.step === 'select_course') {
        if (/^(?:add|new|create)\b/i.test(norm)) {
            const afterAdd = clean.replace(/^(?:add|new|create)\s*(?:course)?[:\s-]*/i, '').trim();
            if (afterAdd) {
                const code = afterAdd.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CR';
                activeAiFlow = null;
                stageAiPendingAction(
                    {
                        type: 'add_course',
                        name: afterAdd,
                        code,
                        color: '#8b5cf6',
                        previewBadge: { code, color: '#8b5cf6' },
                        summary: `Add new course "${afterAdd}" [${code}]`
                    },
                    `🎓 Ready to add course **"${afterAdd}" [${code}]**. Confirm below to apply.`
                );
                return true;
            }
            handleAiStartAddNewCourse();
            return true;
        }

        const matchedCourse = findCourseFromText(clean);
        if (matchedCourse) {
            activeAiFlow = { step: 'select_course_edit', courseId: matchedCourse.id, courseName: matchedCourse.name };
            const code = (matchedCourse.code || matchedCourse.name.slice(0, 2)).slice(0, 2).toUpperCase();
            appendAiChatBubble(
                `✏️ Selected **[${code}] ${matchedCourse.name}** (current colour: **${getColorLabelByHex(matchedCourse.color)}**).\n` +
                `Which edit do you need? Pick an option below or type:\n` +
                `• \`change colour to violet\` — or \`change letters to PY\` — or \`change name to ...\``,
                false,
                'course_flow'
            );
            renderAiFlowPopup();
            return true;
        }
        activeAiFlow = null;
        hideAiInlinePopupTray();
        return false;
    }

    // Step B: Course is selected; waiting for which edit to perform (color, code/letters, name, delete)
    if (activeAiFlow.step === 'select_course_edit') {
        const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
        const course = courses.find(c => c.id === activeAiFlow.courseId);
        if (!course) {
            dismissAiInteractiveFlow();
            return false;
        }
        const curCode = (course.code || course.name.slice(0, 2)).slice(0, 2).toUpperCase();

        if (/^(?:delete|remove|drop)\b/i.test(norm)) {
            activeAiFlow = null;
            stageAiPendingAction(
                {
                    type: 'delete_course',
                    courseId: course.id,
                    courseName: course.name,
                    summary: `Delete course "${course.name}" [${curCode}] from Active Courses`
                },
                `🗑️ Ready to delete **${course.name} [${curCode}]**. Click **Apply (Yes)** below to confirm.`
            );
            return true;
        }

        const matchedColor = resolveAiColor(clean);
        if (matchedColor && (norm.includes('color') || norm.includes('to ') || norm.split(' ').length <= 3)) {
            activeAiFlow = null;
            stageAiPendingAction(
                {
                    type: 'edit_course',
                    courseId: course.id,
                    newColor: matchedColor.hex,
                    colorLabel: matchedColor.label,
                    previewBadge: { code: curCode, color: matchedColor.hex },
                    summary: `Change "${course.name}" [${curCode}] colour to ${matchedColor.label} (${matchedColor.hex})`
                },
                `🎨 Ready to update **${course.name} [${curCode}]** colour to **${matchedColor.label} (${matchedColor.hex})**. Confirm below to apply.`
            );
            return true;
        }

        if (/\b(?:letter|letters|code|badge|short|initials)\b/i.test(norm)) {
            const codeMatch = clean.match(/(?:to|as|is|:)\s*([A-Za-z0-9]{1,3})\s*$/i) || clean.match(/\b(?:letters?|code|badge)\s+([A-Za-z0-9]{1,3})\s*$/i);
            if (codeMatch) {
                const newCode = codeMatch[1].slice(0, 2).toUpperCase();
                activeAiFlow = null;
                stageAiPendingAction(
                    {
                        type: 'edit_course',
                        courseId: course.id,
                        newCode,
                        previewBadge: { code: newCode, color: course.color || '#5f5bf6' },
                        summary: `Change 2-letter badge of "${course.name}" from [${curCode}] to [${newCode}]`
                    },
                    `🔤 Ready to update **${course.name}** 2-letter badge code to **[${newCode}]**. Confirm below to apply.`
                );
                return true;
            } else {
                activeAiFlow = { step: 'await_course_code', courseId: course.id, courseName: course.name };
                appendAiChatBubble(`🔤 What **2-letter badge code** would you like for **${course.name}**? (e.g. \`PY\`, \`CS\`, \`MA\`)`, false, 'course_flow');
                renderAiFlowPopup();
                return true;
            }
        }

        if (/\b(?:name|rename|title|call\s+it)\b/i.test(norm)) {
            const nameMatch = clean.match(/(?:name\s+to|rename\s+to|to|as|:)\s*(.+)$/i);
            if (nameMatch && nameMatch[1].trim() && !/^(?:change|edit|name|letters|code)$/i.test(nameMatch[1].trim())) {
                const newName = nameMatch[1].trim();
                const autoCode = course.code || newName.slice(0, 2).toUpperCase();
                activeAiFlow = null;
                stageAiPendingAction(
                    {
                        type: 'edit_course',
                        courseId: course.id,
                        newName,
                        previewBadge: { code: autoCode, color: course.color || '#5f5bf6' },
                        summary: `Rename course "${course.name}" to "${newName}"`
                    },
                    `✏️ Ready to rename **${course.name}** to **${newName}**. Confirm below to apply.`
                );
                return true;
            } else {
                activeAiFlow = { step: 'await_course_name', courseId: course.id, courseName: course.name };
                appendAiChatBubble(`✏️ Type the **new name** for **${course.name}**:`, false, 'course_flow');
                renderAiFlowPopup();
                return true;
            }
        }

        const otherCourse = findCourseFromText(clean);
        if (otherCourse && otherCourse.id !== course.id) {
            handleAiCourseSelectClick(otherCourse.id);
            return true;
        }

        if (/^[A-Za-z0-9]{2}$/.test(clean)) {
            const newCode = clean.toUpperCase();
            activeAiFlow = null;
            stageAiPendingAction(
                {
                    type: 'edit_course',
                    courseId: course.id,
                    newCode,
                    previewBadge: { code: newCode, color: course.color || '#5f5bf6' },
                    summary: `Change 2-letter badge of "${course.name}" to [${newCode}]`
                },
                `🔤 Ready to update **${course.name}** 2-letter badge code to **[${newCode}]**. Confirm below to apply.`
            );
            return true;
        }

        appendAiChatBubble(
            `For **${course.name} [${curCode}]**, tell me what you'd like to change:\n` +
            `• **Colour:** \`change colour to violet\` • **Code:** \`change letters to PY\` • **Name:** \`change name to Python\``,
            false,
            'course_flow'
        );
        renderAiFlowPopup();
        return true;
    }

    // Step C: Waiting for new course name
    if (activeAiFlow.step === 'await_course_name') {
        const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
        const course = courses.find(c => c.id === activeAiFlow.courseId);
        if (!course) { dismissAiInteractiveFlow(); return false; }
        const newName = clean.replace(/^(?:change\s+name\s+to|rename\s+to|to)\s+/i, '').trim();
        const curCode = (course.code || newName.slice(0, 2)).slice(0, 2).toUpperCase();
        activeAiFlow = null;
        stageAiPendingAction(
            {
                type: 'edit_course',
                courseId: course.id,
                newName,
                previewBadge: { code: curCode, color: course.color || '#5f5bf6' },
                summary: `Rename course "${course.name}" to "${newName}"`
            },
            `✏️ Ready to rename **${course.name}** to **${newName}**. Confirm below to apply.`
        );
        return true;
    }

    // Step D: Waiting for new 2-letter course code
    if (activeAiFlow.step === 'await_course_code') {
        const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
        const course = courses.find(c => c.id === activeAiFlow.courseId);
        if (!course) { dismissAiInteractiveFlow(); return false; }
        const cleanedCode = clean.replace(/^(?:change\s+(?:letters?|code)\s+to|to)\s+/i, '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
        if (!cleanedCode) {
            appendAiChatBubble(`Please enter 1 or 2 letters/numbers for the badge code (e.g. \`PY\`, \`CS\`).`, false, 'course_flow');
            return true;
        }
        activeAiFlow = null;
        stageAiPendingAction(
            {
                type: 'edit_course',
                courseId: course.id,
                newCode: cleanedCode,
                previewBadge: { code: cleanedCode, color: course.color || '#5f5bf6' },
                summary: `Change 2-letter badge of "${course.name}" to [${cleanedCode}]`
            },
            `🔤 Ready to update **${course.name}** 2-letter badge code to **[${cleanedCode}]**. Confirm below to apply.`
        );
        return true;
    }

    // Step E: Waiting for brand-new course name to add
    if (activeAiFlow.step === 'await_new_course_name') {
        const newName = clean.replace(/^(?:add\s+course|course)[:\s-]*/i, '').trim();
        const code = newName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CR';
        const matchedColor = resolveAiColor(newName) || { hex: '#8b5cf6', label: 'Violet' };
        activeAiFlow = null;
        stageAiPendingAction(
            {
                type: 'add_course',
                name: newName,
                code,
                color: matchedColor.hex,
                previewBadge: { code, color: matchedColor.hex },
                summary: `Add new course "${newName}" [${code}]`
            },
            `🎓 Ready to add new course **"${newName}" [${code}]**. Confirm below to apply.`
        );
        return true;
    }

    // Step F: Waiting for theme or accent selection
    if (activeAiFlow.step === 'select_theme') {
        const directTheme = parseThemeOrColorCommand(clean);
        if (directTheme) {
            activeAiFlow = null;
            stageAiPendingAction(directTheme, `🎨 Ready to apply: **${directTheme.summary}**. Confirm below to apply.`);
            return true;
        }
        const matchedCol = resolveAiColor(clean);
        if (matchedCol) {
            activeAiFlow = null;
            stageAiPendingAction(
                {
                    type: 'set_accent_color',
                    hex: matchedCol.hex,
                    label: matchedCol.label,
                    previewColor: matchedCol.hex,
                    summary: `Change accent colour to ${matchedCol.label} (${matchedCol.hex})`
                },
                `🎨 Ready to change accent colour to **${matchedCol.label} (${matchedCol.hex})**. Confirm below to apply.`
            );
            return true;
        }
        activeAiFlow = null;
        hideAiInlinePopupTray();
        return false;
    }

    // Step G: Waiting for habit name or basic/extra habits selection
    if (activeAiFlow.step === 'select_habit') {
        // If user asked for a specific quantity while inside habit flow (e.g. "Add a new two habits")
        const reqCount = extractRequestedItemCount(norm);
        if (reqCount && reqCount >= 2) {
            activeAiFlow = null;
            hideAiInlinePopupTray();
            return false; // Let startInteractiveAiFlowIfMatched handle the multi-item flow
        }
        if (/\b(?:extra|starter|more)\b/i.test(norm)) {
            handleAiAddAllExtraHabitsPick();
            return true;
        }
        if (/\b(?:basic|sample|default|core|all)\b/i.test(norm)) {
            handleAiAddAllBasicHabitsPick();
            return true;
        }
        // Check if user typed another global command
        if (/^(?:change|edit)\s+(?:my\s+)?(?:settings?|themes?|courses?)\b/i.test(norm) || /\bhelp\b.*\bassignment/i.test(norm)) {
            activeAiFlow = null;
            hideAiInlinePopupTray();
            return false;
        }
        const habitTitle = clean.replace(/^(?:add\s+habit|new\s+habit|create\s+habit|habit)[:\s-]*/i, '').trim();
        if (habitTitle) {
            activeAiFlow = null;
            stageAiPendingAction(
                {
                    type: 'add_habit',
                    name: habitTitle,
                    summary: `Create daily habit "${habitTitle}" in Habit Flow Tracker`
                },
                `🔥 Ready to add daily habit **"${habitTitle}"**. Confirm below to apply.`
            );
            return true;
        }
        activeAiFlow = null;
        hideAiInlinePopupTray();
        return false;
    }

    // Step H: Waiting for setting selection
    if (activeAiFlow.step === 'select_setting') {
        const directCmd = parseAiActionCommand(clean);
        if (directCmd) {
            activeAiFlow = null;
            stageAiPendingAction(directCmd, `⚙️ Ready to apply: **${directCmd.summary}**. Confirm below.`);
            return true;
        }
        activeAiFlow = null;
        hideAiInlinePopupTray();
        return false;
    }

    return false;
}

function parseThemeOrColorCommand(prompt) {
    const norm = normalizeAiCommandText(prompt).toLowerCase();

    if (/\b(?:white\s+mode|light\s+mode|switch\s+to\s+white|switch\s+to\s+light)\b/.test(norm)) {
        return {
            type: 'surface_mode',
            mode: 'light',
            summary: 'Switch application surface to White Mode'
        };
    }
    if (/\b(?:dark\s+mode|switch\s+to\s+dark)\b/.test(norm)) {
        return {
            type: 'surface_mode',
            mode: 'dark',
            summary: 'Switch application surface to Dark Mode'
        };
    }

    if (/\bliquid\s*glass\b/.test(norm)) {
        const turnOff = /\b(?:off|disable|solid|remove)\b/.test(norm);
        const turnOn = /\b(?:on|enable|activate|use)\b/.test(norm);
        const nextVal = turnOff ? false : (turnOn ? true : !window.appState.liquidEffect);
        return {
            type: 'set_liquid_glass',
            enabled: nextVal,
            summary: `${nextVal ? 'Enable' : 'Disable'} Liquid Glass visual mode`
        };
    }

    const themesList = [
        { id: 'obsidian',  name: 'Obsidian',       match: /\bobsidian\b/, accent: '#64748b' },
        { id: 'midnight',  name: 'Midnight Navy',  match: /\bmidnight(?:\s*navy)?\b/, accent: '#4f46e5' },
        { id: 'forest',    name: 'Forest Emerald', match: /\bforest(?:\s*emerald)?\b/, accent: '#10b981' },
        { id: 'cyberpunk', name: 'Cyberpunk',      match: /\bcyber\s*punk\b/, accent: '#d946ef' },
        { id: 'sunset',    name: 'Sunset Crimson', match: /\bsunset(?:\s*crimson)?\b/, accent: '#ef4444' },
        { id: 'pureblack', name: 'Pure Black',     match: /\bpure\s*black\b|\boled\b/, accent: '#0f172a' },
        { id: 'purewhite', name: 'Pure White',     match: /\bpure\s*white\b/, accent: '#4f46e5' }
    ];
    for (const t of themesList) {
        if (t.match.test(norm)) {
            return {
                type: 'set_solid_theme',
                themeId: t.id,
                themeName: t.name,
                previewColor: t.accent,
                summary: `Switch solid theme to "${t.name}"`
            };
        }
    }

    if (/\b(?:accent|theme|color|change|set|switch)\b/.test(norm) && !/\bcourse\b/.test(norm)) {
        const col = resolveAiColor(norm);
        if (col) {
            return {
                type: 'set_accent_color',
                hex: col.hex,
                label: col.label,
                previewColor: col.hex,
                summary: `Change accent colour to ${col.label} (${col.hex})`
            };
        }
    }

    return null;
}

// Parse one-shot commands & natural language system intents
function parseAiActionCommand(prompt) {
    const clean = prompt.trim();
    const norm = normalizeAiCommandText(clean);
    const lower = norm.toLowerCase();

    // 1. Add Basic Habits (only if some are missing; if all 5 exist, let startInteractiveAiFlowIfMatched offer Extra Starter Habits!)
    if (/\b(?:add|restore|load|reset|create|get|include)\s+(?:the\s+|my\s+|our\s+)?(?:basic|sample|default|starter|core)\s+habits?\b/i.test(norm) ||
        /^basic\s+habits?$/i.test(norm)) {
        const existingNames = new Set(((window.appState && window.appState.habits) || []).map(h => h.name.toLowerCase()));
        const missingCount = BASIC_HABITS_PRESETS.filter(p => !existingNames.has(p.name.toLowerCase())).length;
        if (missingCount > 0 || /\b(?:reset|restore)\b/i.test(norm)) {
            return {
                type: 'add_basic_habits',
                summary: 'Add the 5 FocusPulse Basic Habits (Hydration, Reading, Fitness, Deep Work, Mindfulness)'
            };
        }
        // When all 5 basic habits already exist, return null here so startInteractiveAiFlowIfMatched opens the smart Extra/Basic Habit chooser!
        return null;
    }

    // 2. Multi-item inline list (e.g. "add 2 habits: Morning Run, Read 10 Pages" or "add habits Coding and Stretching")
    const inlineMultiHabitMatch = norm.match(/^(?:add|create|new)\s+(?:a\s+|new\s+)*(?:\d+|two|three|four|five|couple|few|both)?\s*(?:new\s+)?habits?\s*[:,-]\s*(.+)$/i);
    if (inlineMultiHabitMatch) {
        const parts = splitMultiItemInput(inlineMultiHabitMatch[1]);
        if (parts.length >= 2) {
            const items = parts.map(p => ({ name: p, category: 'Productivity', color: 'violet', icon: '⚡', targetPerWeek: 5 }));
            return {
                type: 'add_multiple_habits',
                items,
                summary: `Add ${items.length} habits: ${items.map(x => `"${x.name}"`).join(', ')}`
            };
        }
    }

    // 3. Mark / Complete ALL Habits Today
    if (/\b(?:check|complete|mark|finish|log)\s+all\s+habits?\b/i.test(norm)) {
        return {
            type: 'mark_all_habits',
            summary: 'Mark all daily habits as completed for today'
        };
    }

    // 4. Add Task (with title, excluding multi-count requests like "add 2 tasks")
    if (!extractRequestedItemCount(norm)) {
        const addTaskMatch = norm.match(/^(?:add|create|new)\s+task[:\s,-]+(.+)$/i);
        if (addTaskMatch) {
            const rawTitle = addTaskMatch[1].trim();
            return {
                type: 'add_task',
                title: rawTitle,
                summary: `Add new task "${rawTitle}" to Smart Task Tracker`
            };
        }
    }
    if (lower === 'add task' || lower === 'new task' || lower === 'create task') {
        return {
            type: 'add_task',
            title: 'Focused Study Session',
            summary: 'Add new task "Focused Study Session" to Smart Task Tracker'
        };
    }

    // 5. Complete / Delete Task (explicit or natural phrasing like "I finished my physics lab")
    const completeTaskMatch = norm.match(/^(?:complete|finish|done|mark|check)\s+task[:\s,-]+(.+)$/i) ||
                              norm.match(/^(?:i\s+)?(?:finished|completed|did|done\s+with)\s+(?:my\s+|the\s+)?(.+)$/i);
    if (completeTaskMatch) {
        const queryTitle = completeTaskMatch[1].trim();
        const matched = findTaskFromText(queryTitle);
        if (matched || /^complete|finish|done|mark|check/i.test(norm)) {
            const targetLabel = matched ? matched.title : queryTitle;
            return {
                type: 'complete_task',
                query: targetLabel,
                summary: `Mark task "${targetLabel}" as completed`
            };
        }
    }
    const deleteTaskMatch = norm.match(/^(?:delete|remove)\s+task[:\s,-]+(.+)$/i);
    if (deleteTaskMatch) {
        const queryTitle = deleteTaskMatch[1].trim();
        return {
            type: 'delete_task',
            query: queryTitle,
            summary: `Delete task matching "${queryTitle}"`
        };
    }

    // 6. Add single Habit with specific name provided (only when not a quantified request like "Add a new two habits")
    if (!extractRequestedItemCount(norm)) {
        const addHabitMatch = norm.match(/^(?:add|create|new)\s+habit[:\s,-]+(.+)$/i);
        if (addHabitMatch && !/^(?:basic|sample|default|extra|starter|habits?)$/i.test(addHabitMatch[1].trim())) {
            const rawHabit = addHabitMatch[1].trim();
            return {
                type: 'add_habit',
                name: rawHabit,
                summary: `Create daily habit "${rawHabit}" in Habit Flow Tracker`
            };
        }
    }

    // 7. Check / Delete Habit
    const checkHabitMatch = norm.match(/^(?:check|complete|log|done)\s+habit[:\s,-]+(.+)$/i);
    if (checkHabitMatch) {
        const queryHabit = checkHabitMatch[1].trim();
        return {
            type: 'check_habit',
            query: queryHabit,
            summary: `Log today's completion for habit matching "${queryHabit}"`
        };
    }
    const deleteHabitMatch = norm.match(/^(?:delete|remove)\s+habit[:\s,-]+(.+)$/i);
    if (deleteHabitMatch) {
        const queryHabit = deleteHabitMatch[1].trim();
        return {
            type: 'delete_habit',
            query: queryHabit,
            summary: `Delete habit matching "${queryHabit}"`
        };
    }

    // 8. Direct One-Shot Course Edits (e.g. "change CS101 colour to violet", "add course Biology", "delete course Physics")
    if (!extractRequestedItemCount(norm)) {
        const addCourseMatch = norm.match(/^(?:add|create|new)\s+course[:\s,-]+(.+)$/i);
        if (addCourseMatch) {
            const rawCourse = addCourseMatch[1].trim();
            const code = rawCourse.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CR';
            const col = resolveAiColor(rawCourse) || { hex: '#8b5cf6', label: 'Violet' };
            return {
                type: 'add_course',
                name: rawCourse,
                code,
                color: col.hex,
                previewBadge: { code, color: col.hex },
                summary: `Add new course "${rawCourse}" [${code}]`
            };
        }
    }
    const delCourseMatch = norm.match(/^(?:delete|remove|drop)\s+course[:\s,-]+(.+)$/i);
    if (delCourseMatch) {
        const target = findCourseFromText(delCourseMatch[1]);
        if (target) {
            const code = (target.code || target.name.slice(0, 2)).slice(0, 2).toUpperCase();
            return {
                type: 'delete_course',
                courseId: target.id,
                courseName: target.name,
                summary: `Delete course "${target.name}" [${code}] from Active Courses`
            };
        }
    }
    if (/\bcourses?\b/i.test(norm) || (window.appState.courses || []).some(c => lower.includes(c.name.toLowerCase()))) {
        const matchedCourse = findCourseFromText(norm);
        if (matchedCourse && /\b(?:change|edit|set|update|make|color|letter|code|name|rename)\b/i.test(norm)) {
            const curCode = (matchedCourse.code || matchedCourse.name.slice(0, 2)).slice(0, 2).toUpperCase();
            const col = resolveAiColor(norm);
            if (col) {
                return {
                    type: 'edit_course',
                    courseId: matchedCourse.id,
                    newColor: col.hex,
                    colorLabel: col.label,
                    previewBadge: { code: curCode, color: col.hex },
                    summary: `Change "${matchedCourse.name}" [${curCode}] colour to ${col.label} (${col.hex})`
                };
            }
            const codeMatch = norm.match(/\b(?:letters?|code|badge)\s+(?:to\s+)?([A-Za-z0-9]{1,2})\b/i);
            if (codeMatch) {
                const newCode = codeMatch[1].toUpperCase();
                return {
                    type: 'edit_course',
                    courseId: matchedCourse.id,
                    newCode,
                    previewBadge: { code: newCode, color: matchedCourse.color || '#5f5bf6' },
                    summary: `Change 2-letter badge of "${matchedCourse.name}" to [${newCode}]`
                };
            }
            const renameMatch = norm.match(/\b(?:rename|name)\s+(?:to\s+)(.+)$/i);
            if (renameMatch) {
                const newName = renameMatch[1].trim();
                return {
                    type: 'edit_course',
                    courseId: matchedCourse.id,
                    newName,
                    previewBadge: { code: curCode, color: matchedCourse.color || '#5f5bf6' },
                    summary: `Rename course "${matchedCourse.name}" to "${newName}"`
                };
            }
        }
    }

    // 9. Theme, Surface Mode, Liquid Glass, Accent Colour
    const themeCmd = parseThemeOrColorCommand(norm);
    if (themeCmd) return themeCmd;

    // 10. Add Plan / Schedule
    const addPlanMatch = norm.match(/^(?:add|create|new)\s+(?:plan|schedule)[:\s,-]*(.*)$/i);
    if (addPlanMatch) {
        const rawPlan = addPlanMatch[1].trim() || 'AI Deep Focus Sprint';
        return {
            type: 'add_plan',
            presetName: rawPlan,
            hours: 4,
            sessions: 4,
            summary: `Add study plan "${rawPlan}" (4 hrs / 4 sessions)`
        };
    }

    // 11. Start / Pause Pomodoro Timer & Timer Presets/Minutes
    if (lower === 'start timer' || lower === 'start pomodoro' || lower === 'start focus') {
        return {
            type: 'start_timer',
            summary: `Start a ${window.appState.timerSettings.pomodoro || 25}-minute Deep Focus Pomodoro timer`
        };
    }
    if (lower === 'pause timer' || lower === 'stop timer') {
        return {
            type: 'pause_timer',
            summary: 'Pause the active Pomodoro timer'
        };
    }
    if (lower === 'classic' || lower === 'classic preset') {
        return { type: 'set_pomo_preset', name: 'Classic', focus: 25, short: 5, long: 15, count: 4, summary: 'Set Pomodoro Timer to Classic (25m / 5m)' };
    }
    if (lower === 'extended' || lower === 'extended preset') {
        return { type: 'set_pomo_preset', name: 'Extended', focus: 50, short: 10, long: 20, count: 3, summary: 'Set Pomodoro Timer to Extended (50m / 10m)' };
    }
    if (lower === 'blitz' || lower === 'blitz preset') {
        return { type: 'set_pomo_preset', name: 'Blitz', focus: 15, short: 3, long: 10, count: 6, summary: 'Set Pomodoro Timer to Blitz (15m / 3m)' };
    }
    const pomoMinsMatch = norm.match(/\b(?:set|change)\s+(?:pomodoro|focus|timer)(?:\s+duration|\s+time)?\s+(?:to\s+)?(\d+)\s*(?:m|min|mins|minutes)?\b/i);
    if (pomoMinsMatch) {
        const mins = Math.max(1, Math.min(180, parseInt(pomoMinsMatch[1], 10)));
        return {
            type: 'set_pomo_minutes',
            minutes: mins,
            summary: `Set Pomodoro focus duration to ${mins} minutes`
        };
    }

    // 12. Hydration / Water Logging, Reset, and Goal Settings (including natural "I drank water")
    if (lower.includes('reset water') || lower.includes('reset hydration')) {
        return {
            type: 'reset_water',
            summary: "Reset today's hydration counter to 0 ml"
        };
    }
    if (lower.includes('log water') || lower.includes('drink water') || lower === 'hydrate' || lower === 'add water' ||
        /\b(?:i\s+drank|just\s+drank|had\s+a\s+glass\s+of)\s+water\b/i.test(norm)) {
        return {
            type: 'log_water',
            summary: `Log +${window.appState.glassSizeMl || 250} ml water intake`
        };
    }
    const waterGoalMatch = norm.match(/\b(?:set|change)\s+(?:daily\s+)?(?:water|hydration)\s+goal\s+(?:to\s+)?(\d+)\s*(?:ml)?\b/i);
    if (waterGoalMatch) {
        const goalMl = Math.max(500, Math.min(10000, parseInt(waterGoalMatch[1], 10)));
        return {
            type: 'set_water_goal',
            goalMl,
            summary: `Set Daily Hydration Goal to ${goalMl} ml`
        };
    }
    const glassSizeMatch = norm.match(/\b(?:set|change)\s+glass\s+size\s+(?:to\s+)?(\d+)\s*(?:ml)?\b/i);
    if (glassSizeMatch) {
        const glassMl = Math.max(50, Math.min(2000, parseInt(glassSizeMatch[1], 10)));
        return {
            type: 'set_glass_size',
            glassMl,
            summary: `Set water glass size to ${glassMl} ml`
        };
    }

    // 13. Performance Mode, UI Scale, Sound, Notifications, Streak, User Profile Name, Quick Notes
    if (/\b(?:performance\s+mode|low\s*spec\s+mode)\b/i.test(norm)) {
        const off = /\b(?:off|disable)\b/i.test(norm);
        const on = /\b(?:on|enable)\b/i.test(norm);
        const nextVal = off ? false : (on ? true : !window.appState.performanceMode);
        return {
            type: 'set_performance_mode',
            enabled: nextVal,
            summary: `${nextVal ? 'Enable' : 'Disable'} Low-Spec / Performance Mode`
        };
    }
    const scaleMatch = norm.match(/\b(?:set|change)\s+ui\s+scale\s+(?:to\s+)?([+-]?\d+)\b/i);
    if (scaleMatch) {
        const stepVal = Math.max(-5, Math.min(5, parseInt(scaleMatch[1], 10)));
        return {
            type: 'set_ui_scale',
            scale: stepVal,
            summary: `Set UI Scale to ${100 + stepVal * 5}% (step ${stepVal})`
        };
    }
    if (/\b(?:mute\s+sound|disable\s+sound|sound\s+off)\b/i.test(norm)) {
        return { type: 'set_sound_enabled', enabled: false, summary: 'Mute timer & alert sound effects' };
    }
    if (/\b(?:enable\s+sound|unmute\s+sound|sound\s+on)\b/i.test(norm)) {
        return { type: 'set_sound_enabled', enabled: true, summary: 'Enable timer & alert sound effects' };
    }
    if (/\b(?:disable\s+notifications?|notifications?\s+off|mute\s+notifications?)\b/i.test(norm)) {
        return { type: 'set_notifications_enabled', enabled: false, summary: 'Disable notifications' };
    }
    if (/\b(?:enable\s+notifications?|notifications?\s+on)\b/i.test(norm)) {
        return { type: 'set_notifications_enabled', enabled: true, summary: 'Enable notifications' };
    }
    if (/\b(?:hide\s+streak|disable\s+streak)\b/i.test(norm)) {
        return { type: 'set_streak_visibility', visible: false, summary: 'Hide the top-bar Streak counter badge' };
    }
    if (/\b(?:show\s+streak|enable\s+streak)\b/i.test(norm)) {
        return { type: 'set_streak_visibility', visible: true, summary: 'Show the top-bar Streak counter badge' };
    }
    const profileNameMatch = norm.match(/\b(?:change|set|update)\s+(?:my\s+)?(?:profile\s+|user\s+)?name\s+to\s+(.+)$/i) ||
                             norm.match(/\bcall\s+me\s+([A-Za-z0-9_ -]{2,25})$/i);
    if (profileNameMatch) {
        const newUser = profileNameMatch[1].trim();
        return {
            type: 'set_profile_name',
            name: newUser,
            summary: `Change your profile display name to "${newUser}"`
        };
    }
    if (/\b(?:save|add|copy)\s+(?:this|that|it|answer|solution)\s+(?:to|into|in)\s+(?:my\s+)?notes?\b/i.test(norm) && aiConversationMemory.lastAnswerText) {
        return {
            type: 'append_study_notes',
            noteText: aiConversationMemory.lastAnswerText.replace(/\*\*/g, ''),
            summary: 'Save the last AI response into Quick Study Notes'
        };
    }

    // 14. Natural Language Intent Analyzer (analyzes what the user wants to do in the system from conversational sentences)
    if (/\b(?:remind\s+me\s+to|i\s+need\s+to\s+submit|i\s+have\s+to\s+finish|add\s+to\s+my\s+to\s*do)\s+(.+)$/i.test(norm)) {
        const m = norm.match(/\b(?:remind\s+me\s+to|i\s+need\s+to\s+submit|i\s+have\s+to\s+finish|add\s+to\s+my\s+to\s*do)\s+(.+)$/i);
        if (m && m[1].trim()) {
            const taskTitle = m[1].trim();
            return {
                type: 'add_task',
                title: taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1),
                summary: `Add new task "${taskTitle}" to Smart Task Tracker`
            };
        }
    }
    if (/\b(?:too\s+bright|my\s+eyes\s+hurt|make\s+it\s+dark)\b/i.test(norm)) {
        return { type: 'surface_mode', mode: 'dark', summary: 'Switch application surface to Dark Mode' };
    }
    if (/\b(?:make\s+text\s+bigger|font\s+too\s+small|zoom\s+in)\b/i.test(norm)) {
        const nextScale = Math.min(5, (window.appState.uiScale || 0) + 2);
        return { type: 'set_ui_scale', scale: nextScale, summary: `Increase UI Scale to ${100 + nextScale * 5}%` };
    }

    return null;
}

// Check if the user is starting an interactive multi-step flow (Multi-Item Add, Assignments, Courses, Themes, Habits, Settings)
function startInteractiveAiFlowIfMatched(prompt) {
    const clean = prompt.trim();
    const norm = normalizeAiCommandText(clean).toLowerCase();

    // 0A. Quantified Multi-Item Creation Flow ("Add a new two habits", "add 2 habits", "add 3 tasks", "add two courses")
    const reqCount = extractRequestedItemCount(norm);
    if (reqCount && reqCount >= 1) {
        let entityType = null;
        if (/\bhabits?\b/i.test(norm)) entityType = 'habit';
        else if (/\btasks?\b/i.test(norm)) entityType = 'task';
        else if (/\bcourses?\b/i.test(norm)) entityType = 'course';

        if (entityType && reqCount >= 2) {
            activeAiFlow = {
                step: 'collect_multiple_items',
                entityType,
                targetCount: reqCount,
                collected: []
            };
            const typePlural = entityType === 'habit' ? 'habits' : (entityType === 'task' ? 'tasks' : 'courses');
            const exampleStr = entityType === 'habit'
                ? `\`Morning Run, Read 20 Pages\``
                : (entityType === 'task' ? `\`Physics Lab, Read Ch 4\`` : `\`Biology, Chemistry\``);

            appendAiChatBubble(
                `🔥 **Add ${reqCount} New ${typePlural.charAt(0).toUpperCase() + typePlural.slice(1)}:**\n` +
                `Which **${reqCount} ${typePlural}** do you need? You can:\n` +
                `• **Click ${reqCount} options** in the selector tray below\n` +
                `• **Type them separated by a comma** (e.g. ${exampleStr})\n` +
                `• Or **type them one by one** and I'll follow up for each!`,
                false,
                'multi_item_flow'
            );
            renderAiFlowPopup();
            return true;
        }
    }

    // 0B. Assignment & Homework Help Flow ("Hello me with my assignment", "help me with my assignment", "I need answers")
    const isAssignmentRequest = /\b(?:assignment|assignments|homework|lab\s+report|problem\s+set)\b/i.test(norm) ||
        /\bhelp\s+me\s+with\s+(?:my\s+)?(?:study|studies|work|task|tasks|course|courses)\b/i.test(norm) ||
        (/^(?:i\s+need\s+answers?|give\s+(?:me\s+)?answers?|need\s+answers?|solve\s+it|solve\s+my\s+tasks?)$/i.test(norm));

    if (isAssignmentRequest) {
        const pendingTasks = ((window.appState && window.appState.tasks) || []).filter(t => !t.completed);

        // If user said "I need answers" right after asking for assignment help, or asked to solve all, deliver the answers immediately!
        if (/^(?:i\s+need\s+answers?|give\s+(?:me\s+)?answers?|need\s+answers?|solve\s+all)$/i.test(norm)) {
            if (pendingTasks.length > 0) {
                const solutions = pendingTasks.slice(0, 3).map(t => buildAssignmentSolutionText(t)).join('\n\n');
                activeAiFlow = { step: 'post_assignment_actions', taskId: pendingTasks[0].id };
                appendAiChatBubble(solutions, false, 'study_answer');
                renderAiFlowPopup();
                return true;
            }
        }

        // Check if user mentioned a specific assignment/subject in the message (e.g. "help me with my physics assignment")
        const specificTask = findTaskFromText(norm);
        if (specificTask && !/^(?:hello|help)\s+me\s+with\s+(?:my\s+)?assignments?$/i.test(norm)) {
            const ans = buildAssignmentSolutionText(specificTask);
            activeAiFlow = { step: 'post_assignment_actions', taskId: specificTask.id };
            appendAiChatBubble(ans, false, 'study_answer');
            renderAiFlowPopup();
            return true;
        }

        // Otherwise show their active assignments from the workspace and ask which one they want solved!
        activeAiFlow = { step: 'select_assignment' };
        if (pendingTasks.length > 0) {
            const taskLines = pendingTasks.slice(0, 5).map((t, idx) => `${idx + 1}. **[${t.course || 'Task'}] ${t.title}**`).join('\n');
            appendAiChatBubble(
                `📚 **Assignment & Homework Solver:**\n` +
                `I analyzed your workspace and found **${pendingTasks.length} active assignment(s)**:\n${taskLines}\n\n` +
                `Which assignment do you need answers for? **Click one below**, type \`all\` (or \`I need answers\`) to solve all of them, or type your specific assignment question!`,
                false,
                'assignment_help'
            );
        } else {
            appendAiChatBubble(
                `📚 **Assignment & Homework Solver:**\n` +
                `Paste or type your assignment question or topic below, and I will give you a direct, step-by-step answer!`,
                false,
                'assignment_help'
            );
        }
        renderAiFlowPopup();
        return true;
    }

    // 1. Interactive Course Editor ("edit my courses", "change my courses", "manage courses", "courses")
    if (/\b(?:edit|change|manage|update|customize|modify|show|list|my)\s+(?:my\s+|available\s+)?courses?\b/.test(norm) ||
        norm === 'courses' || norm === 'course' || norm === 'edit course' || norm === 'change course') {
        const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
        const withoutKeywords = norm.replace(/\b(?:edit|change|manage|update|my|available|courses?)\b/g, '').trim();
        const specificCourse = withoutKeywords ? findCourseFromText(withoutKeywords) : null;

        if (specificCourse) {
            activeAiFlow = { step: 'select_course_edit', courseId: specificCourse.id, courseName: specificCourse.name };
            const code = (specificCourse.code || specificCourse.name.slice(0, 2)).slice(0, 2).toUpperCase();
            appendAiChatBubble(
                `✏️ Selected **[${code}] ${specificCourse.name}** (colour: **${getColorLabelByHex(specificCourse.color)}**).\n` +
                `Which edit do you need? Pick an option below or type \`change colour to violet\`, \`change letters to PY\`, or \`change name to ...\``,
                false,
                'course_flow'
            );
            renderAiFlowPopup();
            return true;
        }

        activeAiFlow = { step: 'select_course' };
        const listLines = courses.map((c, idx) => {
            const code = (c.code || c.name.slice(0, 2)).slice(0, 2).toUpperCase();
            return `${idx + 1}. **${c.name}** — Badge: \`[${code}]\` • Colour: **${getColorLabelByHex(c.color)}**`;
        }).join('\n');

        appendAiChatBubble(
            `🎓 **Available Courses (${courses.length}):**\n${listLines || 'No courses yet.'}\n\n` +
            `Which course would you like to edit? **Click a course below** or type its name, then tell me what to change (colour, 2-letter code, or name)!`,
            false,
            'course_flow'
        );
        renderAiFlowPopup();
        return true;
    }

    // 2. Interactive Habit Creator ("adddd habit", "add habit", or "add basic habits" when all 5 core habits already exist)
    if (/^(?:add|create|new|make)\s+(?:a\s+|new\s+)?habits?$/i.test(norm) ||
        /\b(?:add|create)\s+(?:a\s+|new\s+|basic\s+|starter\s+)?habits?\b/i.test(norm)) {
        activeAiFlow = { step: 'select_habit' };
        const existingNames = new Set(((window.appState && window.appState.habits) || []).map(h => h.name.toLowerCase()));
        const missingBasic = BASIC_HABITS_PRESETS.filter(p => !existingNames.has(p.name.toLowerCase()));

        if (/\bbasic\b/i.test(norm) && missingBasic.length === 0) {
            appendAiChatBubble(
                `🔥 All **5 Core Basic Habits** are already in your Habit Flow Tracker!\n` +
                `Would you like to add **5 Extra Starter Habits** (Healthy Meal, Walk/Run, Coding, 8h Sleep, Digital Detox), pick individual habits from the popup below, or type a custom habit name?`,
                false,
                'habit_flow'
            );
        } else {
            appendAiChatBubble(
                `🔥 **Add Habits to Habit Flow:**\n` +
                `Which habit would you like to add? Pick any preset in the popup below, type a single habit name, or type \`add 2 habits\` to add multiple at once!`,
                false,
                'habit_flow'
            );
        }
        renderAiFlowPopup();
        return true;
    }

    // 3. Interactive Theme & Colour Picker ("change my theme", "change theme", "themes", "change colour")
    if (/\b(?:change|edit|switch|update|choose|pick|my)\s+(?:my\s+|app\s+|site\s+)?(?:themes?|colors?|accents?|appearance)\b/.test(norm) ||
        norm === 'theme' || norm === 'themes' || norm === 'color' || norm === 'colors') {
        activeAiFlow = { step: 'select_theme' };
        const curTheme = window.appState.solidTheme || 'obsidian';
        const curAccent = getColorLabelByHex(window.appState.accentColor || '#5f5bf6');
        appendAiChatBubble(
            `🎨 **Theme & Colour Studio** (Current: **${curTheme}** • Accent: **${curAccent}**)\n` +
            `Pick a **Solid Theme**, **Surface Mode** (\`Dark Mode\`, \`White Mode\`, \`Liquid Glass\`), or **Accent Colour** from the popup below — or type your choice!`,
            false,
            'theme_flow'
        );
        renderAiFlowPopup();
        return true;
    }

    // 4. Interactive Settings Controller ("change settings", "edit settings", "my settings", "settings")
    if (/\b(?:change|edit|update|manage|modify|adjust|my)\s+(?:my\s+|app\s+|site\s+)?settings?\b/.test(norm) ||
        norm === 'settings' || norm === 'setting') {
        activeAiFlow = { step: 'select_setting' };
        appendAiChatBubble(
            `⚙️ **FocusPulse Settings Control:**\n` +
            `Click any quick setting in the popup below, or type a command:\n` +
            `• **Timer:** \`set pomodoro to 45 mins\` • \`Classic\` • \`Extended\` • \`Blitz\`\n` +
            `• **Hydration:** \`set water goal to 3000ml\` • \`set glass size to 300ml\`\n` +
            `• **System:** \`enable performance mode\` • \`enable liquid glass\` • \`mute sound\` • \`change my name to ...\``,
            false,
            'setting_flow'
        );
        renderAiFlowPopup();
        return true;
    }

    return false;
}

async function handleAiChatSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('ai-chat-input');
    const prompt = (input ? input.value : '').trim();
    if (!prompt) return;
    input.value = '';

    const norm = normalizeAiCommandText(prompt).toLowerCase();

    // 1. If a confirmation popup is waiting above the typefield, allow typing "yes"/"apply" or "no"/"cancel"
    if (pendingAiAction) {
        if (/^(?:yes|y|apply|confirm|ok|sure|do\s+it)$/i.test(norm)) {
            appendUserChatBubble(prompt);
            confirmAiAction();
            return;
        }
        if (/^(?:no|n|cancel|stop|nevermind|nope)$/i.test(norm)) {
            appendUserChatBubble(prompt);
            cancelAiAction();
            return;
        }
        pendingAiAction = null;
        hideAiInlinePopupTray();
    }

    // 2. If a multi-step interactive flow is active, process the step input
    if (activeAiFlow) {
        appendUserChatBubble(prompt);
        const handledByFlow = processActiveAiFlowInput(prompt);
        if (handledByFlow) return;
        // Note: user bubble was already appended above, so pass a flag to avoid double user bubble below
        await executeAiChatCallAfterUserBubble(prompt);
        return;
    }

    // 3. Check one-shot action commands & natural language system intents (Always asks for Apply Yes/No confirmation above the typefield!)
    const actionCmd = parseAiActionCommand(prompt);
    if (actionCmd) {
        appendUserChatBubble(prompt);
        stageAiPendingAction(
            actionCmd,
            `⚡ Ready to apply: **${actionCmd.summary}**. Click **Apply (Yes)** or **No** below.`
        );
        return;
    }

    // 4. Check interactive multi-step flows (Multi-item habits/tasks/courses, Assignments, Courses, Habits, Themes, Settings)
    if (startInteractiveAiFlowIfMatched(prompt)) {
        const history = document.getElementById('ai-chat-history');
        if (history && history.children.length >= 1) {
            const lastAi = history.lastElementChild;
            const userDiv = document.createElement('div');
            userDiv.className = 'flex justify-end';
            userDiv.innerHTML = `<div class="v-accent-btn bg-indigo-600 text-white p-2.5 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm font-medium">${escapeHtml(prompt)}</div>`;
            history.insertBefore(userDiv, lastAi);
            history.scrollTop = history.scrollHeight;
            recordConversationTurn('user', prompt);
        }
        return;
    }

    // 5. Standard factual question, study help, or context-aware follow-up
    await executeAiChatCall(prompt);
}

async function executeAiChatCallAfterUserBubble(promptText) {
    // Re-check one-shot commands and interactive flows if an earlier flow exited onto a new command
    const actionCmd = parseAiActionCommand(promptText);
    if (actionCmd) {
        stageAiPendingAction(
            actionCmd,
            `⚡ Ready to apply: **${actionCmd.summary}**. Click **Apply (Yes)** or **No** below.`
        );
        return;
    }
    if (startInteractiveAiFlowIfMatched(promptText)) {
        return;
    }
    await runCoreAiAnswerPipeline(promptText);
}

// Normalize typos in user queries for reliable offline factual matching
function normalizeQueryText(raw) {
    return String(raw || '')
        .toLowerCase()
        .replace(/prime\s*m(?:i|in|ni)st(?:e|a)?r/g, 'prime minister')
        .replace(/\bpm\b/g, 'prime minister')
        .replace(/pres(?:i|e)d(?:e|a)nt/g, 'president')
        .replace(/cap(?:i|a)t(?:a|o)l/g, 'capital')
        .replace(/[^a-z0-9+\-*/().^%\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Instant offline factual knowledge lookup (returns a short, exact answer or null if not matched)
function lookupInstantFactAnswer(promptText) {
    const clean = promptText.trim();
    const norm = normalizeQueryText(clean);

    // 1. Safe Math & Arithmetic Expressions (e.g. "25 * 4", "what is 144 / 12", "2^10")
    const mathCandidate = clean
        .replace(/^(?:what\s+is|calculate|solve|compute|evaluate)\s+/i, '')
        .replace(/[?=]+$/g, '')
        .trim();
    if (/^[0-9+\-*/().\s^%]+$/.test(mathCandidate) && /[0-9]/.test(mathCandidate) && /[+\-*/^%]/.test(mathCandidate)) {
        try {
            const safeExpr = mathCandidate.replace(/\^/g, '**');
            const result = Function('"use strict"; return (' + safeExpr + ')')();
            if (typeof result === 'number' && isFinite(result)) {
                return `**${mathCandidate} = ${Number(result.toFixed(6))}**`;
            }
        } catch (e) {}
    }

    // 2. Current Date / Time / Day queries
    if (/^(?:what\s+time\s+is\s+it|current\s+time|time\s+now)$/.test(norm)) {
        return `It is currently **${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}**.`;
    }
    if (/^(?:what\s+(?:is\s+)?(?:today\s*s?\s+)?date|current\s+date|what\s+day\s+is\s+(?:it|today))$/.test(norm)) {
        return `Today is **${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}**.`;
    }

    // 3. World Leaders & Government Systems (including misconceptions like "Prime Minister of America")
    const hasPM = norm.includes('prime minister');
    const hasPres = norm.includes('president');
    const isUSA = /\b(?:america|usa|u s a|u s|united states|us)\b/.test(norm);

    if (isUSA && hasPM) {
        return `The United States does **not** have a Prime Minister — it is a presidential republic led by a **President**. The current President of the United States is **Donald Trump**.`;
    }
    if (isUSA && hasPres) {
        return `The current President of the United States is **Donald Trump** (47th U.S. President).`;
    }
    if (/\b(?:india)\b/.test(norm) && hasPM) {
        return `The Prime Minister of India is **Narendra Modi** (serving since May 2014).`;
    }
    if (/\b(?:india)\b/.test(norm) && hasPres) {
        return `The President of India is **Droupadi Murmu** (15th President of India).`;
    }
    if (/\b(?:uk|united kingdom|britain|great britain|england)\b/.test(norm) && hasPM) {
        return `The Prime Minister of the United Kingdom is **Keir Starmer**.`;
    }
    if (/\b(?:uk|united kingdom|britain|great britain|england)\b/.test(norm) && hasPres) {
        return `The United Kingdom does **not** have a President — it is a constitutional monarchy with **King Charles III** as head of state and **Keir Starmer** as Prime Minister.`;
    }
    if (/\b(?:canada)\b/.test(norm) && hasPM) {
        return `The Prime Minister of Canada is **Mark Carney**.`;
    }
    if (/\b(?:australia)\b/.test(norm) && hasPM) {
        return `The Prime Minister of Australia is **Anthony Albanese**.`;
    }
    if (/\b(?:france)\b/.test(norm) && hasPres) {
        return `The President of France is **Emmanuel Macron**.`;
    }
    if (/\b(?:russia)\b/.test(norm) && hasPres) {
        return `The President of Russia is **Vladimir Putin**.`;
    }
    if (/\b(?:china)\b/.test(norm) && hasPres) {
        return `The President of China is **Xi Jinping**.`;
    }
    if (/\b(?:ukraine)\b/.test(norm) && hasPres) {
        return `The President of Ukraine is **Volodymyr Zelenskyy**.`;
    }
    if (/\b(?:kerala)\b/.test(norm) && /\b(?:chief minister|cm)\b/.test(norm)) {
        return `The Chief Minister of Kerala is **Pinarayi Vijayan**.`;
    }

    // 4. World Capitals
    const capitals = {
        'india': 'New Delhi',
        'usa': 'Washington, D.C.',
        'united states': 'Washington, D.C.',
        'america': 'Washington, D.C.',
        'uk': 'London',
        'united kingdom': 'London',
        'england': 'London',
        'france': 'Paris',
        'germany': 'Berlin',
        'japan': 'Tokyo',
        'china': 'Beijing',
        'russia': 'Moscow',
        'canada': 'Ottawa',
        'australia': 'Canberra',
        'italy': 'Rome',
        'spain': 'Madrid',
        'brazil': 'Brasília',
        'south korea': 'Seoul',
        'uae': 'Abu Dhabi',
        'saudi arabia': 'Riyadh',
        'kerala': 'Thiruvananthapuram'
    };
    if (norm.includes('capital of')) {
        for (const [place, cap] of Object.entries(capitals)) {
            if (norm.includes(place)) {
                const label = place.length <= 3 ? place.toUpperCase() : place.replace(/\b\w/g, c => c.toUpperCase());
                return `The capital of ${label} is **${cap}**.`;
            }
        }
    }

    // 5. Core Science, Math & Computer Science Quick Facts
    const quickFacts = [
        { match: /\bphotosynthesis\b/, ans: `**Photosynthesis** is the process by which green plants use sunlight, water (H₂O), and carbon dioxide (CO₂) to produce glucose (C₆H₁₂O₆) and oxygen (O₂).` },
        { match: /\bmitochondria\b/, ans: `**Mitochondria** are the powerhouses of the cell, generating most of the cell's **ATP** (chemical energy) through cellular respiration.` },
        { match: /\bnewton.*second law\b|\bf\s*=\s*m\s*a\b/, ans: `**Newton's Second Law** states that force equals mass times acceleration (**F = m·a**).` },
        { match: /\bnewton.*first law\b|\blaw of inertia\b/, ans: `**Newton's First Law (Inertia)** states that an object remains at rest or in uniform motion unless acted upon by an external net force.` },
        { match: /\bnewton.*third law\b/, ans: `**Newton's Third Law** states that for every action, there is an equal and opposite reaction.` },
        { match: /\bohm.*law\b/, ans: `**Ohm's Law** states that voltage equals current times resistance (**V = I × R**).` },
        { match: /\bsnell.*law\b|\brefraction\b/, ans: `**Snell's Law** states that **n₁ sin(θ₁) = n₂ sin(θ₂)**, relating the angles of incidence and refraction to the refractive indices of two media.` },
        { match: /\bpythagor(?:ean|as)\b/, ans: `The **Pythagorean Theorem** states that in a right triangle, **a² + b² = c²**, where c is the hypotenuse.` },
        { match: /\bquadratic formula\b/, ans: `The **Quadratic Formula** for ax² + bx + c = 0 is **x = (−b ± √(b² − 4ac)) / 2a**.` },
        { match: /\bintegration by parts\b/, ans: `**Integration by Parts** uses the formula **∫ u dv = u·v − ∫ v du** (choose u via the **LIATE** priority rule).` },
        { match: /\bspeed of light\b/, ans: `The speed of light in a vacuum (c) is approximately **299,792,458 m/s** (~3 × 10⁸ m/s).` },
        { match: /\bbinary search\b/, ans: `**Binary Search** finds a target in a sorted array by repeatedly halving the search interval, running in **O(log n)** time.` },
        { match: /\bred black tree\b/, ans: `A **Red-Black Tree** is a self-balancing binary search tree that guarantees **O(log n)** search, insertion, and deletion using node color invariants.` },
        { match: /\bavl tree\b/, ans: `An **AVL Tree** is a self-balancing binary search tree where the heights of left and right subtrees of any node differ by at most **1** (**O(log n)** operations).` },
        { match: /\brecursion\b/, ans: `**Recursion** is when a function calls itself on a smaller subproblem until reaching a **base case** that stops the calls.` },
        { match: /\bdifference between ram and rom\b/, ans: `**RAM** is fast, volatile working memory cleared when power turns off; **ROM** is non-volatile permanent memory used for firmware/boot instructions.` },
        { match: /\bwho (?:created|made|developed|built) focuspulse\b|\bfoc it\b|\bazmee\b/, ans: `**FocusPulse** is developed by **azmee7 (Azmi)** under **Foc-It** (github.com/foc-it).` }
    ];
    for (const item of quickFacts) {
        if (item.match.test(norm)) {
            return item.ans;
        }
    }

    return null;
}

// Built-in FocusPulse study & productivity coach responses (NO unsolicited Pomodoro/Task stat spamming!)
function generateSmartLocalAiResponse(promptText) {
    // 1. Check direct factual answers first
    const directFact = lookupInstantFactAnswer(promptText);
    if (directFact) return directFact;

    const q = normalizeAiCommandText(promptText).toLowerCase();
    const state = window.appState;
    const userName = (state.user && state.user.name) ? state.user.name.split(' ')[0] : 'Scholar';
    const subjects = (state.user && state.user.subjects) ? state.user.subjects : 'your courses';
    const pendingTasks = (state.tasks || []).filter(t => !t.completed);
    const completedTasks = (state.tasks || []).filter(t => t.completed);
    const habits = state.habits || [];
    const todayKey = formatDateKey(new Date());
    const habitsDoneToday = habits.filter(h => h.logs && h.logs[todayKey]).length;
    const uncheckedHabitsToday = habits.filter(h => !(h.logs && h.logs[todayKey]));
    const waterPct = Math.min(100, Math.round(((state.waterIntakeMl || 0) / (state.dailyWaterGoalMl || 2500)) * 100));
    const focusMins = Math.round((state.timer.totalFocusSecs || 0) / 60);
    const topTask = pendingTasks.length > 0 ? pendingTasks[0].title : `reviewing ${subjects.split(',')[0]}`;
    const nextHabitName = uncheckedHabitsToday.length > 0 ? uncheckedHabitsToday[0].name : 'all daily habits';

    // 2. Context-aware follow-up check (e.g. if user says "explain more", "give me an example", "what about the second one?")
    if (/^(?:explain\s+more|tell\s+me\s+more|give\s+(?:me\s+)?an?\s+example|elaborate)$/i.test(q) && aiConversationMemory.lastAnswerText) {
        return `📌 **Further Breakdown:**\nTo apply this in practice, focus on writing out one concrete worked example step by step, verifying units/boundary conditions, and summarizing the key takeaway in **Quick Study Notes** (or type \`save to notes\` and I'll add it for you!).`;
    }
    if (/\b(?:second|2nd|next)\s+(?:one|assignment|task)\b/i.test(q) && pendingTasks[1]) {
        return buildAssignmentSolutionText(pendingTasks[1]);
    }
    if (/\b(?:third|3rd|last)\s+(?:one|assignment|task)\b/i.test(q) && pendingTasks[2]) {
        return buildAssignmentSolutionText(pendingTasks[2]);
    }

    // 3. Standalone Greetings ONLY (never matches "hello me with my assignment", and NEVER spams task/Pomodoro stats!)
    const isStandaloneGreeting = /^(?:hi|hello|hey|yo|sup|howdy|good\s*(?:morning|afternoon|evening)|how\s+are\s+you|what'?s\s+up)[!.?]*$/i.test(q);
    if (isStandaloneGreeting) {
        return `👋 Hi ${userName}! How can I help you today? You can ask me any study/assignment question, or tell me to update your courses, habits, tasks, themes, or settings.`;
    }

    // 4. Daily Planning & Schedules
    if (q.includes('plan my day') || q.includes('schedule') || q.includes('timeblock')) {
        const secondTask = pendingTasks.length > 1 ? pendingTasks[1].title : `active recall on ${subjects}`;
        return `📋 **Today's Study Plan (${userName}):**\n` +
            `• **Block 1 (${state.timerSettings.pomodoro}m):** Complete **"${topTask}"**.\n` +
            `• **Break (${state.timerSettings.short}m):** Drink ${state.glassSizeMl}ml water & check off **"${nextHabitName}"**.\n` +
            `• **Block 2 (${state.timerSettings.pomodoro}m):** Work on **"${secondTask}"**.`;
    }

    // 5. Task Prioritization
    if (q.includes('prioritize') || q === 'tasks' || q === 'my tasks' || q.includes('urgent') || q.includes('backlog')) {
        if (pendingTasks.length === 0) {
            return `🎉 You have **0 pending tasks**! Type \`add task: [Task Title]\` or \`add 2 tasks\` to add new goals.`;
        }
        const sorted = [...pendingTasks].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        const listStr = sorted.slice(0, 4).map((t, idx) => `${idx + 1}. **[${t.course || 'Task'}] ${t.title}** (Due ${t.dueDate})`).join('\n');
        return `⚡ **Priority Task Queue (${pendingTasks.length} Pending):**\n${listStr}\n\nWant me to solve any of these? Type \`help me with my assignment\`!`;
    }

    // 6. Procrastination / Stuck
    if (q.includes('procrastinat') || q.includes('lazy') || q.includes('stuck') || q.includes('unmotivated')) {
        return `🚀 **2-Minute Reset:** Commit to working on **"${topTask}"** for just **2 minutes**. Starting breaks the friction immediately — or type \`help me with ${topTask}\` and we'll solve the first part together!`;
    }

    // 7. Burnout / Stress / Tired
    if (q.includes('overwhelm') || q.includes('stress') || q.includes('tired') || q.includes('burnout')) {
        return `🌿 **Energy Reset:** Drink a glass of water, step away from screens for 5 minutes, and focus on just one small step when you're ready.`;
    }

    // 8. Exam Strategy
    if (q.includes('exam') || q.includes('revision') || q.includes('active recall') || q.includes('spaced repetition')) {
        return `🧠 **Exam Strategy:** Spend 60% of your session solving practice problems without looking at notes, log mistakes in **Quick Study Notes**, and review at **Day 1 → Day 3 → Day 7**.`;
    }

    // 9. Habit Tips / Status (only when explicitly asking for habit tips or status)
    if (q === 'habit tips' || q === 'habit status' || q === 'my habits' || q.includes('streak')) {
        return `🔥 **Habit Status:** ${habitsDoneToday}/${habits.length} completed today (${state.streakCount}-day streak). Next up: **"${nextHabitName}"** — or type \`add 2 habits\` to add new habits!`;
    }

    // 10. Progress Report & Stats (ONLY shown when user explicitly asks for stats/progress/report!)
    if (q.includes('stats') || q.includes('progress') || q.includes('report') || q.includes('summary')) {
        const totalTasks = pendingTasks.length + completedTasks.length;
        const taskPct = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 100;
        const habitPct = habits.length > 0 ? Math.round((habitsDoneToday / habits.length) * 100) : 0;
        return `📊 **Your Progress Today:**\n` +
            `• **Focus Logged:** ${focusMins}m (${state.streakCount}d streak 🔥)\n` +
            `• **Tasks:** ${completedTasks.length}/${totalTasks} done (${taskPct}%)\n` +
            `• **Habits:** ${habitsDoneToday}/${habits.length} done (${habitPct}%)\n` +
            `• **Water:** ${state.waterIntakeMl}/${state.dailyWaterGoalMl}ml (${waterPct}%)`;
    }

    // 11. Help / Commands
    if (q === 'help' || q.includes('ai commands') || q.includes('what can you do')) {
        return `🛠️ **Zenith AI Site Controls & Study Assistant:**\n` +
            `• **Assignments & Q&A:** \`help me with my assignment\` • \`I need answers\` • or ask any question!\n` +
            `• **Habits (Single or Multi):** \`add basic habits\` • \`add 2 habits\` • \`add habit: Morning Run\`\n` +
            `• **Courses:** \`edit my courses\` • \`add 2 courses\` • \`change CS101 colour to violet\`\n` +
            `• **Themes & Settings:** \`change my theme\` • \`change settings\` • \`cyberpunk\` • \`white mode\``;
    }

    return null;
}

// Fetch a short, accurate, context-aware answer from live cloud AI or Wikipedia when online
async function fetchShortAccurateOnlineAnswer(promptText, geminiKey) {
    const recentHistory = aiConversationMemory.messages
        .slice(-4)
        .map(m => `${m.role === 'user' ? 'User' : 'Zenith AI'}: ${m.text}`)
        .join('\n');
    const pendingTaskNames = ((window.appState && window.appState.tasks) || [])
        .filter(t => !t.completed)
        .map(t => `${t.title} (${t.course || 'General'})`)
        .join('; ');

    const sysInstruction = `You are Zenith AI inside FocusPulse. Answer the user's question directly, accurately, and concisely (1 to 3 sentences). Do NOT spam Pomodoro timers or task counts unless asked. Active user assignments: ${pendingTaskNames || 'None'}. Recent chat context:\n${recentHistory}`;

    // 1. Try Google Gemini API if a valid AIza... key is configured
    if (/^AIza[0-9A-Za-z_-]{25,}$/.test(geminiKey)) {
        const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        for (const modelName of models) {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: `${sysInstruction}\n\nUser: ${promptText}` }] }]
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (text.trim()) return text.trim();
                }
            } catch (e) {}
        }
    }

    // 2. Try Free Keyless Cloud AI endpoint (Pollinations OpenAI-compatible API) with conversation history
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5500);
        const res = await fetch('https://text.pollinations.ai/openai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ctrl.signal,
            body: JSON.stringify({
                model: 'openai',
                messages: [
                    { role: 'system', content: sysInstruction },
                    ...aiConversationMemory.messages.slice(-4).map(m => ({
                        role: m.role === 'user' ? 'user' : 'assistant',
                        content: m.text
                    })),
                    { role: 'user', content: promptText }
                ],
                temperature: 0.2
            })
        });
        clearTimeout(timer);
        if (res.ok) {
            const data = await res.json();
            const msg = data?.choices?.[0]?.message?.content || '';
            if (msg && msg.trim().length > 2) {
                return msg.trim();
            }
        }
    } catch (e) {}

    // 3. Try Wikipedia OpenSearch + Summary API ONLY for genuine factual/encyclopedia queries
    // Never send conversational, first-person, or app-control phrases ("I need answers", "help me", "add a new two habits") to Wikipedia!
    const normCheck = normalizeAiCommandText(promptText).toLowerCase();
    const isConversationalOrAppPhrase = /\b(?:i\s+need|help\s+me|hello\s+me|can\s+you|could\s+you|please|my|our|site|app|edit|change|add|create|make|delete|remove|update|switch|course|theme|habit|task|assignment|homework|answer|answers|setting|color|timer|pomodoro|water|streak)\b/.test(normCheck);

    if (!isConversationalOrAppPhrase) {
        try {
            const cleanQuery = promptText
                .replace(/^(?:who\s+is|what\s+is|what\s+are|where\s+is|when\s+was|tell\s+me\s+about|define|explain)\s+(?:the\s+|a\s+|an\s+)?/i, '')
                .replace(/[?!.]+$/g, '')
                .trim();
            if (cleanQuery.length >= 2) {
                const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&utf8=&format=json&origin=*&srlimit=1`;
                const sRes = await fetch(searchUrl);
                if (sRes.ok) {
                    const sData = await sRes.json();
                    const topTitle = sData?.query?.search?.[0]?.title;
                    if (topTitle) {
                        const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`;
                        const sumRes = await fetch(sumUrl);
                        if (sumRes.ok) {
                            const sumData = await sumRes.json();
                            if (sumData && sumData.extract && sumData.type !== 'disambiguation' && !/may refer to:/i.test(sumData.extract)) {
                                const sentences = sumData.extract.match(/[^.!?]+[.!?]+/g) || [sumData.extract];
                                return sentences.slice(0, 2).join(' ').trim();
                            }
                        }
                    }
                }
            }
        } catch (e) {}
    }

    return null;
}

async function runCoreAiAnswerPipeline(promptText) {
    // 1. Check built-in instant facts, assignment solver, & context-aware intents first (0ms latency)
    let replyText = generateSmartLocalAiResponse(promptText);

    // 2. If not a built-in coaching command or cached fact, fetch a short, accurate answer online
    if (!replyText) {
        const history = document.getElementById('ai-chat-history');
        const loadingId = 'ai-loading-' + Date.now();
        if (history) {
            history.innerHTML += `
                <div id="${loadingId}" class="flex gap-2">
                    <div class="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5" style="color:var(--v-accent)">
                        <i class="fa-solid fa-robot text-[10px]"></i>
                    </div>
                    <div class="bg-white/70 dark:bg-white/10 border border-white/60 dark:border-white/10 p-2.5 rounded-2xl rounded-tl-none text-slate-600 dark:text-slate-300 text-[11px] font-semibold">Thinking...</div>
                </div>
            `;
            history.scrollTop = history.scrollHeight;
        }

        const rawKey = (
            (window.appState && window.appState.geminiApiKey) ||
            (window.FP_PRIVATE_CONFIG && window.FP_PRIVATE_CONFIG.geminiApiKey) ||
            ''
        ).trim();

        replyText = await fetchShortAccurateOnlineAnswer(promptText, rawKey);

        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
    }

    // 3. Context-aware fallback if offline
    if (!replyText) {
        const matchedTask = findTaskFromText(promptText);
        if (matchedTask) {
            replyText = buildAssignmentSolutionText(matchedTask);
            activeAiFlow = { step: 'post_assignment_actions', taskId: matchedTask.id };
            appendAiChatBubble(replyText, false, 'study_answer');
            renderAiFlowPopup();
            return;
        }
        replyText = `I can help solve your assignments, answer questions, or update your workspace! Try \`help me with my assignment\`, \`add 2 habits\`, \`edit my courses\`, \`change my theme\`, or \`change settings\`.`;
    }

    appendAiChatBubble(replyText, false, 'general_qa');
}

async function executeAiChatCall(promptText) {
    appendUserChatBubble(promptText);
    await runCoreAiAnswerPipeline(promptText);
}

function confirmAiAction() {
    hideAiInlinePopupTray();
    if (!pendingAiAction) return;

    const act = pendingAiAction;
    pendingAiAction = null;
    activeAiFlow = null;

    let confirmMsg = 'Action executed!';
    try {
        if (act.type === 'add_basic_habits') {
            if (!Array.isArray(window.appState.habits)) window.appState.habits = [];
            let addedCount = 0;
            BASIC_HABITS_PRESETS.forEach((preset, idx) => {
                const exists = window.appState.habits.some(h => h.name.toLowerCase() === preset.name.toLowerCase());
                if (!exists) {
                    window.appState.habits.push({
                        id: 'h-basic-' + Date.now() + '-' + idx,
                        name: preset.name,
                        category: preset.category,
                        color: preset.color,
                        icon: preset.icon,
                        targetPerWeek: preset.targetPerWeek,
                        logs: {}
                    });
                    addedCount++;
                }
            });
            if (addedCount === 0) {
                window.appState.habits = generateSampleHabits();
                confirmMsg = `✅ All 5 Core Basic Habits were refreshed in your Habit Flow Tracker!`;
            } else {
                confirmMsg = `✅ Added ${addedCount} Basic Habit${addedCount > 1 ? 's' : ''} to your Habit Flow Tracker!`;
            }
            if (typeof renderHabitsSection === 'function') renderHabitsSection();
        } else if (act.type === 'add_multiple_habits') {
            if (!Array.isArray(window.appState.habits)) window.appState.habits = [];
            const items = Array.isArray(act.items) ? act.items : [];
            const addedNames = [];
            items.forEach((item, idx) => {
                const name = (item.name || '').trim();
                if (!name) return;
                window.appState.habits.unshift({
                    id: 'h-multi-' + Date.now() + '-' + idx,
                    name,
                    category: item.category || 'Productivity',
                    color: item.color || 'violet',
                    icon: item.icon || '⚡',
                    targetPerWeek: item.targetPerWeek || 5,
                    logs: {}
                });
                addedNames.push(`"${name}"`);
            });
            if (typeof renderHabitsSection === 'function') renderHabitsSection();
            confirmMsg = `✅ Added ${addedNames.length} habit${addedNames.length > 1 ? 's' : ''} (${addedNames.join(', ')}) to your Habit Flow Tracker!`;
        } else if (act.type === 'add_multiple_tasks') {
            if (!Array.isArray(window.appState.tasks)) window.appState.tasks = [];
            const items = Array.isArray(act.items) ? act.items : [];
            const defaultCourse = (window.appState.courses && window.appState.courses[0]) ? window.appState.courses[0].name : 'CS101';
            const addedNames = [];
            items.forEach((item, idx) => {
                const title = (item.title || item.name || '').trim();
                if (!title) return;
                window.appState.tasks.unshift({
                    id: 't-multi-' + Date.now() + '-' + idx,
                    title,
                    category: 'Studies',
                    subcategory: 'General',
                    course: item.course || defaultCourse,
                    dueDate: formatDateKey(new Date()),
                    description: 'Added by Zenith AI Coach',
                    completed: false,
                    completedAt: null
                });
                addedNames.push(`"${title}"`);
            });
            confirmMsg = `✅ Added ${addedNames.length} task${addedNames.length > 1 ? 's' : ''} (${addedNames.join(', ')}) to your Smart Task Tracker!`;
        } else if (act.type === 'add_multiple_courses') {
            if (!Array.isArray(window.appState.courses)) window.appState.courses = [];
            const items = Array.isArray(act.items) ? act.items : [];
            const addedNames = [];
            items.forEach((item, idx) => {
                const name = (item.name || '').trim();
                if (!name) return;
                const code = (item.code || name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2)).slice(0, 2).toUpperCase() || 'CR';
                window.appState.courses.push({
                    id: 'course-multi-' + Date.now() + '-' + idx,
                    name,
                    code,
                    color: item.color || '#8b5cf6'
                });
                addedNames.push(`"${name}" [${code}]`);
            });
            window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
            if (typeof renderCoursesSettingsManager === 'function') renderCoursesSettingsManager();
            confirmMsg = `🎓 Added ${addedNames.length} course${addedNames.length > 1 ? 's' : ''} (${addedNames.join(', ')}) to your Active Courses!`;
        } else if (act.type === 'append_study_notes') {
            const prevNotes = (window.appState.quickNotes || '').trim();
            const addition = (act.noteText || '').trim();
            window.appState.quickNotes = prevNotes ? `${prevNotes}\n\n${addition}` : addition;
            const notesArea = document.getElementById('quick-notes-area');
            if (notesArea) notesArea.value = window.appState.quickNotes;
            confirmMsg = `📝 Saved solution to your **Quick Study Notes**!`;
        } else if (act.type === 'mark_all_habits') {
            const todayKey = formatDateKey(new Date());
            (window.appState.habits || []).forEach(h => {
                if (!h.logs) h.logs = {};
                h.logs[todayKey] = true;
            });
            if (typeof renderHabitsSection === 'function') renderHabitsSection();
            confirmMsg = `🔥 Marked all ${(window.appState.habits || []).length} daily habits as completed for today!`;
        } else if (act.type === 'add_habit') {
            if (!Array.isArray(window.appState.habits)) window.appState.habits = [];
            window.appState.habits.unshift({
                id: 'h-' + Date.now(),
                name: act.name,
                category: act.category || 'Productivity',
                color: act.color || 'violet',
                icon: act.icon || '⚡',
                targetPerWeek: act.targetPerWeek || 5,
                logs: {}
            });
            if (typeof renderHabitsSection === 'function') renderHabitsSection();
            confirmMsg = `✅ Added habit "${act.name}" to your Habit Flow Tracker!`;
        } else if (act.type === 'check_habit') {
            const qLower = (act.query || '').toLowerCase();
            const match = (window.appState.habits || []).find(h => h.name.toLowerCase().includes(qLower));
            if (match) {
                if (!match.logs) match.logs = {};
                match.logs[formatDateKey(new Date())] = true;
                if (typeof renderHabitsSection === 'function') renderHabitsSection();
                confirmMsg = `🔥 Checked off habit "${match.name}" for today!`;
            } else {
                confirmMsg = `ℹ️ Could not find a habit matching "${act.query}".`;
            }
        } else if (act.type === 'delete_habit') {
            const qLower = (act.query || '').toLowerCase();
            const match = (window.appState.habits || []).find(h => h.name.toLowerCase().includes(qLower));
            if (match) {
                window.appState.habits = window.appState.habits.filter(h => h.id !== match.id);
                if (typeof renderHabitsSection === 'function') renderHabitsSection();
                confirmMsg = `🗑️ Deleted habit "${match.name}".`;
            } else {
                confirmMsg = `ℹ️ Could not find a habit matching "${act.query}".`;
            }
        } else if (act.type === 'add_course') {
            if (!Array.isArray(window.appState.courses)) window.appState.courses = [];
            const code = (act.code || act.name.slice(0, 2)).slice(0, 2).toUpperCase();
            window.appState.courses.push({
                id: 'course-' + Date.now(),
                name: act.name,
                code,
                color: act.color || '#8b5cf6'
            });
            window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
            if (typeof renderCoursesSettingsManager === 'function') renderCoursesSettingsManager();
            confirmMsg = `🎓 Added course "${act.name}" [${code}] to your Active Courses!`;
        } else if (act.type === 'edit_course') {
            const courseObj = (window.appState.courses || []).find(c => c.id === act.courseId);
            if (courseObj) {
                const oldName = courseObj.name;
                if (act.newName) {
                    courseObj.name = act.newName;
                    (window.appState.tasks || []).forEach(t => {
                        if (t.course === oldName) t.course = act.newName;
                    });
                }
                if (act.newCode) {
                    courseObj.code = act.newCode.slice(0, 2).toUpperCase();
                }
                if (act.newColor) {
                    courseObj.color = act.newColor;
                }
                window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
                if (typeof renderCoursesSettingsManager === 'function') renderCoursesSettingsManager();
                const code = (courseObj.code || courseObj.name.slice(0, 2)).slice(0, 2).toUpperCase();
                confirmMsg = `✅ Updated course "${courseObj.name}" [${code}] (${getColorLabelByHex(courseObj.color)})!`;
            }
        } else if (act.type === 'delete_course') {
            const target = (window.appState.courses || []).find(c => c.id === act.courseId);
            if (target) {
                window.appState.courses = window.appState.courses.filter(c => c.id !== act.courseId);
                window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
                if (typeof renderCoursesSettingsManager === 'function') renderCoursesSettingsManager();
                confirmMsg = `🗑️ Removed course "${target.name}" from Active Courses.`;
            }
        } else if (act.type === 'set_solid_theme') {
            if (typeof setSolidTheme === 'function') {
                setSolidTheme(act.themeId);
            } else {
                window.appState.solidTheme = act.themeId;
                applyThemeVariables();
            }
            confirmMsg = `🎨 Switched theme to **${act.themeName || act.themeId}**!`;
        } else if (act.type === 'set_accent_color') {
            if (typeof setAccentColor === 'function') {
                setAccentColor(act.hex);
            } else {
                window.appState.accentColor = act.hex;
                applyThemeVariables();
            }
            confirmMsg = `🎨 Changed accent colour to **${act.label || act.hex}**!`;
        } else if (act.type === 'surface_mode') {
            if (typeof setSurfaceMode === 'function') setSurfaceMode(act.mode);
            confirmMsg = `🎨 Switched surface mode to **${act.mode === 'light' ? 'White Mode' : 'Dark Mode'}**!`;
        } else if (act.type === 'set_liquid_glass') {
            window.appState.liquidEffect = Boolean(act.enabled);
            if (typeof applyLiquidGlass === 'function') applyLiquidGlass(window.appState.liquidEffect);
            confirmMsg = `✨ ${window.appState.liquidEffect ? 'Enabled' : 'Disabled'} **Liquid Glass Mode**!`;
        } else if (act.type === 'add_task') {
            window.appState.tasks.unshift({
                id: Date.now().toString(),
                title: act.title,
                category: 'Studies',
                subcategory: 'General',
                course: (window.appState.courses && window.appState.courses[0]) ? window.appState.courses[0].name : 'CS101',
                dueDate: formatDateKey(new Date()),
                description: 'Added by Zenith AI Coach',
                completed: false,
                completedAt: null
            });
            confirmMsg = `✅ Added task "${act.title}" to your Smart Task Tracker!`;
        } else if (act.type === 'complete_task') {
            const qLower = (act.query || '').toLowerCase();
            const match = (window.appState.tasks || []).find(t => !t.completed && t.title.toLowerCase().includes(qLower)) || findTaskFromText(act.query);
            if (match) {
                match.completed = true;
                match.completedAt = Date.now();
                confirmMsg = `✅ Marked task "${match.title}" as completed!`;
            } else {
                confirmMsg = `ℹ️ Could not find a pending task matching "${act.query}".`;
            }
        } else if (act.type === 'delete_task') {
            const qLower = (act.query || '').toLowerCase();
            const match = (window.appState.tasks || []).find(t => t.title.toLowerCase().includes(qLower));
            if (match) {
                window.appState.tasks = window.appState.tasks.filter(t => t.id !== match.id);
                confirmMsg = `🗑️ Deleted task "${match.title}".`;
            } else {
                confirmMsg = `ℹ️ Could not find a task matching "${act.query}".`;
            }
        } else if (act.type === 'add_plan') {
            window.appState.schedules.push({
                id: Date.now().toString(),
                presetName: act.presetName,
                hours: act.hours || 4,
                sessions: act.sessions || 4,
                days: 'Mon, Tue, Wed, Thu, Fri'
            });
            confirmMsg = `✅ Added study plan "${act.presetName}" to Active Plans!`;
        } else if (act.type === 'start_timer') {
            if (typeof startTimer === 'function') startTimer();
            confirmMsg = `⏱️ Started your ${window.appState.timerSettings.pomodoro || 25}m Deep Focus Pomodoro timer!`;
        } else if (act.type === 'pause_timer') {
            if (typeof pauseTimer === 'function') pauseTimer();
            confirmMsg = `⏸️ Paused your Pomodoro timer.`;
        } else if (act.type === 'set_pomo_preset') {
            if (typeof selectPomoPreset === 'function') {
                selectPomoPreset(act.name, act.focus, act.short, act.long, act.count);
            } else {
                window.appState.timerSettings = { pomodoro: act.focus, short: act.short, long: act.long, sessionsTotal: act.count };
            }
            confirmMsg = `⏱️ Updated Pomodoro timer preset to **${act.name} (${act.focus}m / ${act.short}m)**!`;
        } else if (act.type === 'set_pomo_minutes') {
            window.appState.timerSettings.pomodoro = act.minutes;
            if (!window.appState.timer.isRunning && window.appState.timer.mode === 'pomodoro') {
                window.appState.timer.secondsLeft = act.minutes * 60;
            }
            if (typeof renderTimerDisplay === 'function') renderTimerDisplay();
            confirmMsg = `⏱️ Set Pomodoro focus duration to **${act.minutes} minutes**!`;
        } else if (act.type === 'reset_water') {
            window.appState.waterIntakeMl = 0;
            confirmMsg = `✅ Reset daily hydration intake to 0 ml.`;
        } else if (act.type === 'log_water') {
            window.appState.waterIntakeMl = (window.appState.waterIntakeMl || 0) + (window.appState.glassSizeMl || 250);
            confirmMsg = `💧 Logged +${window.appState.glassSizeMl || 250} ml of water!`;
        } else if (act.type === 'set_water_goal') {
            window.appState.dailyWaterGoalMl = act.goalMl;
            confirmMsg = `💧 Updated daily hydration goal to **${act.goalMl} ml**!`;
        } else if (act.type === 'set_glass_size') {
            window.appState.glassSizeMl = act.glassMl;
            confirmMsg = `💧 Updated water glass size to **${act.glassMl} ml**!`;
        } else if (act.type === 'set_performance_mode') {
            if (typeof togglePerformanceMode === 'function') {
                togglePerformanceMode(act.enabled);
            } else {
                window.appState.performanceMode = Boolean(act.enabled);
                applyThemeVariables();
            }
            confirmMsg = `⚡ ${act.enabled ? 'Enabled' : 'Disabled'} **Performance Mode**!`;
        } else if (act.type === 'set_ui_scale') {
            if (typeof setUiScaleDirect === 'function') {
                setUiScaleDirect(act.scale);
            } else {
                window.appState.uiScale = act.scale;
                applyThemeVariables();
            }
            confirmMsg = `🔍 Updated UI Scale to **${100 + act.scale * 5}%**!`;
        } else if (act.type === 'set_sound_enabled') {
            window.appState.soundEnabled = Boolean(act.enabled);
            confirmMsg = `🔊 ${act.enabled ? 'Enabled' : 'Muted'} sound effects!`;
        } else if (act.type === 'set_notifications_enabled') {
            window.appState.notificationsEnabled = Boolean(act.enabled);
            confirmMsg = `🔔 ${act.enabled ? 'Enabled' : 'Disabled'} notifications!`;
        } else if (act.type === 'set_streak_visibility') {
            window.appState.showStreak = Boolean(act.visible);
            if (typeof toggleStreakBadgeVisibility === 'function') toggleStreakBadgeVisibility(act.visible);
            confirmMsg = `🔥 ${act.visible ? 'Showing' : 'Hid'} the top-bar Streak badge!`;
        } else if (act.type === 'set_profile_name') {
            window.appState.user.name = act.name;
            window.appState.user.isCustomName = true;
            confirmMsg = `👤 Updated your display name to **${act.name}**!`;
        }

        saveState(true);
        if (typeof window.updateUI === 'function') window.updateUI();
        showNotification("Zenith AI Action", confirmMsg.replace(/\*\*/g, ''), "success");
        appendAiChatBubble(confirmMsg, true);
    } catch (err) {
        if (typeof window.showCasualError === 'function') window.showCasualError();
    }
}

function cancelAiAction() {
    hideAiInlinePopupTray();
    pendingAiAction = null;
    activeAiFlow = null;
    appendAiChatBubble(`Cancelled — no changes were made.`);
    showNotification("Action Cancelled", "No changes were applied.", "info");
}
