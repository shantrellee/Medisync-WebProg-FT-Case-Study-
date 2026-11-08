require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clinicDB';

// ----------------------
// Schemas & Models Matching Your Definitions
// ----------------------
const patientSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
  lastName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  password: { type: String },
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
appointmentSchema.index(
  { doctor: 1, date: 1, time: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'Cancelled' } } }
);

const Appointment = mongoose.model('Appointment', appointmentSchema);

const catalogSchema = new mongoose.Schema({
  doctor: { type: String, required: true, trim: true },
  services: [{ type: String, required: true }]
}, { timestamps: true });

const Catalog = mongoose.model('Catalog', catalogSchema);

// ----------------------
// Seed Runner
// ----------------------
async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB. Populating initial data...');

    // Clear existing data across all collections
    await Promise.all([
      Patient.deleteMany({}),
      Staff.deleteMany({}),
      Appointment.deleteMany({}),
      Catalog.deleteMany({})
    ]);

    // 1. Seed Clinic Catalog
    await Catalog.insertMany([
      {
        doctor: 'Dr. Sarah Salvatore (General Medicine)',
        services: ['General Consultation', 'Routine Physical', 'Prescription Refill']
      },
      {
        doctor: 'Dr. Tom Avery (Pediatrics)',
        services: ['Well-Child Checkup', 'Immunization', 'Pediatric Consultation']
      },
      {
        doctor: 'Dr. Elena Gilbert (Dentistry)',
        services: ['Dental Cleaning', 'Tooth Extraction', 'Dental Checkup']
      }
    ]);
    console.log('✓ Clinic Catalog loaded');

    // 2. Seed Default Staff Accounts
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@medisync.com';
    const adminPass = process.env.ADMIN_PASSWORD || 'password123';
    const hashedAdminPassword = await bcrypt.hash(adminPass, 10);

    await Staff.create([
      {
        staffId: 'STAFF001',
        name: 'Clinic Staff Admin',
        email: adminEmail,
        password: hashedAdminPassword,
        role: 'admin'
      },
      {
        staffId: 'STAFF002',
        name: 'Nurse Jedi',
        email: 'nurse.jedi@medisync.com',
        password: hashedAdminPassword,
        role: 'staff'
      }
    ]);
    console.log(`✓ Default Staff Accounts Created (STAFF001 / ${adminEmail})`);

    // 3. Seed Patients (Registered + Walk-in with valid Philippine phone format)
    const patientPass = await bcrypt.hash('password123', 10);
    const seededPatients = await Patient.create([
      {
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        email: 'juan.delacruz@example.com',
        password: patientPass,
        birthDate: '1998-04-12',
        sex: 'Male',
        phone: '09171234567',
        address: 'Brgy. San Vicente, Tarlac City'
      },
      {
        firstName: 'Maria',
        lastName: 'Clara',
        email: 'maria.clara@example.com',
        password: patientPass,
        birthDate: '2001-09-24',
        sex: 'Female',
        phone: '+639289876543',
        address: 'Brgy. Maliwalo, Tarlac City'
      },
      {
        firstName: 'Carlos',
        lastName: 'Reyes',
        birthDate: '1985-11-03',
        sex: 'Male',
        phone: '09081122334',
        address: 'San Isidro, Tarlac City'
      }
    ]);
    console.log(`✓ Seeded ${seededPatients.length} Patients (Registered & Walk-in)`);

    // 4. Seed Appointments
    await Appointment.create([
      {
        patientId: seededPatients[0]._id,
        doctor: 'Dr. Sarah Salvatore (General Medicine)',
        service: 'General Consultation',
        date: '2026-11-09',
        time: '09:00',
        notes: 'Routine checkup and blood pressure reading.',
        status: 'Confirmed'
      },
      {
        patientId: seededPatients[1]._id,
        doctor: 'Dr. Elena Gilbert (Dentistry)',
        service: 'Dental Cleaning',
        date: '2026-11-10',
        time: '10:30',
        notes: 'First-time dental cleaning.',
        status: 'Pending'
      },
      {
        patientId: seededPatients[2]._id,
        doctor: 'Dr. Tom Avery (Pediatrics)',
        service: 'Well-Child Checkup',
        date: '2026-11-09',
        time: '14:00',
        notes: 'Walk-in checkup for mild cough.',
        status: 'Done'
      },
      {
        patientId: seededPatients[0]._id,
        doctor: 'Dr. Sarah Salvatore (General Medicine)',
        service: 'Prescription Refill',
        date: '2026-11-12',
        time: '11:00',
        notes: 'Patient requested reschedule.',
        status: 'Cancelled'
      }
    ]);
    console.log('✓ Seeded initial appointments');

    console.log('\nDatabase initialization complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();