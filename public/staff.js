
document.addEventListener('DOMContentLoaded', () => {

    // LOGOUT
    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            sessionStorage.clear();

            window.location.href = 'index.html';
        });
    }

    // LOAD STAFF DASHBOARD
    async function loadStaffDashboard() {

        const token = localStorage.getItem('token');

        // Check if user is logged in
        if (!token) {
            window.location.href = 'staff-login.html';
            return;
        }

        try {

            // GET ALL APPOINTMENTS
            const appointments = await apiRequest('/appointments');

            // GET TODAY'S APPOINTMENT COUNT
            const todayData = await apiRequest('/appointments/today/count');

            // GET TOTAL PATIENT COUNT
            const patientData = await apiRequest('/patients/count');


            // UPDATE DASHBOARD STATISTICS

            const statTodayEl = document.getElementById('statToday');

            if (statTodayEl) {
                statTodayEl.textContent = todayData.count;
            }

            const statPatientsEl = document.getElementById('statPatients');

            if (statPatientsEl) {
                statPatientsEl.textContent = patientData.count;
            }

            // COUNT PENDING APPOINTMENTS
            const pendingRequests = appointments.filter(
                appointment => appointment.status === 'Pending'
            );

            const statPendingEl = document.getElementById('statPending');

            if (statPendingEl) {
                statPendingEl.textContent = pendingRequests.length;
            }


            // FILTER TODAY'S APPOINTMENTS
            const today = todayData.date;

            const todaysAppointments = appointments.filter(
                appointment => appointment.date === today
            );


            // DISPLAY TODAY'S SCHEDULE
            const scheduleList = document.getElementById('scheduleList');

            if (scheduleList) {

                scheduleList.innerHTML = '';

                if (todaysAppointments.length === 0) {

                    scheduleList.innerHTML =
                        '<li class="empty">No appointments scheduled for today.</li>';

                } else {

                    todaysAppointments.forEach(appointment => {

                        const li = document.createElement('li');

                        const patientName = appointment.patientId
                            ? appointment.patientId.name
                            : 'Unknown Patient';

                        li.innerHTML = `
                            <strong>${appointment.time}</strong> -
                            ${patientName}
                            <span class="service-tag">
                                ${appointment.service}
                            </span>
                        `;

                        scheduleList.appendChild(li);

                    });

                }

            }

        } catch (error) {

            console.error('Error loading staff dashboard:', error);

            const scheduleList = document.getElementById('scheduleList');

            if (scheduleList) {
                scheduleList.innerHTML =
                    '<li class="empty">Error loading schedule.</li>';
            }

        }

    }


    // RUN DASHBOARD ONLY IF DASHBOARD ELEMENTS EXIST
    if (
        document.getElementById('scheduleList') ||
        document.getElementById('statToday')
    ) {
        loadStaffDashboard();
    }

});
