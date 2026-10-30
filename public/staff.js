//temp file also

document.addEventListener("DOMContentLoaded", () => {
    // Staff Logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "index.html";
        });
    }

    // Fetch and display clinic schedule
    async function loadStaffDashboard() {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await fetch('http://localhost:3000/api/appointments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch data');
            const appointments = await response.json();

            // Filter for today (matching YYYY-MM-DD from the backend)
            const today = new Date().toISOString().split('T')[0];
            const todaysAppointments = appointments.filter(a => a.date === today);
            const pendingRequests = appointments.filter(a => a.status === 'Pending');

            // Update Stats
            document.getElementById('statToday').textContent = todaysAppointments.length;
            document.getElementById('statPending').textContent = pendingRequests.length;
            document.getElementById('statPatients').textContent = "---";

            // Populate Today's Schedule List
            const scheduleList = document.getElementById('scheduleList');
            scheduleList.innerHTML = '';

            if (todaysAppointments.length === 0) {
                scheduleList.innerHTML = '<li class="empty">No appointments scheduled for today.</li>';
                return;
            }

            todaysAppointments.forEach(appt => {
                const li = document.createElement('li');
                const patientName = appt.patientId ? appt.patientId.name : 'Unknown Patient';

                li.innerHTML = `
          <strong>${appt.time}</strong> - ${patientName} 
          <span class="service-tag">${appt.service}</span>
        `;
                scheduleList.appendChild(li);
            });
        } catch (error) {
            console.error('Error loading staff dashboard:', error);
            document.getElementById('scheduleList').innerHTML = '<li class="empty">Error loading schedule.</li>';
        }
    }

    if (document.getElementById('scheduleList')) {
        loadStaffDashboard();
    }
});