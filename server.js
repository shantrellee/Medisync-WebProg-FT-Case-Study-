const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({
    path: path.join(__dirname, '.env')
});
const fs = require('fs');

console.log('Project directory:', __dirname);
console.log('ENV file exists:', fs.existsSync(path.join(__dirname, '.env')));
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { requireAuth, requireRole } = require('./middleware/auth');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Fail startup if JWT_SECRET is missing
if (!process.env.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET loaded: false");
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Rate limiters to prevent brute-force attacks
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many login attempts, please try again later' }
});
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Too many accounts created, please try again later' }
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clinicDB';
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB (clinicDB)'))
    .catch(err => console.error('MongoDB connection error:', err));

const patientSchema = new mongoose.Schema({
    firstName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true }, // sparse allows staff to add walk-ins without email
    password: { type: String }, // Optional for walk-ins
    birthDate: { type: String, required: true },
    sex: { type: String, enum: ['Male', 'Female'], required: true },
    phone: { type: String, required: true, match: /^(09|\+639)\d{9}$/ },
    address: { type: String, trim: true, default: '' }
}, { timestamps: true });

const Patient = mongoose.model('Patient', patientSchema);

const staffSchema = new mongoose.Schema({
    staffId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, default: 'staff' }
}, { timestamps: true });

const Staff = mongoose.model('Staff', staffSchema);

const appointmentSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: String, required: true },
    service: { type: String, required: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    time: { type: String, required: true }, // Format: HH:MM
    notes: { type: String, trim: true, maxlength: 300, default: '' },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Done', 'Cancelled'],
        default: 'Pending'
    }
}, { timestamps: true });

appointmentSchema.index({ patientId: 1, date: 1 });
// Partial unique index: Allows same doctor/date/time if the previous appt was cancelled
appointmentSchema.index({ doctor: 1, date: 1, time: 1 }, { unique: true, partialFilterExpression: { status: { $ne: 'Cancelled' } } });

const Appointment = mongoose.model('Appointment', appointmentSchema);

const catalogSchema = new mongoose.Schema({
    doctor: { type: String, required: true, trim: true },
    services: [{ type: String, required: true }]
}, { timestamps: true });

const Catalog = mongoose.model('Catalog', catalogSchema);


// --- HELPERS ---
const getManilaToday = () => {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
    return formatter.format(new Date());
};

// --- PUBLIC ROUTES ---
app.get('/health', (req, res) => res.json({ status: 'ok', time: getManilaToday() }));

app.get('/api/clinic/catalog', async(req, res, next) => {
    try {
        const catalog = await Catalog.find().select('-_id doctor services');
        res.json(catalog);
    } catch (error) { next(error); }
});

