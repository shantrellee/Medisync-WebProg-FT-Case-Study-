//(shared by patient and staff pages)
const API_BASE_URL = '/api'; // Uses relative path for deployment

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        // If token is expired/invalid (401) and it's not a login attempt, kick user out
        if (response.status === 401 && !endpoint.includes('/auth/')) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = 'index.html';
        }
        throw new Error(data.error || 'Something went wrong');
    }
    return data;
}

// Security helper to prevent XSS attacks when displaying names/notes
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ---------- Shared date / time helpers ----------

// Today's date as YYYY-MM-DD in the user's local time (used as the min for date inputs)
function todayLocal() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
}

// "14:30" -> "2:30 PM"
function formatTime12(hhmm) {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

// clinic is closed on Sundays
function isSunday(dateStr) {
    return new Date(`${dateStr}T00:00:00`).getDay() === 0;
}

// Fills a <select> with 30-minute slots from 8:00 AM to 4:30 PM (clinic closes at 5:00 PM).
// If dateStr is today, slots that already passed are disabled.
function populateTimeSlots(select, dateStr) {
    const previous = select.value;
    select.innerHTML = '<option value="">Choose a time</option>';

    const isToday = dateStr === todayLocal();
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (let mins = 8 * 60; mins <= 16 * 60 + 30; mins += 30) {
        const value = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = formatTime12(value);
        if (isToday && mins <= nowMinutes) opt.disabled = true;
        select.appendChild(opt);
    }

    const stillValid = [...select.options].find(o => o.value === previous && !o.disabled);
    if (stillValid) select.value = previous;
}

// ---------- Doctor catalog helper ----------
// /clinic/catalog items look like { doctor: "Dr. Elena Gilbert (Dentistry)", services: [...] }.
// If the backend later adds specialty / photo / description / education fields, they are used automatically.
function getDoctorInfo(item) {
    const raw = item.doctor || '';
    const match = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    return {
        key: raw, // exact string the backend expects when booking
        name: match ? match[1] : raw,
        specialty: item.specialty || (match ? match[2] : 'General'),
        services: item.services || [],
        photo: item.photo || '',
        description: item.description || '',
        education: item.education || ''
    };
}