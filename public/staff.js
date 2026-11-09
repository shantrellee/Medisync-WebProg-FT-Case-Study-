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

    // 2. SIDEBAR: show who is signed in + LOGOUT LOGIC
    if (isProtected) {
        const staffLabel = staffData.staffId || staffData.name || 'Staff';
        const signedInEl = document.querySelector('.side-foot p');
        if (signedInEl) signedInEl.textContent = `Signed in as ${staffLabel}`;

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
        let activeFilter = '';
        let openApptId = null;

        const applyFilter = () => {
            renderAppointments(activeFilter ? allAppointments.filter(a => a.status === activeFilter) : allAppointments);
        };

        const loadAppointments = async() => {
            try {
                allAppointments = await apiRequest('/appointments');
                applyFilter();
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
                tr.innerHTML = `
          <td>${escapeHTML(a.patientId?.firstName)} ${escapeHTML(a.patientId?.lastName)}<br><small>${escapeHTML(a.patientId?.phone)}</small></td>
          <td>${escapeHTML(a.doctor)}</td>
          <td>${escapeHTML(a.service)}</td>
          <td>${escapeHTML(a.date)} ${escapeHTML(a.time)}</td>
          <td><span class="badge badge-${a.status.toLowerCase()}">${escapeHTML(a.status)}</span></td>
          <td><button class="btn btn-outline btn-sm view-btn" data-id="${a._id}">View</button></td>
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

                activeFilter = e.currentTarget.dataset.filter || '';
                applyFilter();
            });
        });

        // ----- Appointment details modal -----
        const modal = document.getElementById('staffApptModal');
        const errorBox = document.getElementById('smError');
        const reasonBox = document.getElementById('smReasonBox');
        const reasonInput = document.getElementById('smReasonInput');

        const openModal = (a) => {
            openApptId = a._id;
            errorBox.hidden = true;
            reasonInput.value = '';

            const patientName = `${a.patientId?.firstName || ''} ${a.patientId?.lastName || ''}`.trim() || 'Unknown patient';

            document.getElementById('smId').textContent = String(a._id || '').slice(-8).toUpperCase();
            document.getElementById('smPatient').textContent = patientName;
            document.getElementById('smContact').textContent = (a.patientId && a.patientId.phone) ? a.patientId.phone : 'N/A';
            document.getElementById('smDoctor').textContent = a.doctor;
            document.getElementById('smService').textContent = a.service;
            document.getElementById('smDate').textContent = `${a.date} at ${a.time}`;
            document.getElementById('smStatus').innerHTML = `<span class="badge badge-${a.status.toLowerCase()}">${escapeHTML(a.status)}</span>`;
            document.getElementById('smNotes').textContent = a.notes ? `"${a.notes}"` : 'None provided';

            // Details that depend on the status
            const isClosedWithReason = a.status === 'Cancelled';
            const savedRemarks = a.remarks || 'No remarks provided';

            document.getElementById('smReasonLabel').hidden = !(isClosedWithReason && savedRemarks);
            const reasonText = document.getElementById('smReason');
            reasonText.hidden = !(isClosedWithReason && savedRemarks);
            reasonText.textContent = savedRemarks;

            if (a.status === 'Done' && a.completedAt) {
                const finishedTime = new Date(a.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                document.getElementById('smStatus').innerHTML += ` <small style="color: var(--muted); margin-left: 8px;">(Finished at ${finishedTime})</small>`;
            }

            // Reason box is only for statuses staff can still act on
            const canAct = a.status === 'Pending' || a.status === 'Confirmed';
            reasonBox.hidden = !canAct;

            let buttons = '';
            if (a.status === 'Pending') {
                buttons = `
                    <button type="button" class="btn btn-solid btn-sm status-btn" data-status="Confirmed">Confirm</button>
                    <button type="button" class="btn btn-danger btn-sm status-btn" data-status="Cancelled">Cancel request</button>`;
            } else if (a.status === 'Confirmed') {
                buttons = `
                    <button type="button" class="btn btn-solid btn-sm status-btn" data-status="Done">Mark as done</button>
                    <button type="button" class="btn btn-danger btn-sm status-btn" data-status="Cancelled">Cancel appointment</button>`;
            }

            document.getElementById('smActions').innerHTML = `
                <div class="modal-actions-left">${buttons}</div>
                <button type="button" class="btn btn-outline" id="closeStaffModal">Close</button>`;

            modal.hidden = false;
        };

        apptBody.addEventListener('click', (e) => {
            const btn = e.target.closest('.view-btn');
            if (!btn) return;
            const a = allAppointments.find(x => x._id === btn.getAttribute('data-id'));
            if (a) openModal(a);
        });

        modal.addEventListener('click', async(e) => {
            // Close (button or click on the dark backdrop)
            if (e.target.id === 'closeStaffModal' || e.target === modal) {
                modal.hidden = true;
                return;
            }

            const btn = e.target.closest('.status-btn');
            if (!btn) return;

            const status = btn.dataset.status;
            const remarksText = reasonInput.value.trim();

            if (status === 'Done') {
                const appt = allAppointments.find(x => x._id === openApptId);
                // Combine date and time (e.g., "2026-11-09T14:00")
                const apptDateTime = new Date(`${appt.date}T${appt.time}`);
                const now = new Date();

                if (apptDateTime > now) {
                    errorBox.textContent = 'You cannot mark an appointment as Done before its scheduled time.';
                    errorBox.hidden = false;
                    return; // Stop the function completely
                }
            }

            // Rejecting or cancelling needs a reason so the patient knows why
            if ((status === 'Rejected' || status === 'Cancelled') && !remarksText) {
                errorBox.textContent = `Please enter a reason before you ${status === 'Rejected' ? 'reject this request' : 'cancel this appointment'}.`;
                errorBox.hidden = false;
                reasonInput.focus();
                return;
            }

            btn.disabled = true;
            try {
                const body = remarksText ? { status, remarks: remarksText } : { status };
                await apiRequest(`/appointments/${openApptId}/status`, { method: 'PATCH', body: JSON.stringify(body) });
                modal.hidden = true;
                showMessage('staffMessage', `Appointment marked as ${status}.`, true);
                loadAppointments();
            } catch (err) {
                errorBox.textContent = err.message;
                errorBox.hidden = false;
                btn.disabled = false;
            }
        });

        loadAppointments();
    }

    // 6. PATIENTS DIRECTORY (staff-patients.html)
    const patientBody = document.getElementById('patientTableBody');
    if (patientBody) {
        let allPatients = [];
        let openPatientId = null;
        let openPatientName = '';

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

                // Remember who is open (used by Edit / Delete) and point Edit at the form
                openPatientId = patient._id || patient.id;
                openPatientName = displayName;
                document.getElementById('editPatientLink').href = `staff-patient-form.html?id=${encodeURIComponent(openPatientId)}`;

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

        // Delete patient
        const deletePatientBtn = document.getElementById('deletePatientBtn');
        if (deletePatientBtn) {
            deletePatientBtn.addEventListener('click', async() => {
                if (!openPatientId) return;
                if (!confirm(`Delete ${openPatientName}? This cannot be undone.`)) return;

                deletePatientBtn.disabled = true;
                try {
                    await apiRequest(`/patients/${openPatientId}`, { method: 'DELETE' });
                    document.getElementById('patientModal').hidden = true;
                    showMessage('staffMessage', `${openPatientName} was deleted.`, true);
                    loadPatients();
                } catch (err) {
                    alert(err.message);
                } finally {
                    deletePatientBtn.disabled = false;
                }
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

    // ADD / EDIT PATIENT FORM (staff-patient-form.html)
    // Restrict birthdate inputs to today or past dates
    const birthDateInputs = document.querySelectorAll('input[name="birthDate"], #birthDate');
    if (birthDateInputs.length > 0) {
        const today = new Date().toLocaleDateString('en-CA');
        birthDateInputs.forEach(input => input.setAttribute('max', today));
    }
    (async() => {
        const patientForm = document.getElementById('patientForm');

        if (patientForm) {
            const editId = new URLSearchParams(window.location.search).get('id');
            const submitBtn = document.getElementById('patientSubmit');

            // EDIT MODE
            if (editId) {
                document.title = 'Edit patient | Medisync Staff';
                document.getElementById('formTitle').textContent = 'Edit patient';
                submitBtn.textContent = 'Save changes';

                // Disable button while loading patient details
                submitBtn.disabled = true;

                try {
                    // Retrieve existing patients
                    const list = await apiRequest('/patients');

                    // Find selected patient
                    const p = list.find(x =>
                        x._id === editId || x.id === editId
                    );

                    if (!p) {
                        showMessage('staffMessage', 'Patient not found.');
                        return;
                    }

                    // Pre-fill form with existing details
                    patientForm.firstName.value = p.firstName || '';
                    patientForm.lastName.value = p.lastName || '';

                    patientForm.birthDate.value = p.birthDate ?
                        new Date(p.birthDate).toISOString().split('T')[0] :
                        '';

                    patientForm.sex.value = p.sex || '';
                    patientForm.contact.value = p.phone || '';
                    patientForm.email.value = p.email || '';
                    patientForm.address.value = p.address || '';

                } catch (err) {
                    showMessage('staffMessage', err.message);
                    return;
                }

                // Enable button after loading
                submitBtn.disabled = false;
            }

            // FORM SUBMISSION
            patientForm.addEventListener('submit', async(e) => {
                e.preventDefault();

                submitBtn.disabled = true;

                try {
                    const payload = {
                        firstName: patientForm.firstName.value.trim(),
                        lastName: patientForm.lastName.value.trim(),
                        birthDate: patientForm.birthDate.value,
                        sex: patientForm.sex.value,
                        phone: patientForm.contact.value.replace(/[\s-]/g, ''),
                        address: patientForm.address.value.trim(),
                        email: patientForm.email.value.trim()
                    };

                    if (editId) {
                        // UPDATE EXISTING PATIENT
                        await apiRequest(`/patients/${editId}`, {
                            method: 'PUT',
                            body: JSON.stringify(payload)
                        });

                        showMessage(
                            'staffMessage',
                            'Patient updated successfully!',
                            true
                        );

                    } else {
                        // ADD NEW PATIENT
                        await apiRequest('/patients', {
                            method: 'POST',
                            body: JSON.stringify(payload)
                        });

                        showMessage(
                            'staffMessage',
                            'Patient added successfully!',
                            true
                        );
                    }

                    // Return to patient list
                    setTimeout(() => {
                        window.location.href = 'staff-patients.html';
                    }, 1500);

                } catch (err) {
                    showMessage('staffMessage', err.message);
                    submitBtn.disabled = false;
                }
            });
        }
    })();



    // 8. ADD APPOINTMENT FORM (staff-appointment-form.html)
    const apptForm = document.getElementById('appointmentForm');
    if (apptForm) {
        const patientSelect = document.getElementById('appointmentPatient');
        const doctorSelect = document.getElementById('appointmentDoctor');
        const serviceSelect = document.getElementById('appointmentService');
        const dateInput = document.getElementById('appointmentDate');
        const timeSelect = document.getElementById('appointmentTime');

        // No past dates, and only real time slots
        dateInput.min = todayLocal();
        populateTimeSlots(timeSelect, dateInput.value);
        dateInput.addEventListener('change', () => populateTimeSlots(timeSelect, dateInput.value));

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
            const match = (window.clinicCatalog || []).find(c => c.doctor === doctorSelect.value);
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

            if (apptForm.date.value < todayLocal()) {
                showMessage('staffMessage', 'Please choose today or a future date.');
                return;
            }
            if (isSunday(apptForm.date.value)) {
                showMessage('staffMessage', 'The clinic is closed on Sundays. Please choose Monday to Saturday.');
                return;
            }

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