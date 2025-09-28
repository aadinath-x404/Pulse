'use strict';

const STORAGE_KEY = 'pulse_events';

/* ---------- Safe localStorage helpers ---------- */
function localAvailable() {
    try {
        const k = '__pulse_test__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
    } catch (err) {
        return false;
    }
}
function safeLocalGet(key) {
    try { return localStorage.getItem(key); } catch (err) { return null; }
}
function safeLocalSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (err) { return false; }
}
function safeLocalRemove(key) {
    try { localStorage.removeItem(key); return true; } catch (err) { return false; }
}

/* ---------- Event storage ---------- */
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

/* ---------- Misc helpers ---------- */
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
function debounce(fn, delay = 150) {
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
            card.className = 'p-4 rounded-md bg-white shadow-sm border border-neutral-200 flex items-start justify-between transition-colors duration-150';
            card.innerHTML = `
                <div>
                    <div class="font-semibold text-lg text-neutral-900">${escapeHtml(ev.title)}</div>
                    <div class="text-sm text-neutral-600 mt-1">${formatDateHuman(ev.date)} ${ev.time ? ' • ' + ev.time : ''}</div>
                </div>
                <div class="text-neutral-600 text-sm">
                    <button data-id="${ev.id}" class="deleteBtn px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors" aria-label="Delete event">Delete</button>
                </div>
            `;
            container.appendChild(card);
        }

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

    let viewDate = new Date();

    function renderCalendar() {
        if (!grid) return;
        grid.innerHTML = '';
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        if (monthLabel) monthLabel.textContent = viewDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });

        const first = new Date(year, month, 1);
        const startDay = first.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        weekdays.forEach(wd => {
            const el = document.createElement('div');
            el.className = 'text-xs text-neutral-600 text-center pb-2';
            el.textContent = wd;
            grid.appendChild(el);
        });

        for (let i = 0; i < startDay; i++) {
            const cell = document.createElement('div');
            cell.className = 'h-24 p-2 border border-neutral-200 rounded-md bg-white/50';
            grid.appendChild(cell);
        }

        const events = loadEvents();
        for (let d = 1; d <= daysInMonth; d++) {
            const dayDate = new Date(year, month, d);
            const iso = dayDate.toISOString().slice(0, 10);
            const dayEvents = events.filter(ev => ev.date === iso);
            const cell = document.createElement('div');
            cell.className = 'h-24 p-2 border border-neutral-200 rounded-md flex flex-col justify-between hover:bg-neutral-50 transition-colors duration-150 bg-white/60';
            if (sameDate(dayDate, new Date())) cell.classList.add('ring-2','ring-amber-400');

            const head = document.createElement('div');
            head.className = 'flex items-center justify-between';
            head.innerHTML = `<div class="text-sm font-medium text-neutral-900">${d}</div>`;
            cell.appendChild(head);

            const list = document.createElement('div');
            list.className = 'mt-2 text-xs text-neutral-700 overflow-hidden';
            dayEvents.slice(0,3).forEach(ev => {
                const evEl = document.createElement('div');
                evEl.className = 'truncate';
                evEl.title = ev.title + (ev.time ? ' • ' + ev.time : '');
                evEl.textContent = (ev.time ? ev.time + ' — ' : '') + ev.title;
                list.appendChild(evEl);
            });
            if(dayEvents.length>3){
                const more = document.createElement('div');
                more.className = 'text-neutral-500 text-xs';
                more.textContent = `+${dayEvents.length-3} more`;
                list.appendChild(more);
            }

            cell.appendChild(list);
            cell.addEventListener('click',()=>openModal(iso));
            grid.appendChild(cell);
        }
    }

    function openModal(prefillDate){
        if(!form) return;
        form.reset();
        if(prefillDate) form.date.value = prefillDate;
        if(modal) modal.classList.remove('hidden');
    }
    function closeModal(){
        if(modal) modal.classList.add('hidden');
    }

    if(cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if(addBtn) addBtn.addEventListener('click',()=>openModal());

    if(form){
        form.addEventListener('submit',(e)=>{
            e.preventDefault();
            const data = Object.fromEntries(new FormData(form));
            const events = loadEvents();
            events.push({id:uid(),title:data.title,date:data.date,time:data.time});
            saveEvents(events);
            closeModal();
            renderCalendar();
        });
    }

    if(prevBtn) prevBtn.addEventListener('click',()=>{viewDate.setMonth(viewDate.getMonth()-1);renderCalendar();});
    if(nextBtn) nextBtn.addEventListener('click',()=>{viewDate.setMonth(viewDate.getMonth()+1);renderCalendar();});

    renderCalendar();
}
