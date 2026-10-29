# Medisync - Clinic Patient & Appointment Management System

This project is a web-based clinic management system built with **Node.js**, **Express**, **MongoDB (Mongoose)**, and **HTML/CSS/JavaScript**.


## !! IMPORTANT !!

Before running the project, make sure the following are installed on your device:

1. **Node.js**: [Download Node.js](https://nodejs.org/)
2. **MongoDB Community Server**: [Download MongoDB](https://www.mongodb.com/try/download/community)
   > **Note:** Make sure **"Install MongoDB as a Service"** is checked during setup so MongoDB runs automatically in the background.
3. **MongoDB Compass** (Optional GUI to view records/database): [Download Compass](https://www.mongodb.com/try/download/compass)


## !! START UP GUIDE !!

### 1. Clone the Repository
Open your terminal (Command Prompt, PowerShell, or Git Bash) and clone the project:

```bash
git clone <YOUR_REPOSITORY_URL>
cd <PROJECT_FOLDER_NAME>

```

### 2. Install Project Dependencies

Install the required Node.js packages (`express`, `mongoose`, `cors`):

```bash
npm install

```

### 3. Verify Local MongoDB is Running

If you are on Windows and MongoDB was installed as a service, verify it is active:

```powershell
net start MongoDB

```

> **Note:** If it returns *"The requested service has already been started"*, MongoDB is already active. If you run MongoDB manually via terminal instead, open a separate terminal window and run:
> ```bash
> mongod
> 
> ```
> 
> 

### 4. Create the Initial Staff Account (One-Time Setup)

Because staff members cannot publicly self-register, seed a test staff record into MongoDB.

#### Option A: Using MongoDB Compass

1. Open MongoDB Compass and click **Connect** (`mongodb://localhost:27017`).
2. Click **Create Database**:
* **Database Name**: `clinicDB`
* **Collection Name**: `staffs`


3. Click into the `staffs` collection -> **Add Data** -> **Insert document**.
4. Paste the following JSON document and click **Insert**:

```json
{
  "staffId": "STAFF001",
  "name": "Nurse Jedi",
  "email": "admin@medisync.com",
  "password": "password123"
}

```

#### Option B: Using the MongoDB Shell (`mongosh`)

```javascript
mongosh
use clinicDB
db.staffs.insertOne({
  staffId: "STAFF001",
  name: "Nurse Jedi",
  email: "admin@medisync.com",
  password: "password123"
})

```

### 5. Start the Server

Run the application:

```bash
node server.js

```

You should see the following console output confirming a successful startup:

```text
Server running at http://localhost:3000
Connected to MongoDB (clinicDB)

```

---

## !! TESTING THE SYSTEM !! (tempo habang d pa connected html pages)

Copy and paste these directly on your browser:

* **Patient Registration**: `http://localhost:3000/patient-register.html`
* **Patient Login**: `http://localhost:3000/patient-login.html`
* **Staff Login**: `http://localhost:3000/staff-login.html`
* **Book Appointment**: `http://localhost:3000/patient-request-appointment.html`

> ⚠️ **Important:** Do not use VS Code's "Live Server" or "Run Without Debugging" on individual HTML files (which runs on port `5500` or `8080`). Always access the web app through port `3000` via `http://localhost:3000` so that Express routes and API calls function properly.

---

##  Demo Credentials

| Role | Identifier / Email | Password |
| --- | --- | --- |
| **Clinic Staff** | `STAFF001` or `admin@medisync.com` | `password123` |
| **Patient** | Register via `patient-register.html` | Custom password |

---

## Project Structure/Guide

```text
├── public/                              # Static assets served by Express
│   ├── index.html                       # Landing page
│   ├── patient-login.html               # Patient login portal
│   ├── patient-register.html            # Patient account registration
│   ├── patient-dashboard.html           # Patient appointments dashboard
│   ├── patient-request-appointment.html    # Appointment booking form
│   ├── staff-login.html                 # Clinic staff login portal
│   ├── staff-dashboard.html             # Staff schedule & patient queue
│   ├── script.js                        # API fetch calls & client form handlers
│   ├── patient.js                       # UI interaction scripts
│   └── styles.css                       # Global application styles
├── package.json                         # Project metadata & dependencies
├── server.js                            # Express backend & MongoDB schemas
└── README.md                            # Setup and execution guide

```

---

## API Refs Summary

* `POST /api/auth/patient/register` — Create patient account
* `POST /api/auth/patient/login` — Patient authentication
* `POST /api/auth/staff/login` — Staff authentication
* `GET /api/clinic/catalog` — List available doctors & services
* `POST /api/appointments` — Submit an appointment request
* `GET /api/appointments` — Fetch all appointments (staff view)
* `GET /api/patients/:patientId/appointments` — Fetch patient-specific appointments
* `PATCH /api/appointments/:id/status` — Update appointment status (`Pending`, `Confirmed`, `Done`, `Cancelled`)

```

```