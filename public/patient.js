const patientData = JSON.parse(sessionStorage.getItem('currentPatient') || localStorage.getItem('currentPatient') || '{}');
document.addEventListener('DOMContentLoaded', () => {
            const userRole = localStorage.getItem('role');
            const token = localStorage.getItem('token');
            const patientData = JSON.parse(sessionStorage.getItem('currentPatient') || localStorage.getItem('currentPatient') || '{}');
            const displayName = patientData.firstName || patientData.name || 'Patient';

            // 1. PAGE GUARD: Redirect to login if accessing a protected page without a token
            const isProtected = document.querySelector('.user-btn') !== null;
            if (isProtected && (!token || userRole !== 'patient')) {
                window.location.href = 'patient-login.html';
                return;
            }

            // 2. HEADER LOGIC: Set name and handle logout (Crash-proofed for older accounts)
            if (isProtected) {
                const userNameEl = document.getElementById('userName');
                if (userNameEl) userNameEl.textContent = displayName;

                const userInitialEl = document.getElementById('userInitial');
                if (userInitialEl) userInitialEl.textContent = displayName.charAt(0).toUpperCase();

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
                        localStorage.setItem('currentPatient', JSON.stringify(data.patient));
                        window.location.href = 'patient-home.html';
                    } catch (err) {
                        showMessage('loginMessage', err.message);
                        document.querySelector('button[type="submit"]').disabled = false;
                    }
                });
            }

            // 4. REGISTER FORM
            // Restrict birthdate inputs to today or past dates
            const birthDateInputs = document.querySelectorAll('input[name="birthDate"], #birthDate');
            if (birthDateInputs.length > 0) {
                const today = new Date().toLocaleDateString('en-CA');
                birthDateInputs.forEach(input => input.setAttribute('max', today));
            }
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
                            phone: registerForm.contact.value.replace(/[\s-]/g, ''),
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

            // HOME page patientr: greeting + appointment reminder (patient-home.html)
            const greetingEl = document.getElementById('greeting');
            if (greetingEl) {
                greetingEl.textContent = `Hello, ${displayName}!`;
            }

            const reminderCard = document.getElementById('reminderCard');
            if (reminderCard) {
                const loadReminder = async() => {
                    try {
                        const appts = await apiRequest('/patients/me/appointments');
                        const today = todayLocal();

                        // Confirmed appointments from today onward, soonest first
                        const upcoming = appts
                            .filter(a => a.status === 'Confirmed' && a.date >= today)
                            .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
                        const next = upcoming[0];

                        const titleEl = document.getElementById('reminderTitle');
                        const detailsEl = document.getElementById('reminderDetails');

                        if (!next) {
                            titleEl.textContent = 'You have no upcoming appointments.';
                            detailsEl.textContent = 'Request one and the clinic will confirm your schedule.';
                        } else if (next.date === today) {
                            titleEl.textContent = `You have an appointment at ${formatTime12(next.time)} today.`;
                            detailsEl.textContent = `${next.service} with ${next.doctor}`;
                        } else {
                            const niceDate = new Date(`${next.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            titleEl.textContent = `Your next appointment is on ${niceDate} at ${formatTime12(next.time)}.`;
                            detailsEl.textContent = `${next.service} with ${next.doctor}`;
                        }
                        reminderCard.hidden = false;
                    } catch (err) {
                        reminderCard.hidden = true; // fail quietly, the greeting and button still work
                    }
                };
                loadReminder();
            }

            // DOCTORS PAGE (patient-doctors.html)
            const doctorGrid = document.getElementById('doctorGrid');
            if (doctorGrid) {
                apiRequest('/clinic/catalog').then(data => {
                            doctorGrid.innerHTML = '';
                            if (!data.length) {
                                doctorGrid.innerHTML = '<p class="row-note">No doctors available yet.</p>';
                                return;
                            }

                            data.map(getDoctorInfo).forEach(d => {
                                        const card = document.createElement('article');
                                        card.className = 'doctor-card';

                                        // Photo (initials ng name if doctor has no photo yet)
                                        const photo = document.createElement('div');
                                        photo.className = 'doctor-photo';
                                        if (d.photo) {
                                            const img = document.createElement('img');
                                            img.src = d.photo;
                                            img.alt = `Photo of ${d.name}`;
                                            photo.appendChild(img);
                                        } else {
                                            const initials = d.name.replace(/^Dr\.?\s*/i, '').split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase();
                                            photo.textContent = initials || 'Dr';
                                        }

                                        const serviceLinks = d.services.map(s =>
                                            `<a class="chip" href="patient-request-appointment.html?doctor=${encodeURIComponent(d.key)}&service=${encodeURIComponent(s)}">${escapeHTML(s)}</a>`
                                        ).join('');

                                        const info = document.createElement('div');
                                        info.className = 'doctor-info';
                                        info.innerHTML = `
                    <h2>${escapeHTML(d.name)}</h2>
                    <span class="doctor-specialty">${escapeHTML(d.specialty)}</span>
                    <p class="doctor-about">${escapeHTML(d.description) || 'Description coming soon.'}</p>
                    ${d.education ? `<p class="doctor-edu"><strong>Education:</strong> ${escapeHTML(d.education)}</p>` : ''}
                    <h3>Services</h3>
                    <div class="chip-list">${serviceLinks || '<span class="row-note">No services listed.</span>'}</div>
                    <a class="btn btn-solid btn-sm doctor-cta" href="patient-request-appointment.html?doctor=${encodeURIComponent(d.key)}">Request with ${escapeHTML(d.name)}</a>
                `;
 
                card.appendChild(photo);
                card.appendChild(info);
                doctorGrid.appendChild(card);
            });
        }).catch(() => {
            doctorGrid.innerHTML = '';
            showMessage('doctorMessage', 'Could not load doctors. Please try again.');
        });
    }
 
    // 5. REQUEST APPOINTMENT FORM
    const requestForm = document.getElementById('requestForm');
    if (requestForm) {
        const specialtySelect = document.getElementById('requestSpecialty');
        const doctorSelect = document.getElementById('requestDoctor');
        const serviceSelect = document.getElementById('requestService');
        const dateInput = document.getElementById('requestDate');
        const timeSelect = document.getElementById('requestTime');
 
        let doctors = [];
 
        // No past dates, real time slots
        dateInput.min = todayLocal();
        populateTimeSlots(timeSelect, dateInput.value);
        dateInput.addEventListener('change', () => populateTimeSlots(timeSelect, dateInput.value));
 
        const resetServices = () => {
            serviceSelect.innerHTML = '<option value="">Choose a doctor first</option>';
            serviceSelect.disabled = true;
        };
 
        // Doctor list follows chosen specialty
        const renderDoctorOptions = () => {
            const spec = specialtySelect.value;
            doctorSelect.innerHTML = '<option value="">Select a doctor</option>';
            doctors.filter(d => !spec || d.specialty === spec).forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.key;
                opt.textContent = d.key;
                doctorSelect.appendChild(opt);
            });
            resetServices();
        };
 
        // Services follow chosen doctor
        const renderServiceOptions = () => {
            const match = doctors.find(d => d.key === doctorSelect.value);
            if (!match) { resetServices(); return; }
            serviceSelect.innerHTML = '<option value="">Select a service</option>';
            match.services.forEach(srv => {
                const opt = document.createElement('option');
                opt.value = srv;
                opt.textContent = srv;
                serviceSelect.appendChild(opt);
            });
            serviceSelect.disabled = false;
        };
 
        apiRequest('/clinic/catalog').then(data => {
            doctors = data.map(getDoctorInfo);
 
            const specialties = [...new Set(doctors.map(d => d.specialty))].sort();
            specialtySelect.innerHTML = '<option value="">All specialties</option>';
            specialties.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                specialtySelect.appendChild(opt);
            });
            renderDoctorOptions();
 
            // Coming from the Doctors page. Pre-fill the doctor / service they clicked.
            const params = new URLSearchParams(window.location.search);
            const wantedDoctor = doctors.find(d => d.key === params.get('doctor'));
            if (wantedDoctor) {
                specialtySelect.value = wantedDoctor.specialty;
                renderDoctorOptions();
                doctorSelect.value = wantedDoctor.key;
                renderServiceOptions();
                const wantedService = params.get('service');
                if (wantedService && wantedDoctor.services.includes(wantedService)) {
                    serviceSelect.value = wantedService;
                }
            }
        }).catch(() => {
            doctorSelect.innerHTML = '<option value="">Failed to load doctors</option>';
        });
 
        specialtySelect.addEventListener('change', renderDoctorOptions);
        doctorSelect.addEventListener('change', renderServiceOptions);
 
        requestForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            const submitBtn = requestForm.querySelector('button[type="submit"]');
 
            if (!requestForm.doctor.value || !requestForm.service.value || !requestForm.date.value || !requestForm.time.value) {
                showMessage('requestMessage', 'Please choose a doctor, a service, a date, and a time.');
                return;
            }
            if (requestForm.date.value < todayLocal()) {
                showMessage('requestMessage', 'Please choose today or a future date.');
                return;
            }
            if (isSunday(requestForm.date.value)) {
                showMessage('requestMessage', 'The clinic is closed on Sundays. Please choose Monday to Saturday.');
                return;
            }
 
            submitBtn.disabled = true;
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
                renderDoctorOptions();
                populateTimeSlots(timeSelect, '');
            } catch (err) {
                showMessage('requestMessage', err.message);
            } finally {
                submitBtn.disabled = false;
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
 
                // Service first, then doctor (matches the table header order in patient-dashboard.html)
                tr.innerHTML = `
                    <td>${escapeHTML(a.service)}</td>
                    <td>${escapeHTML(a.doctor)}</td>
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
            } catch (err) {
                tableBody.innerHTML = '<tr><td colspan="5" class="empty">Error loading data.</td></tr>';
            }
        };
 
        // Filter dropdown (attached once, not on every reload)
        const filterDropdown = document.getElementById('apptFilter');
        if (filterDropdown) {
            filterDropdown.addEventListener('change', (e) => {
                const selectedStatus = e.target.value;
                renderTable(selectedStatus ? currentAppts.filter(a => a.status === selectedStatus) : currentAppts);
            });
        }
 
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
                document.getElementById('modalApptNotes').textContent = a.notes ? `"${a.notes}"` : 'None provided';
 
                // Reason (shown when the clinic rejected or cancelled and left a reason)
                const reasonText = a.remarks || (a.status === 'Cancelled' ? 'No reason provided for cancellation.' : '');
                document.getElementById('modalReasonLabel').hidden = !reasonText;
                const reasonEl = document.getElementById('modalApptReason');
                reasonEl.hidden = !reasonText;
                reasonEl.textContent = reasonText;
 
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