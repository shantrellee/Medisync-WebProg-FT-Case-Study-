const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '.env')
});
const fs = require('fs');

console.log('Project directory:', __dirname);
console.log('ENV file exists:', fs.existsSync(path.join(__dirname, '.env')));
console.log('JWT_SECRET loaded:', !!process.env.JWT_SECRET);
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const requireAuth = require('./middleware/auth');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clinicDB';
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB (clinicDB)'))
    .catch(err => console.error('MongoDB connection error:', err));


const patientSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, default: '' },
    address: { type: String, default: '' }
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
    notes: { type: String, trim: true, default: '' },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Done', 'Cancelled'],
        default: 'Pending'
    }
}, { timestamps: true });

appointmentSchema.index({ patientId: 1, date: 1 });
appointmentSchema.index({ doctor: 1, date: 1, time: 1 }, { unique: true });

const Appointment = mongoose.model('Appointment', appointmentSchema);

const catalogSchema = new mongoose.Schema({
    doctor: { type: String, required: true, trim: true },
    services: [{ type: String, required: true }]
}, { timestamps: true });

const Catalog = mongoose.model('Catalog', catalogSchema);


app.get('/api/clinic/catalog', async (req, res, next) => {
    try {
        const catalog = await Catalog.find().select('-_id doctor services');
        res.json(catalog);
    } catch (error) {
        next(error);
    }
});

// AUTHENTICATION ROUTES

app.post('/api/auth/patient/register', async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const existing = await Patient.findOne({ email });
        if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const patient = new Patient({ name, email, password: hashedPassword });
        await patient.save();

        res.status(201).json({
            message: 'Account created successfully',
            patient: { id: patient._id, name: patient.name, email: patient.email }
        });
    } catch (error) {
        next(error);
    }
});

// Patient Login
app.post('/api/auth/patient/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const patient = await Patient.findOne({ email });

        if (!patient || !(await bcrypt.compare(password, patient.password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: patient._id, role: 'patient' },
            process.env.JWT_SECRET || 'fallback_secret_key',
            { expiresIn: '8h' }
        );

        res.json({
            message: 'Login successful',
            token,
            patient: { id: patient._id, name: patient.name, email: patient.email }
        });
    } catch (error) {
        next(error);
    }
});

// Staff Login
app.post('/api/auth/staff/login', async (req, res, next) => {
    try {
        const { staffId, password } = req.body;
        if (!staffId || !password) {
            return res.status(400).json({ error: 'Staff ID and password are required' });
        }

        const staff = await Staff.findOne({
            $or: [{ staffId: staffId }, { email: staffId.toLowerCase() }]
        });

        if (!staff || !(await bcrypt.compare(password, staff.password))) {
            return res.status(401).json({ error: 'Invalid staff ID or password' });
        }

        const token = jwt.sign(
            { id: staff._id, role: 'staff' },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            message: 'Staff login successful',
            token,
            staff: { id: staff._id, staffId: staff.staffId, name: staff.name }
        });
    } catch (error) {
        next(error);
    }
});

// APPOINTMENT ROUTES

app.post('/api/appointments', requireAuth, async (req, res, next) => {
    try {
        const { patientId, doctor, service, date, time, notes } = req.body;

        if (!patientId || !doctor || !service || !date || !time) {
            return res.status(400).json({ error: 'Please provide all required appointment fields' });
        }

        const appointment = new Appointment({
            patientId,
            doctor,
            service,
            date,
            time,
            notes: notes || ''
        });

        await appointment.save();
        res.status(201).json({ message: 'Appointment requested successfully', appointment });
    } catch (error) {
        next(error);
    }
});

app.get('/api/patients/:patientId/appointments', requireAuth, async (req, res, next) => {
    try {
        const appointments = await Appointment.find({ patientId: req.params.patientId })
            .sort({ date: 1, time: 1 });
        res.json(appointments);
    } catch (error) {
        next(error);
    }
});

app.get('/api/appointments', requireAuth, async (req, res, next) => {
    try {
        const appointments = await Appointment.find()
            .populate('patientId', 'name email')
            .sort({ date: 1, time: 1 });
        res.json(appointments);
    } catch (error) {
        next(error);
    }
});

app.patch('/api/appointments/:id/status', requireAuth, async (req, res, next) => {
    try {
        const { status } = req.body;
        const updated = await Appointment.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: 'Appointment not found' });
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

app.get('/api/appointments/today/count', requireAuth, async (req, res, next) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const count = await Appointment.countDocuments({ date: today });

        res.json({ count, date: today });
    } catch (error) {
        console.error("Error fetching today's appointment count:", error);
        next(error);
    }
});

// PATIENT MANAGEMENT ROUTES

app.get('/api/patients/count', requireAuth, async (req, res, next) => {
    try {
        const count = await Patient.countDocuments();
        res.json({ count });
    } catch (error) {
        next(error);
    }
});

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});