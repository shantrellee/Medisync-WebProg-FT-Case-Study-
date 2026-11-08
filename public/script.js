document.addEventListener('DOMContentLoaded', () => {
    const userRole = localStorage.getItem('role');
    const token = localStorage.getItem('token');
    const staffData = JSON.parse(sessionStorage.getItem('currentStaff') || '{}');

    // 1. PAGE GUARD: Redirect to login if accessing a protected staff page without a staff token
    const isProtected = document.querySelector('.sidebar') !== null;
    if (isProtected && (!token || userRole !== 'staff')) {
        window.location.href = 'staff-login.html';
        return;
    }

    // 2. LOGOUT LOGIC
    if (isProtected) {
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = 'staff-login.html';
        });
    }

    // Helper to show messages
    const showMessage = (elId, msg, isSuccess = false) => {
        const el = document.getElementById(elId);
        if (!el) return;
        el.textContent = msg;
        el.hidden = false;
        el.className = `page-message ${isSuccess ? 'success' : ''}`;
    };

    // 3. STAFF LOGIN FORM
    const staffForm = document.getElementById('staffForm');
    if (staffForm) {
        staffForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            document.querySelector('button[type="submit"]').disabled = true;
            try {
                const payload = {
                    staffId: staffForm.staffId.value.trim(),
                    password: staffForm.password.value
                };
                const data = await apiRequest('/auth/staff/login', { method: 'POST', body: JSON.stringify(payload) });

                localStorage.setItem('token', data.token);
                localStorage.setItem('role', 'staff');
                sessionStorage.setItem('currentStaff', JSON.stringify(data.staff));
                window.location.href = 'staff-dashboard.html';
            } catch (err) {
                showMessage('staffMessage', err.message);
                document.querySelector('button[type="submit"]').disabled = false;
            }
        });
    }

    // 4. DASHBOARD (staff-dashboard.html)
    if (document.getElementById('statToday')) {
        const loadDashboard = async() => {
            try {
                // Load stats
                const stats = await apiRequest('/staff/stats');
                document.getElementById('statToday').textContent = stats.todayCount;
                document.getElementById('statPending').textContent = stats.pendingCount;
                document.getElementById('statPatients').textContent = stats.patientCount;

                // Load today's schedule
                const appts = await apiRequest('/appointments');
                const todayAppts = appts.filter(a => a.date === stats.date && a.status !== 'Cancelled');

                const list = document.getElementById('scheduleList');
                list.innerHTML = '';

                if (todayAppts.length === 0) {
                    list.innerHTML = '<li class="empty">No appointments scheduled for today.</li>';
                } else {
                    todayAppts.forEach(a => {
                        const li = document.createElement('li');
                        li.innerHTML = `
              <strong class="sched-time">${escapeHTML(a.time)}</strong> 
              <div class="sched-info">
                <span>${escapeHTML(a.patientId?.firstName)} ${escapeHTML(a.patientId?.lastName)}</span>
                <small>${escapeHTML(a.service)}</small>
              </div>
              <span class="badge badge-${a.status.toLowerCase()}">${escapeHTML(a.status)}</span>
            `;
                        list.appendChild(li);
                    });
                }
            } catch (err) {
                console.error(err);
                document.getElementById('scheduleList').innerHTML = '<li class="empty">Error loading schedule.</li>';
            }
        };
        loadDashboard();
    }

    // 5. APPOINTMENTS TABLE (staff-appointments.html)
    const apptBody = document.getElementById('appointmentTableBody');
    if (apptBody) {
        let allAppointments = [];

        const loadAppointments = async() => {
            try {
                allAppointments = await apiRequest('/appointments');
                renderAppointments(allAppointments);
                updatePendingCount(allAppointments);
            } catch (err) {
                apptBody.innerHTML = '<tr><td colspan="6" class="empty">Error loading data.</td></tr>';
            }
        };

        const renderAppointments = (appointmentsToRender) => {
            apptBody.innerHTML = '';
            if (appointmentsToRender.length === 0) {
                apptBody.innerHTML = '<tr><td colspan="6" class="empty">No appointments found.</td></tr>';
                return;
            }

            appointmentsToRender.forEach(a => {
                const tr = document.createElement('tr');
                const isPending = a.status === 'Pending';
                const isConfirmed = a.status === 'Confirmed';

                let actions = '';
                if (isPending) actions += `<button class="btn btn-outline btn-sm" onclick="updateStatus('${a._id}', 'Confirmed')">Confirm</button> `;
                if (isConfirmed) actions += `<button class="btn btn-solid btn-sm" onclick="updateStatus('${a._id}', 'Done')">Done</button> `;
                if (isPending || isConfirmed) actions += `<button class="btn btn-text btn-sm" onclick="updateStatus('${a._id}', 'Cancelled')">Cancel</button>`;

                tr.innerHTML = `
          <td>${escapeHTML(a.patientId?.firstName)} ${escapeHTML(a.patientId?.lastName)}<br><small>${escapeHTML(a.patientId?.phone)}</small></td>
          <td>${escapeHTML(a.doctor)}</td>
          <td>${escapeHTML(a.service)}</td>
          <td>${escapeHTML(a.date)} ${escapeHTML(a.time)}</td>
          <td><span class="badge badge-${a.status.toLowerCase()}">${escapeHTML(a.status)}</span></td>
          <td>${actions || '-'}</td>
        `;
                apptBody.appendChild(tr);
            });
        };

        const updatePendingCount = (appts) => {
            const pendingCountEl = document.getElementById('pendingCount');
            if (pendingCountEl) {
                pendingCountEl.textContent = appts.filter(a => a.status === 'Pending').length;
            }
        };

        // Filter Logic
        document.querySelectorAll('.pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.pill').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-pressed', 'false');
                });
                e.currentTarget.classList.add('active');
                e.currentTarget.setAttribute('aria-pressed', 'true');

                const filter = e.currentTarget.dataset.filter;
                if (!filter) {
                    renderAppointments(allAppointments);
                } else {
                    renderAppointments(allAppointments.filter(a => a.status === filter));
                }
            });
        });

        window.updateStatus = async(id, status) => {
            if (!confirm(`Mark appointment as ${status}?`)) return;
            try {
                await apiRequest(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
                loadAppointments();
            } catch (err) {
                alert(err.message);
            }
        };

        loadAppointments();
    }
});