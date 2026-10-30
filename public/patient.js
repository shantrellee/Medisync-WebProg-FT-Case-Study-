//temporary file (para lang magwork ung chevroon ng patient (to be moved sa script.js if want niu)
// Patient Dashboard Dropdown Menu & Logout
const menuBtn = document.getElementById("userMenuBtn");
const userMenu = document.getElementById("userMenu");

if (menuBtn && userMenu) {
    const setMenu = (open) => {
        userMenu.hidden = !open;
        menuBtn.setAttribute("aria-expanded", open);
    };
    menuBtn.addEventListener("click", () => setMenu(userMenu.hidden));
    document.addEventListener("click", (e) => {
        if (!menuBtn.contains(e.target) && !userMenu.contains(e.target)) setMenu(false);
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { setMenu(false);
            menuBtn.focus(); }
    });
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "index.html";
    });
}

// Fetch and display patient appointments
async function loadPatientDashboard() {
    const token = localStorage.getItem('token');
    const patientId = localStorage.getItem('patientId');
    if (!token || !patientId) return;

    try {
        const response = await fetch(`http://localhost:3000/api/patients/${patientId}/appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch appointments');
        const appointments = await response.json();

        // Update Stats
        document.getElementById('statTotal').textContent = appointments.length;
        document.getElementById('statUpcoming').textContent = appointments.filter(a => a.status === 'Confirmed').length;
        document.getElementById('statPending').textContent = appointments.filter(a => a.status === 'Pending').length;
        document.getElementById('statDone').textContent = appointments.filter(a => a.status === 'Done').length;

        // Populate Table
        const tableBody = document.getElementById('appointmentTableBody');
        tableBody.innerHTML = '';

        if (appointments.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="empty">No appointments found.</td></tr>';
            return;
        }

        appointments.forEach(appt => {
            const row = document.createElement('tr');
            row.innerHTML = `
        <td>${appt.doctor}</td>
        <td>${appt.service}</td>
        <td>${appt.date} ${appt.time}</td>
        <td><span class="status-${appt.status.toLowerCase()}">${appt.status}</span></td>
        <td><button class="btn btn-outline btn-sm">View</button></td>
      `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        document.getElementById('appointmentTableBody').innerHTML = '<tr><td colspan="5" class="empty">Error loading data.</td></tr>';
    }
}

if (document.getElementById('appointmentTableBody')) {
    loadPatientDashboard();
}