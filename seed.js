require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Defining the schema in server.js to ensure consistency and avoid duplication
const staffSchema = new mongoose.Schema({
    staffId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true }
}, { timestamps: true });

const Staff = mongoose.model('Staff', staffSchema);

(async() => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clinicDB');

        // Deletes the old plain-text account if you accidentally made one
        await Staff.deleteMany({ staffId: 'STAFF001' });

        // Hashes the password securely
        const hashedPassword = await bcrypt.hash('password123', 10);

        await Staff.create({
            staffId: 'STAFF001',
            name: 'Nurse Jedi',
            email: 'admin@medisync.com',
            password: hashedPassword
        });

        console.log('Staff account securely created!');
        process.exit(0);
    } catch (error) {
        console.error('Error creating staff account:', error);
        process.exit(1);
    }
})();