document.addEventListener('DOMContentLoaded', () => {
    const userRole = localStorage.getItem('role');
    const token = localStorage.getItem('token');
    const patientData = JSON.parse(sessionStorage.getItem('currentPatient') || '{}');

    // 1. PAGE GUARD: Redirect to login if accessing a protected page without a token
    const isProtected = document.querySelector('.user-btn') !== null;
    if (isProtected && (!token || userRole !== 'patient')) {
        window.location.href = 'patient-login.html';
        return;
    }

    // 2. HEADER LOGIC: Set name and handle logout (Crash-proofed for older accounts)
    if (isProtected) {
        const displayName = patientData.firstName || patientData.name || 'Patient';

        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = escapeHTML(displayName);

        const userInitialEl = document.getElementById('userInitial');
        if (userInitialEl) userInitialEl.textContent = escapeHTML(displayName.charAt(0).toUpperCase());

        const userMenuBtn = document.getElementById('userMenuBtn');
        if (userMenuBtn) {
            userMenuBtn.addEventListener('click', (e) => {
                const menu = document.getElementById('userMenu');
                if (menu) {
                    const isExpanded = menu.hidden === false;
                    menu.hidden = isExpanded;
                    e.currentTarget.setAttribute('aria-expanded', !isExpanded);
                }
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = 'patient-login.html';
            });
        }
    }

    // Helper to show messages
    const showMessage = (elId, msg, isSuccess = false) => {
        const el = document.getElementById(elId);
        if (!el) return;
        el.textContent = msg;
        el.hidden = false;
        el.className = `page-message ${isSuccess ? 'success' : ''}`;
    };

    // 3. LOGIN FORM
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            document.querySelector('button[type="submit"]').disabled = true;
            try {
                const payload = {
                    email: loginForm.email.value.trim(),
                    password: loginForm.password.value
                };
                const data = await apiRequest('/auth/patient/login', { method: 'POST', body: JSON.stringify(payload) });

                localStorage.setItem('token', data.token);
                localStorage.setItem('role', 'patient');
                sessionStorage.setItem('currentPatient', JSON.stringify(data.patient));
                window.location.href = 'patient-dashboard.html';
            } catch (err) {
                showMessage('loginMessage', err.message);
                document.querySelector('button[type="submit"]').disabled = false;
            }
        });
    }

    // 4. REGISTER FORM
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            document.querySelector('button[type="submit"]').disabled = true;
            try {
                const payload = {
                    firstName: registerForm.firstName.value.trim(),
                    lastName: registerForm.lastName.value.trim(),
                    birthDate: registerForm.birthDate.value,
                    sex: registerForm.sex.value,
                    email: registerForm.email.value.trim(),
                    phone: registerForm.contact.value.trim(),
                    password: registerForm.password.value
                };

                await apiRequest('/auth/patient/register', { method: 'POST', body: JSON.stringify(payload) });
                showMessage('registerMessage', 'Account created! Redirecting to login...', true);
                setTimeout(() => window.location.href = 'patient-login.html', 1500);
            } catch (err) {
                showMessage('registerMessage', err.message);
                document.querySelector('button[type="submit"]').disabled = false;
            }
        });
    }

    // 5. REQUEST APPOINTMENT FORM
    const requestForm = document.getElementById('requestForm');
    if (requestForm) {
        const doctorSelect = document.getElementById('requestDoctor');
        const serviceSelect = document.getElementById('requestService');

        let catalog = [];
        apiRequest('/clinic/catalog').then(data => {
            catalog = data;
            doctorSelect.innerHTML = '<option value="">Select a doctor</option>';
            catalog.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.doctor;
                opt.textContent = item.doctor;
                doctorSelect.appendChild(opt);
            });
        }).catch(() => {
            doctorSelect.innerHTML = '<option value="">Failed to load doctors</option>';
        });

        doctorSelect.addEventListener('change', () => {
            serviceSelect.innerHTML = '<option value="">Select a service</option>';
            const match = catalog.find(i => i.doctor === doctorSelect.value);
            if (match) {
                match.services.forEach(srv => {
                    const opt = document.createElement('option');
                    opt.value = srv;
                    opt.textContent = srv;
                    serviceSelect.appendChild(opt);
                });
                serviceSelect.disabled = false;
            } else {
                serviceSelect.disabled = true;
            }
        });

        requestForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            document.querySelector('button[type="submit"]').disabled = true;
            try {
                const payload = {
                    doctor: requestForm.doctor.value,
                    service: requestForm.service.value,
                    date: requestForm.date.value,
                    time: requestForm.time.value,
                    notes: requestForm.notes.value
                };
                await apiRequest('/appointments', { method: 'POST', body: JSON.stringify(payload) });
                showMessage('requestMessage', 'Appointment requested successfully.', true);
                requestForm.reset();
                serviceSelect.disabled = true;
            } catch (err) {
                showMessage('requestMessage', err.message);
            } finally {
                document.querySelector('button[type="submit"]').disabled = false;
            }
        });
    }

    // 6. DASHBOARD (My Appointments)
    const tableBody = document.getElementById('appointmentTableBody');
    if (tableBody) {
        let currentAppts = [];

        // Function to render table based on an array
        const renderTable = (appointmentsToRender) => {
            tableBody.innerHTML = '';
            if (appointmentsToRender.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="empty">No records found.</td></tr>';
                return;
            }

            appointmentsToRender.forEach(a => {
                const tr = document.createElement('tr');
                const apptId = a._id || a.id;

                let statusHtml = `<span class="badge badge-${a.status.toLowerCase()}">${escapeHTML(a.status)}</span>`;
                if (a.status === 'Pending') {
                    statusHtml += ` <span class="info-circle" title="Pending requests are being reviewed by the clinic, kindly wait for confirmation.">?</span>`;
                }

                const actionHtml = `<button class="btn btn-outline btn-sm view-btn" data-id="${apptId}">View</button>`;

                tr.innerHTML = `
                    <td>${escapeHTML(a.doctor)}</td>
                    <td>${escapeHTML(a.service)}</td>
                    <td>${escapeHTML(a.date)} ${escapeHTML(a.time)}</td>
                    <td>${statusHtml}</td>
                    <td>${actionHtml}</td>
                `;
                tableBody.appendChild(tr);
            });
        };

        const loadDashboard = async() => {
            try {
                currentAppts = await apiRequest('/patients/me/appointments');

                // Update Stats
                document.getElementById('statTotal').textContent = currentAppts.length;
                document.getElementById('statUpcoming').textContent = currentAppts.filter(a => a.status === 'Confirmed').length;
                document.getElementById('statPending').textContent = currentAppts.filter(a => a.status === 'Pending').length;
                document.getElementById('statDone').textContent = currentAppts.filter(a => a.status === 'Done').length;

                // Initial render with all appointments
                renderTable(currentAppts);

                // Initialize the filter logic
                const filterDropdown = document.getElementById('apptFilter');
                if (filterDropdown) {
                    filterDropdown.addEventListener('change', (e) => {
                        const selectedStatus = e.target.value;
                        if (selectedStatus === '') {
                            renderTable(currentAppts);
                        } else {
                            const filtered = currentAppts.filter(a => a.status === selectedStatus);
                            renderTable(filtered);
                        }
                    });
                }

            } catch (err) {
                tableBody.innerHTML = '<tr><td colspan="5" class="empty">Error loading data.</td></tr>';
            }
        };

        // Event Delegation for the "View" buttons inside the table
        tableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-btn')) {
                const id = e.target.getAttribute('data-id');
                const a = currentAppts.find(appt => (appt._id === id || appt.id === id));
                if (!a) return;

                const safeId = String(a._id || a.id || '');

                document.getElementById('modalApptId').textContent = safeId.slice(-8).toUpperCase();
                document.getElementById('modalApptDoctor').textContent = a.doctor;
                document.getElementById('modalApptService').textContent = a.service;
                document.getElementById('modalApptDate').textContent = `${a.date} at ${a.time}`;
                document.getElementById('modalApptStatusBadge').innerHTML = `<span class="badge badge-${a.status.toLowerCase()}">${escapeHTML(a.status)}</span>`;
                document.getElementById('modalApptNotes').textContent = a.notes ? `"${escapeHTML(a.notes)}"` : 'None provided';

                const actionArea = document.getElementById('modalApptActionArea');
                let leftContent = '';

                if (a.status === 'Pending') {
                    leftContent = `<button class="btn btn-solid cancel-btn" data-id="${safeId}" style="background-color: #dc2626; border: none; color: white; padding: 6px 12px; border-radius: 6px;">Cancel Request</button>`;
                } else if (a.status === 'Confirmed') {
                    leftContent = `<span style="font-size: 0.85em; color: var(--muted);">To cancel, please call (045) 000-0000</span>`;
                } else {
                    leftContent = `<span></span>`;
                }

                actionArea.innerHTML = `
                    <div>${leftContent}</div>
                    <button class="btn btn-outline" id="closeApptModal">Close</button>
                `;

                document.getElementById('apptModal').hidden = false;
            }
        });

        // Event Delegation for the Modal buttons (Cancel and Close)
        document.getElementById('apptModal').addEventListener('click', async(e) => {
            // Close Button Logic
            if (e.target.id === 'closeApptModal') {
                document.getElementById('apptModal').hidden = true;
            }

            // Cancel Button Logic
            if (e.target.classList.contains('cancel-btn')) {
                const id = e.target.getAttribute('data-id');
                if (!confirm('Are you sure you want to cancel this request?')) return;
                try {
                    await apiRequest(`/appointments/${id}/cancel-self`, { method: 'PATCH' });
                    document.getElementById('apptModal').hidden = true; // Hide modal on success

                    // Reset filter dropdown to 'All' before refreshing
                    const filterDropdown = document.getElementById('apptFilter');
                    if (filterDropdown) filterDropdown.value = '';

                    loadDashboard(); // Refresh table and stats
                } catch (err) {
                    alert(err.message);
                }
            }
        });

        // Initialize dashboard
        loadDashboard();
    }
});