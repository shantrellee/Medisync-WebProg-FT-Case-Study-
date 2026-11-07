require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clinicDB';

const staffSchema = new mongoose.Schema({
    staffId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'staff' }
});

const catalogSchema = new mongoose.Schema({
    doctor: { type: String, required: true },
    services: [{ type: String, required: true }]
});

const Staff = mongoose.model('Staff', staffSchema);
const Catalog = mongoose.model('Catalog', catalogSchema);

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB. Populating initial data...');

        // 1. Seed Catalog
        await Catalog.deleteMany({});
        await Catalog.insertMany([
            {
                doctor: "Dr. Sarah Salvatore (General Medicine)",
                services: ["General Consultation", "Routine Physical", "Prescription Refill"]
            },
            {
                doctor: "Dr. Tom Avery (Pediatrics)",
                services: ["Well-Child Checkup", "Immunization", "Pediatric Consultation"]
            },
            {
                doctor: "Dr. Elena Gilbert (Dentistry)",
                services: ["Dental Cleaning", "Tooth Extraction", "Dental Checkup"]
            }
        ]);
        console.log('✓ Clinic Catalog loaded');

        // 2. Seed Default Staff (STAFF001 / admin@medisync.com / password123)
        await Staff.deleteMany({
            $or: [{ staffId: 'STAFF001' }, { email: 'admin@medisync.com' }]
        });

        const hashedPassword = await bcrypt.hash('password123', 10);
        await Staff.create({
            staffId: 'STAFF001',
            name: 'Clinic Staff Admin',
            email: 'admin@medisync.com',
            password: hashedPassword,
            role: 'staff'
        });
        console.log('✓ Default Staff Account Created (ID: STAFF001 / Email: admin@medisync.com / Pass: password123)');

        console.log('Database initialization complete.');
        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
}

seed();