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

async function deletePatient(patientId) {
  // Retrieve the logged-in staff information
  const currentStaff = JSON.parse(
    sessionStorage.getItem('currentStaff') || '{}'
  );


  const adminStaffId = currentStaff.staffId;


  if (!adminStaffId) {
    alert('Authentication required. Staff ID missing. Please log in again.');
    return;
  }
  const confirmDelete = confirm(
    'Are you sure you want to permanently delete this patient and all their appointments?'
  );

  if (!confirmDelete) return;
  try {
    const response = await fetch(`/api/patients/${patientId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-staff-id': adminStaffId
      },
      body: JSON.stringify({ adminStaffId })
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.error || 'Failed to delete patient.');
      return;
    }
    alert(data.message);
    location.reload();
  } catch (err) {
    console.error('Failed to execute delete request:', err);
    alert('An error occurred while connecting to the server.');
  }
}


let selectedPatientId = null; // Track currently viewed patient

function openPatientDetailsModal(patient) {
  selectedPatientId = patient._id;

  // Set edit link target
  const editLink = document.getElementById('editPatientLink');
  if (editLink) {
    editLink.href = `staff-patient-form.html?id=${patient._id}`;
  }

  // Display the modal
  const modal = document.getElementById('patientModal'); // adjust ID if different
  if (modal) modal.style.display = 'block';
}

// Bind click listener once when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  const deleteBtn = document.getElementById('deletePatientBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (!selectedPatientId) {
        alert('No patient selected.');
        return;
      }
      deletePatient(selectedPatientId);
    });
  }
});

document.addEventListener('DOMContentLoaded', async () => {
    console.log('My Profile JavaScript is running!');
    const profileForm = document.getElementById('profileForm');

    if (!profileForm) return;

    // Get logged-in patient information from localStorage
    const rawCurrentPatient = localStorage.getItem('currentPatient');

    if (!rawCurrentPatient) {
        alert('Please log in first to view your profile.');
        window.location.href = 'patient-login.html';
        return;
    }

    let patientData;

    try {
        patientData = JSON.parse(rawCurrentPatient);
    } catch (err) {
        console.error('Invalid currentPatient data in localStorage:', err);
        alert('Unable to read your login information. Please log in again.');
        return;
    }

    // Check possible ID property names
    const patientId =
        patientData.id ||
        patientData._id ||
        patientData.patientId;

    console.log('Stored patient data:', patientData);
    console.log('Patient ID:', patientId);

    if (!patientId) {
        console.error('Patient ID is missing from localStorage.');
        alert('Patient ID not found. Please log in again.');
        return;
    }

    // Helper function for filling form fields
    const setVal = (id, value) => {
        const element = document.getElementById(id);

        if (element) {
            element.value = value ?? '';
        } else {
            console.error(`Element with ID "${id}" not found.`);
        }
    };

    // LOAD PATIENT PROFILE
    try {
    const response = await fetch(`/api/patients/${patientId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to retrieve patient profile.');
    }

    const patient = await response.json();

    console.log('Patient information retrieved:', patient);

    setVal('profileFirstName', patient.firstName);
    setVal('profileLastName', patient.lastName);
    setVal('profileBirthDate', patient.birthDate);
    setVal('profileSex', patient.sex);
    setVal('profileEmail', patient.email);
    setVal('profileContact', patient.phone);

} catch (err) {
    console.error('Error auto-filling profile:', err);
    alert(err.message);
}

    // SAVE PROFILE CHANGES
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const rawContact = document.getElementById('profileContact').value.trim();
        const cleanedPhone = rawContact.replace(/[\s-]/g, '');

        const payload = {
            firstName: document.getElementById('profileFirstName').value.trim(),
            lastName: document.getElementById('profileLastName').value.trim(),
            birthDate: document.getElementById('profileBirthDate').value,
            sex: document.getElementById('profileSex').value,
            email: document.getElementById('profileEmail').value.trim(),
            phone: cleanedPhone
        };

        try {
            const token = localStorage.getItem('token');

            const updateRes = await fetch(`/api/patients/${patientId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });
            console.log('Update response status:', updateRes.status);

            const result = await updateRes.json();
            console.log('Update response:', result);
            if (!updateRes.ok) {
                alert(result.error || 'Failed to update profile.');
                return;
            }

            // Update locally stored patient information
            localStorage.setItem('currentPatient', JSON.stringify({
                ...patientData,
                id: patientId,
                firstName: payload.firstName,
                lastName: payload.lastName
            }));

            alert('Profile updated successfully!');

        } catch (err) {
            console.error('Error saving profile changes:', err);
            alert('Network error while saving changes.');
        }
    });
});

// CHANGE PASSWORD FORM
const passwordForm = document.getElementById('passwordForm');

if (passwordForm) {
    console.log('Password form detected.');

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        console.log('Change password form submitted.');

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        const message = document.getElementById('passwordMessage');
        const submitButton = passwordForm.querySelector('button[type="submit"]');

        if (newPassword.length < 6) {
            message.textContent = 'New password must be at least 6 characters.';
            return;
        }

        if (newPassword !== confirmPassword) {
            message.textContent = 'New passwords do not match.';
            return;
        }

        try {
            submitButton.disabled = true;
            message.textContent = 'Updating password...';

            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Please log in again.');
            }

            const response = await fetch('/api/patients/change-password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to change password.');
            }

           alert('Password updated successfully!');

                passwordForm.reset();
                message.textContent = '';
        } catch (error) {
            console.error('Change password error:', error);
            message.textContent = error.message;

        } finally {
            submitButton.disabled = false;
        }
    });

} else {
    console.log('Password form not found.');
}



