  // TEMP CODE !! FOR TESTING ONLY


document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = '/api';

  const showMessage = (elementId, text, isSuccess = false) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    if (isSuccess) {
      el.classList.add('success');
    } else {
      el.classList.remove('success');
    }
  };

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('registerName').value.trim();
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value;

      try {
        const res = await fetch(`${API_BASE}/auth/patient/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showMessage('registerMessage', 'Account created! Redirecting to login...', true);
        setTimeout(() => window.location.href = 'patient-login.html', 1500);
      } catch (err) {
        showMessage('registerMessage', err.message);
      }
    });
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      try {
        const res = await fetch(`${API_BASE}/auth/patient/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        sessionStorage.setItem('currentPatient', JSON.stringify(data.patient));
        window.location.href = 'patient-dashboard.html';
      } catch (err) {
        showMessage('loginMessage', err.message);
      }
    });
  }

  const staffForm = document.getElementById('staffForm');
  if (staffForm) {
    staffForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const staffId = document.getElementById('staffId').value.trim();
      const password = document.getElementById('staffPassword').value;

      try {
        const res = await fetch(`${API_BASE}/auth/staff/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffId, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        sessionStorage.setItem('currentStaff', JSON.stringify(data.staff));
        window.location.href = 'staff-dashboard.html';
      } catch (err) {
        showMessage('staffMessage', err.message);
      }
    });
  }

  const requestForm = document.getElementById('requestForm');
  if (requestForm) {
    const doctorSelect = document.getElementById('requestDoctor');
    const serviceSelect = document.getElementById('requestService');

    let catalog = [];

    fetch(`${API_BASE}/clinic/catalog`)
      .then(res => res.json())
      .then(data => {
        catalog = data;
        doctorSelect.innerHTML = '<option value="">Select a doctor</option>';
        catalog.forEach((item) => {
          const opt = document.createElement('option');
          opt.value = item.doctor;
          opt.textContent = item.doctor;
          doctorSelect.appendChild(opt);
        });
      })
      .catch(() => {
        doctorSelect.innerHTML = '<option value="">Failed to load doctors</option>';
      });

    doctorSelect.addEventListener('change', () => {
      const selectedDoctor = doctorSelect.value;
      if (!selectedDoctor) {
        serviceSelect.innerHTML = '<option value="">Choose a doctor first</option>';
        serviceSelect.disabled = true;
        return;
      }

      const match = catalog.find(item => item.doctor === selectedDoctor);
      serviceSelect.innerHTML = '<option value="">Select a service</option>';
      if (match) {
        match.services.forEach(srv => {
          const opt = document.createElement('option');
          opt.value = srv;
          opt.textContent = srv;
          serviceSelect.appendChild(opt);
        });
        serviceSelect.disabled = false;
      }
    });

    requestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPatient = JSON.parse(sessionStorage.getItem('currentPatient'));
      if (!currentPatient) {
        showMessage('requestMessage', 'Please log in first before requesting an appointment.');
        return;
      }

      const payload = {
        patientId: currentPatient.id,
        doctor: doctorSelect.value,
        service: serviceSelect.value,
        date: document.getElementById('requestDate').value,
        time: document.getElementById('requestTime').value,
        notes: document.getElementById('requestNotes').value
      };

      try {
        const res = await fetch(`${API_BASE}/appointments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showMessage('requestMessage', 'Appointment requested successfully!', true);
        requestForm.reset();
        serviceSelect.disabled = true;
      } catch (err) {
        showMessage('requestMessage', err.message);
      }
    });
  }
});