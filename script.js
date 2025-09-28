/* script.js - Pulse ⚡
    Full shared logic: Home + Calendar + robust working dark mode toggle
    Replace your existing script.js with this file.
*/

'use strict';

const STORAGE_KEY = 'pulse_events';
const THEME_KEY = 'pulse_dark';

/* ---------- Utilities ---------- */

function safeLocalGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (err) {
        console.warn('localStorage.getItem blocked:', err);
        return null;
    }
}
function safeLocalSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (err) {
        console.warn('localStorage.setItem blocked:', err);
        return false;
    }
}

function loadEvents() {
    try {
        const raw = safeLocalGet(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Failed to parse events', e);
        return [];
    }
}

function saveEvents(events) {
    safeLocalSet(STORAGE_KEY, JSON.stringify(events));
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function sameDate(a, b) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDateHuman(iso) {
    const d = new Date(iso + 'T00:00');
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

/* ---------- Home Page ---------- */

function initHome() {
    const container = document.getElementById('eventsContainer');
    const emptyTpl = document.getElementById('emptyTemplate');
    const searchInput = document.getElementById('searchInput');

    function render() {
        const events = loadEvents();
        const now = new Date();
        const upcoming = events
            .slice()
            .filter(e => new Date(`${e.date}T${e.time || '00:00'}`) >= startOfDay(now))
            .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));

        const filter = (searchInput && searchInput.value.trim().toLowerCase()) || '';
        const filtered = upcoming.filter(ev => ev.title.toLowerCase().includes(filter));

        if (!container) return;
        container.innerHTML = '';
        if (!filtered.length) {
            container.appendChild(emptyTpl.content.cloneNode(true));
            return;
        }

        for (const ev of filtered) {
            const card = document.createElement('div');
            card.setAttribute('role', 'listitem');
            card.className = 'p-4 rounded-md bg-white shadow-sm border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 flex items-start justify-between transition-colors duration-150';
            card.innerHTML = `
                <div>
                    <div class="font-semibold text-lg text-neutral-900 dark:text-neutral-100">${escapeHtml(ev.title)}</div>
                    <div class="text-sm text-neutral-600 dark:text-neutral-400 mt-1">${formatDateHuman(ev.date)} ${ev.time ? ' • ' + ev.time : ''}</div>
                </div>
                <div class="text-neutral-600 dark:text-neutral-400 text-sm">
                    <button data-id="${ev.id}" class="deleteBtn px-2 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors" aria-label="Delete event">Delete</button>
                </div>
            `;
            container.appendChild(card);
        }

        // attach delete handlers
        container.querySelectorAll('.deleteBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const all = loadEvents().filter(x => x.id !== id);
                saveEvents(all);
                render();
            });
        });
    }

    if (searchInput) searchInput.addEventListener('input', debounce(render, 150));
    render();
}

/* ---------- Calendar Page ---------- */

function initCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('monthLabel');
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');
    const addBtn = document.getElementById('addBtn');
    const modal = document.getElementById('modal');
    const form = document.getElementById('addEventForm');
    const cancelBtn = document.getElementById('cancelBtn');

    let viewDate = new Date(); // current month view

    function renderCalendar() {
        if (!grid) return;
        grid.innerHTML = '';
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();

        // label
        if (monthLabel) monthLabel.textContent = viewDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });

        // first day of month and days count
        const first = new Date(year, month, 1);
        const startDay = first.getDay(); // 0..6 (Sun..Sat)
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // header weekdays
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let wd of weekdays) {
            const el = document.createElement('div');
            el.className = 'text-xs text-neutral-600 dark:text-neutral-400 text-center pb-2';
            el.textContent = wd;
            grid.appendChild(el);
        }

        // blank cells for previous month's tail
        for (let i = 0; i < startDay; i++) {
            const cell = document.createElement('div');
            cell.className = 'h-24 p-2 border border-neutral-200 dark:border-neutral-800 rounded-md bg-white/50 dark:bg-neutral-900';
            grid.appendChild(cell);
        }

        const events = loadEvents();
        // create days
        for (let d = 1; d <= daysInMonth; d++) {
            const dayDate = new Date(year, month, d);
            const iso = dayDate.toISOString().slice(0, 10);
            const dayEvents = events.filter(ev => ev.date === iso);
            const cell = document.createElement('div');
            cell.className = 'h-24 p-2 border border-neutral-200 dark:border-neutral-800 rounded-md flex flex-col justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150 bg-white/60 dark:bg-neutral-900/30';
            // highlight today
            const today = new Date();
            if (sameDate(dayDate, today)) cell.classList.add('ring-2', 'ring-amber-400');

            const head = document.createElement('div');
            head.className = 'flex items-center justify-between';
            head.innerHTML = `<div class="text-sm font-medium text-neutral-900 dark:text-neutral-100">${d}</div>`;
            cell.appendChild(head);

            const list = document.createElement('div');
            list.className = 'mt-2 text-xs text-neutral-700 dark:text-neutral-300 overflow-hidden';
            // show up to 3 events short
            dayEvents.slice(0, 3).forEach(ev => {
                const evEl = document.createElement('div');
                evEl.className = 'truncate';
                evEl.title = ev.title + (ev.time ? ' • ' + ev.time : '');
                evEl.textContent = (ev.time ? ev.time + ' — ' : '') + ev.title;
                list.appendChild(evEl);
            });
            if (dayEvents.length > 3) {
                const more = document.createElement('div');
                more.className = 'text-neutral-500 text-xs';
                more.textContent = `+${dayEvents.length - 3} more`;
                list.appendChild(more);
            }

            cell.appendChild(list);

            // click day to prefill modal date
            cell.addEventListener('click', (e) => {
                openModal(iso);
            });

            grid.appendChild(cell);
        }
    }

    function openModal(prefillDate) {
        if (!form) return;
        form.reset();
        if (prefillDate) form.date.value = prefillDate;
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }
    function closeModal() {
        if (!modal) return;
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }

    if (addBtn) addBtn.addEventListener('click', () => openModal(new Date().toISOString().slice(0, 10)));
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // navigate months
    if (prevBtn) prevBtn.addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1); renderCalendar(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1); renderCalendar(); });

    // handle form submit
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const title = (formData.get('title') || '').trim();
            const date = formData.get('date');
            const time = formData.get('time') || '';
            if (!title || !date) return alert('Please fill title and date.');

            const events = loadEvents();
            events.push({ id: uid(), title, date, time });
            saveEvents(events);
            closeModal();
            renderCalendar();
        });
    }

    // backdrop click to close
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    // init render
    renderCalendar();
}

/* ---------- Dark Mode Toggle (robust) ---------- */

function setupDarkToggle() {
    const btns = Array.from(document.querySelectorAll('#toggle-dark')); // can be on multiple pages
    const root = document.documentElement;

    function applyTheme(isDark) {
        if (isDark) {
            root.classList.add('dark');
            safeLocalSet(THEME_KEY, 'true');
        } else {
            root.classList.remove('dark');
            safeLocalSet(THEME_KEY, 'false');
        }
        refreshButtons();
        console.info('Pulse: theme applied ->', isDark ? 'dark' : 'light');
    }

    function refreshButtons() {
        const isDark = root.classList.contains('dark');
        btns.forEach(b => {
            // show icon that indicates the *action* (i.e., show moon when currently light)
            // we'll show moon when currently light (so clicking enables dark)
            // and sun when currently dark (so clicking enables light).
            b.textContent = isDark ? '☀️' : '🌙';
            b.setAttribute('aria-pressed', String(isDark));
            b.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
        });
    }

    // read saved preference (string 'true' or 'false'), otherwise fall back to OS pref
    const saved = safeLocalGet(THEME_KEY);
    if (saved === 'true') {
        applyTheme(true);
    } else if (saved === 'false') {
        applyTheme(false);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        applyTheme(true);
    } else {
        applyTheme(false);
    }

    // attach click handlers
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const nowDark = root.classList.contains('dark');
            applyTheme(!nowDark);
        });
    });

    // If OS-level preference changes and the user has NOT saved a preference, follow OS.
    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.addEventListener?.('change', (e) => {
            if (safeLocalGet(THEME_KEY) === null) {
                applyTheme(e.matches);
            }
        });
    }
}

// run dark toggle setup asap (script is loaded near bottom in your HTML)
try {
    setupDarkToggle();
} catch (err) {
    console.error('Error setting up dark toggle:', err);
}

/* ---------- Auto-init helpers ----------
    Your HTML currently calls initHome() or initCalendar() after loading this script.
    Keep those calls, or if you prefer automatic init:
    if (document.querySelector('#eventsContainer')) initHome();
    if (document.querySelector('#calendarGrid')) initCalendar();
    But your current HTML already invokes initHome() / initCalendar() — leave it as is.
*/