// --- AUTHENTICATION ROUTES ---
app.post('/api/auth/patient/register', registerLimiter, async(req, res, next) => {
    try {
        const { firstName, lastName, email, password, birthDate, sex, phone, address } = req.body;

        if (!firstName || !lastName || !email || !password || !birthDate || !sex || !phone) {
            return res.status(400).json({ error: 'Please provide all required fields' });
        }

        if (new Date(birthDate) > new Date()) return res.status(400).json({ error: 'Birth date cannot be in the future' });
        if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/.test(password)) {
            return res.status(400).json({ error: 'Password must be at least 8 chars with 1 letter and 1 number.' });
        }

        const existing = await Patient.findOne({ email });
        if (existing) return res.status(409).json({ error: 'Email is already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const patient = new Patient({ firstName, lastName, email, password: hashedPassword, birthDate, sex, phone, address });
        await patient.save();

        res.status(201).json({
            message: 'Account created successfully',
            patient: { id: patient._id, firstName: patient.firstName, lastName: patient.lastName }
        });
    } catch (error) { next(error); }
});

app.post('/api/auth/patient/login', loginLimiter, async(req, res, next) => {
    try {
        const { email, password } = req.body;
        const patient = await Patient.findOne({ email });

        if (!patient || !patient.password || !(await bcrypt.compare(password, patient.password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: patient._id, role: 'patient' }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({
            message: 'Login successful',
            token,
            patient: { id: patient._id, firstName: patient.firstName, lastName: patient.lastName }
        });
    } catch (error) { next(error); }
});

app.post('/api/auth/staff/login', loginLimiter, async(req, res, next) => {
    try {
        const { staffId, password } = req.body;
        if (!staffId || !password) return res.status(400).json({ error: 'Staff ID and password are required' });

        const staff = await Staff.findOne({ $or: [{ staffId: staffId }, { email: staffId.toLowerCase() }] });

        if (!staff || !(await bcrypt.compare(password, staff.password))) {
            return res.status(401).json({ error: 'Invalid staff ID or password' });
        }

        const token = jwt.sign({ id: staff._id, role: 'staff' }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({
            message: 'Staff login successful',
            token,
            staff: { id: staff._id, staffId: staff.staffId, name: staff.name }
        });
    } catch (error) { next(error); }
});


// --- SHARED APPOINTMENT ROUTES ---

app.get('/api/appointments/availability', async(req, res, next) => {
    try {
        const { doctor, date } = req.query;
        if (!doctor || !date) return res.status(400).json({ error: 'Doctor and date required' });

        const booked = await Appointment.find({ doctor, date, status: { $ne: 'Cancelled' } }).select('time -_id');
        const bookedTimes = booked.map(b => b.time);

        // Generate 30 min slots 08:00 to 16:30
        const slots = [];
        for (let h = 8; h <= 16; h++) {
            slots.push(`${h.toString().padStart(2, '0')}:00`, `${h.toString().padStart(2, '0')}:30`);
        }

        const available = slots.filter(slot => !bookedTimes.includes(slot));
        res.json({ available });
    } catch (err) { next(err); }
});

app.post('/api/appointments', requireAuth, async(req, res, next) => {
    try {
        const { doctor, service, date, time, notes } = req.body;
        let patientId = req.body.patientId;

        // Enforce ownership: Patients can only book for themselves
        if (req.user.role === 'patient') {
            patientId = req.user.id;
        }

        if (!patientId || !doctor || !service || !date || !time) {
            return res.status(400).json({ error: 'Missing required appointment fields' });
        }
        if (new Date(date) < new Date(getManilaToday())) {
            return res.status(400).json({ error: 'Cannot book an appointment in the past' });
        }

        const existing = await Appointment.findOne({ doctor, date, time, status: { $ne: 'Cancelled' } });
        if (existing) return res.status(409).json({ error: 'This time slot is already booked.' });

        const appointment = new Appointment({ patientId, doctor, service, date, time, notes: notes || '' });
        await appointment.save();
        res.status(201).json({ message: 'Appointment requested successfully', appointment });
    } catch (error) { next(error); }
});


// --- PATIENT-ONLY ROUTES ---

app.get('/api/patients/me/appointments', requireAuth, requireRole('patient'), async(req, res, next) => {
    try {
        const appointments = await Appointment.find({ patientId: req.user.id }).sort({ date: 1, time: 1 });
        res.json(appointments);
    } catch (error) { next(error); }
});

app.patch('/api/appointments/:id/cancel-self', requireAuth, requireRole('patient'), async(req, res, next) => {
    try {
        const appt = await Appointment.findOne({ _id: req.params.id, patientId: req.user.id });
        if (!appt) return res.status(404).json({ error: 'Appointment not found' });
        if (appt.status === 'Done' || appt.status === 'Cancelled') {
            return res.status(400).json({ error: 'Cannot cancel a finalized appointment' });
        }

        appt.status = 'Cancelled';
        await appt.save();
        res.json(appt);
    } catch (error) { next(error); }
});


// --- STAFF-ONLY ROUTES ---

app.get('/api/appointments', requireAuth, requireRole('staff'), async(req, res, next) => {
    try {
        const appointments = await Appointment.find()
            .populate('patientId', 'firstName lastName email phone')
            .sort({ date: 1, time: 1 });
        res.json(appointments);
    } catch (error) { next(error); }
});

app.patch('/api/appointments/:id/status', requireAuth, requireRole('staff'), async(req, res, next) => {
    try {
        const { status } = req.body;
        const allowed = ['Pending', 'Confirmed', 'Done', 'Cancelled'];
        if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status provided' });

        const appt = await Appointment.findById(req.params.id);
        if (!appt) return res.status(404).json({ error: 'Appointment not found' });

        if (appt.status === 'Done' || appt.status === 'Cancelled') {
            return res.status(400).json({ error: 'Status is already final and cannot be changed' });
        }
        if (appt.status === 'Pending' && status === 'Done') {
            return res.status(400).json({ error: 'Appointments must be confirmed before marking as done' });
        }

        appt.status = status;
        await appt.save();
        res.json(appt);
    } catch (error) { next(error); }
});

app.get('/api/staff/stats', requireAuth, requireRole('staff'), async(req, res, next) => {
    try {
        const today = getManilaToday();
        const todayCount = await Appointment.countDocuments({ date: today, status: { $ne: 'Cancelled' } });
        const pendingCount = await Appointment.countDocuments({ status: 'Pending' });
        const patientCount = await Patient.countDocuments();
        res.json({ todayCount, pendingCount, patientCount, date: today });
    } catch (error) { next(error); }
});

app.get('/api/patients', requireAuth, requireRole('staff'), async(req, res, next) => {
    try {
        const patients = await Patient.find().sort({ lastName: 1 }).select('-password');
        res.json(patients);
    } catch (error) { next(error); }
});

app.post('/api/patients', requireAuth, requireRole('staff'), async(req, res, next) => {
    try {
        const { firstName, lastName, email, birthDate, sex, phone, address } = req.body;
        const patientData = { firstName, lastName, birthDate, sex, phone, address };
        if (email) patientData.email = email;

        const patient = new Patient(patientData);
        await patient.save();
        res.status(201).json(patient);
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: 'Email already exists' });
        next(error);
    }
});


app.delete('/api/patients/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Remove the patient
    const deletedPatient = await Patient.findByIdAndDelete(id);

    if (!deletedPatient) {
      return res.status(404).json({
        error: 'Patient not found or already deleted.'
      });
    }

    // Remove all appointments associated with this patient
    await Appointment.deleteMany({ patientId: id });

    res.json({
      message: "Patient ${deletedPatient.firstName} ${deletedPatient.lastName} and associated appointments were deleted successfully.",
      patientId: id
    });

  } catch (error) {
    console.error('Delete patient error:', error);

    res.status(500).json({
      error: 'Server error while deleting patient record.'
    });
  }
});

app.put('/api/patients/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow these patient fields to be updated
    const allowedFields = [
      'firstName',
      'lastName',
      'email',
      'birthDate',
      'sex',
      'phone',
      'address'
    ];

    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No valid fields provided for update.'
      });
    }

    // Update the patient
    const updatedPatient = await Patient.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedPatient) {
      return res.status(404).json({
        error: 'Patient not found.'
      });
    }

    res.json({
      message: 'Patient updated successfully.',
      patient: updatedPatient
    });

  } catch (error) {
    console.error('Update patient error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: error.message
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid patient ID.'
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Email is already being used by another patient.'
      });
    }

    res.status(500).json({
      error: 'Server error while updating patient record.'
    });
  }
});

// --- ERROR HANDLING ---

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
    });
});



app.listen(PORT, () => console.log(`Server running on port ${PORT}`));