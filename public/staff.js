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

            const submitBtn = staffForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            try {
                const staffIdInput = document.getElementById('staffId').value.trim();
                const passwordInput = document.getElementById('staffPassword').value;

                const payload = {
                    staffId: staffIdInput,
                    password: passwordInput
                };

                const data = await apiRequest('/auth/staff/login', { method: 'POST', body: JSON.stringify(payload) });

                localStorage.setItem('token', data.token);
                localStorage.setItem('role', 'staff');
                sessionStorage.setItem('currentStaff', JSON.stringify(data.staff));
                window.location.href = 'staff-dashboard.html';
            } catch (err) {
                showMessage('staffMessage', err.message);
                if (submitBtn) submitBtn.disabled = false;
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
                if (isPending) actions += `<button class="btn btn-outline btn-sm status-btn" data-id="${a._id}" data-status="Confirmed">Confirm</button> `;
                if (isConfirmed) actions += `<button class="btn btn-solid btn-sm status-btn" data-id="${a._id}" data-status="Done">Done</button> `;
                if (isPending || isConfirmed) actions += `<button class="btn btn-text btn-sm status-btn" data-id="${a._id}" data-status="Cancelled">Cancel</button>`;

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

        // NEW EVENT DELEGATION (Replaces window.updateStatus):
        apptBody.addEventListener('click', async(e) => {
            if (e.target.classList.contains('status-btn')) {
                const id = e.target.getAttribute('data-id');
                const status = e.target.getAttribute('data-status');

                if (!confirm(`Mark appointment as ${status}?`)) return;

                try {
                    await apiRequest(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
                    loadAppointments();
                } catch (err) {
                    alert(err.message);
                }
            }
        });

        loadAppointments();
    }

    // 6. PATIENTS DIRECTORY (staff-patients.html)
    const patientBody = document.getElementById('patientTableBody');
    if (patientBody) {
        let allPatients = [];

        const loadPatients = async() => {
            try {
                allPatients = await apiRequest('/patients');
                patientBody.innerHTML = '';

                if (allPatients.length === 0) {
                    patientBody.innerHTML = '<tr><td colspan="3" class="empty">No patients found.</td></tr>';
                    return;
                }

                allPatients.forEach(p => {
                    const tr = document.createElement('tr');
                    const displayName = p.firstName ? `${p.firstName} ${p.lastName}` : (p.name || 'Unknown Patient');

                    tr.innerHTML = `
            <td class="patient-name-col">
              <strong>${escapeHTML(displayName)}</strong>
            </td>
           <td class="patient-contact-col">
              ${escapeHTML(p.phone || 'No phone')}<br>
              <small style="color: var(--muted, gray); word-break: break-all;">${escapeHTML(p.email || 'No email provided')}</small>
            </td>
            <td class="col-actions">
              <button class="btn btn-outline btn-sm view-btn" data-id="${p._id || p.id}">View</button>
            </td>
          `;
                    patientBody.appendChild(tr);
                });
            } catch (err) {
                patientBody.innerHTML = '<tr><td colspan="3" class="empty">Error loading data.</td></tr>';
            }
        };

        // Event Delegation for clicking View
        patientBody.addEventListener('click', async(e) => {
            if (e.target.classList.contains('view-btn')) {
                const id = e.target.getAttribute('data-id');
                const patient = allPatients.find(p => (p._id === id || p.id === id));
                if (!patient) return;

                const displayName = patient.firstName ? `${patient.firstName} ${patient.lastName}` : (patient.name || 'Unknown Patient');

                // Populate new modal fields
                document.getElementById('modalPatName').textContent = displayName;
                document.getElementById('modalPatEmail').textContent = patient.email || 'N/A';
                document.getElementById('modalPatPhone').textContent = patient.phone || 'N/A';
                document.getElementById('modalPatSex').textContent = patient.sex || 'N/A';
                document.getElementById('modalPatAddress').textContent = patient.address || 'N/A';

                if (patient.birthDate) {
                    document.getElementById('modalPatDob').textContent = new Date(patient.birthDate).toISOString().split('T')[0];
                } else {
                    document.getElementById('modalPatDob').textContent = 'N/A';
                }

                try {
                    const allAppts = await apiRequest('/appointments');
                    const history = allAppts.filter(a => a.patientId && a.patientId._id === id);

                    const historyContainer = document.getElementById('modalPatHistory');
                    historyContainer.innerHTML = '';

                    if (history.length === 0) {
                        historyContainer.innerHTML = '<p style="color: var(--muted); font-size: 0.9em; margin-top: 10px;">No appointment history found.</p>';
                    } else {
                        historyContainer.innerHTML = history.map(a => `
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.2rem;">
                                <div>
                                    <strong style="display: block; margin-bottom: 4px;">${escapeHTML(a.date)} ${escapeHTML(a.time)}</strong>
                                    <span style="font-size: 0.85em; color: var(--muted);">${escapeHTML(a.doctor)} - ${escapeHTML(a.service)}</span>
                                </div>
                                <span class="badge badge-${a.status.toLowerCase()}">${escapeHTML(a.status)}</span>
                            </div>
                        `).join('');
                    }

                    // Show the modal
                    document.getElementById('patientModal').hidden = false;
                } catch (err) {
                    alert('Error loading history.');
                }
            }
        });

        // Close Custom Modal Logic
        const closePatientModalBtn = document.getElementById('closePatientModal');
        if (closePatientModalBtn) {
            closePatientModalBtn.addEventListener('click', () => {
                document.getElementById('patientModal').hidden = true;
            });
        }

        // Quick frontend search
        const searchInput = document.getElementById('patientSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const rows = patientBody.querySelectorAll('tr');
                rows.forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
                });
            });
        }

        loadPatients();
    }

    // 7. ADD PATIENT FORM (staff-patient-form.html)
    const patientForm = document.getElementById('patientForm');
    if (patientForm) {
        patientForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            document.querySelector('button[type="submit"]').disabled = true;
            try {
                const payload = {
                    firstName: patientForm.firstName.value.trim(),
                    lastName: patientForm.lastName.value.trim(),
                    birthDate: patientForm.birthDate.value,
                    sex: patientForm.sex.value,
                    phone: patientForm.contact.value.trim(),
                    address: patientForm.address.value.trim(),
                    email: patientForm.email ? patientForm.email.value.trim() : undefined
                };

                await apiRequest('/patients', { method: 'POST', body: JSON.stringify(payload) });
                showMessage('staffMessage', 'Patient added successfully!', true);
                setTimeout(() => window.location.href = 'staff-patients.html', 1500);
            } catch (err) {
                showMessage('staffMessage', err.message);
                document.querySelector('button[type="submit"]').disabled = false;
            }
        });
    }

    // 8. ADD APPOINTMENT FORM (staff-appointment-form.html)
    const apptForm = document.getElementById('appointmentForm');
    if (apptForm) {
        const patientSelect = document.getElementById('appointmentPatient');
        const doctorSelect = document.getElementById('appointmentDoctor');
        const serviceSelect = document.getElementById('appointmentService');

        // Load Patients and Doctors dropdowns
        Promise.all([apiRequest('/patients'), apiRequest('/clinic/catalog')])
            .then(([patients, catalog]) => {
                patientSelect.innerHTML = '<option value="">Select a patient</option>';
                patients.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p._id;
                    opt.textContent = `${p.firstName} ${p.lastName}`;
                    patientSelect.appendChild(opt);
                });

                doctorSelect.innerHTML = '<option value="">Select a doctor</option>';
                window.clinicCatalog = catalog;
                catalog.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.doctor;
                    opt.textContent = c.doctor;
                    doctorSelect.appendChild(opt);
                });
            });

        doctorSelect.addEventListener('change', () => {
            serviceSelect.innerHTML = '<option value="">Select a service</option>';
            const match = window.clinicCatalog.find(c => c.doctor === doctorSelect.value);
            if (match) {
                match.services.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    serviceSelect.appendChild(opt);
                });
                serviceSelect.disabled = false;
            } else {
                serviceSelect.disabled = true;
            }
        });

        apptForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            document.querySelector('button[type="submit"]').disabled = true;
            try {
                const payload = {
                    patientId: apptForm.patient.value,
                    doctor: apptForm.doctor.value,
                    service: apptForm.service.value,
                    date: apptForm.date.value,
                    time: apptForm.time.value
                };
                await apiRequest('/appointments', { method: 'POST', body: JSON.stringify(payload) });
                showMessage('staffMessage', 'Appointment created!', true);
                setTimeout(() => window.location.href = 'staff-appointments.html', 1500);
            } catch (err) {
                showMessage('staffMessage', err.message);
                document.querySelector('button[type="submit"]').disabled = false;
            }
        });
    }
});