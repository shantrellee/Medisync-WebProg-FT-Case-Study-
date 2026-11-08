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