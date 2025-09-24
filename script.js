/* script.js - shared logic for Pulse ⚡
   - stores events in localStorage under 'pulse_events'
   - provides initHome() and initCalendar() used by each page
*/

const STORAGE_KEY = 'pulse_events';

/* ---------- Utilities ---------- */

function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse events', e);
    return [];
  }
}

function saveEvents(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

/* ---------- Home Page ---------- */

function initHome() {
  const container = document.getElementById('eventsContainer');
  const emptyTpl = document.getElementById('emptyTemplate');
  const searchInput = document.getElementById('searchInput');

  function render() {
    const events = loadEvents();
    // upcoming: sort by date/time ascending, only future & today included
    const now = new Date();
    const upcoming = events
      .slice()
      .filter(e => new Date(e.date + 'T' + (e.time || '00:00')) >= startOfDay(now))
      .sort((a,b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')));

    const filter = searchInput.value.trim().toLowerCase();
    const filtered = upcoming.filter(ev => ev.title.toLowerCase().includes(filter));

    container.innerHTML = '';
    if (filtered.length === 0) {
      container.appendChild(emptyTpl.content.cloneNode(true));
      return;
    }

    for (const ev of filtered) {
      const card = document.createElement('div');
      card.className = 'p-4 rounded-md bg-neutral-850 border border-neutral-800 flex items-start justify-between';
      card.innerHTML = `
        <div>
          <div class="font-semibold text-lg">${escapeHtml(ev.title)}</div>
          <div class="text-sm text-neutral-400 mt-1">${formatDateHuman(ev.date)} ${ev.time ? ' • ' + ev.time : ''}</div>
        </div>
        <div class="text-neutral-400 text-sm">
          <button data-id="${ev.id}" class="deleteBtn px-2 py-1 rounded-md hover:bg-neutral-800">Delete</button>
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

  searchInput.addEventListener('input', render);
  render();
}

/* ---------- Calendar Page ---------- */

function initCalendar() {
  // elements
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
    grid.innerHTML = '';
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // label
    monthLabel.textContent = viewDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });

    // first day of month and days count
    const first = new Date(year, month, 1);
    const startDay = first.getDay(); // 0..6 (Sun..Sat)
    const daysInMonth = new Date(year, month+1, 0).getDate();

    // header weekdays
    const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for (let wd of weekdays) {
      const el = document.createElement('div');
      el.className = 'text-xs text-neutral-400 text-center pb-2';
      el.textContent = wd;
      grid.appendChild(el);
    }

    // blank cells for previous month's tail
    for (let i=0;i<startDay;i++) {
      const cell = document.createElement('div');
      cell.className = 'h-24 p-2 border border-neutral-800 rounded-md bg-neutral-900';
      grid.appendChild(cell);
    }

    const events = loadEvents();
    // create days
    for (let d=1; d<=daysInMonth; d++) {
      const dayDate = new Date(year, month, d);
      const iso = dayDate.toISOString().slice(0,10);
      const dayEvents = events.filter(ev => ev.date === iso);
      const cell = document.createElement('div');
      cell.className = 'h-24 p-2 border border-neutral-800 rounded-md flex flex-col justify-between';
      // highlight today
      const today = new Date();
      if (sameDate(dayDate, today)) cell.classList.add('ring-2','ring-amber-400');

      const head = document.createElement('div');
      head.className = 'flex items-center justify-between';
      head.innerHTML = `<div class="text-sm font-medium">${d}</div>`;
      cell.appendChild(head);

      const list = document.createElement('div');
      list.className = 'mt-2 text-xs text-neutral-300 overflow-hidden';
      // show up to 3 events short
      dayEvents.slice(0,3).forEach(ev => {
        const evEl = document.createElement('div');
        evEl.className = 'truncate text-ellipsis';
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
    form.reset();
    if (prefillDate) form.date.value = prefillDate;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  function closeModal() {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
  }

  addBtn.addEventListener('click', () => openModal(new Date().toISOString().slice(0,10)));
  cancelBtn.addEventListener('click', closeModal);

  // navigate months
  prevBtn.addEventListener('click', () => {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    renderCalendar();
  });
  nextBtn.addEventListener('click', () => {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    renderCalendar();
  });

  // handle form submit
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
    // If on home page open, it will reflect on refresh or opening
  });

  // backdrop click to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // init render
  renderCalendar();
}

/* ---------- Helpers ---------- */

function sameDate(a,b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDateHuman(iso) {
  const d = new Date(iso + 'T00:00');
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
      }
