const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public')); 

mongoose.connect('mongodb://127.0.0.1:27017/clinicDB')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));


// Patient 
const patientSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true },
  contactNumber: { type: String, required: true }
});

const Patient = mongoose.model('Patient', patientSchema);

// Appointment 
const appointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  appointmentDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: { type: String, default: 'Pending' }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);


app.post('/api/patients', async (req, res) => {
  try {
    const patient = new Patient(req.body);
    await patient.save();
    res.status(201).json(patient);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/patients', async (req, res) => {
  try {
    const { name } = req.query;
    const filter = name ? { fullName: { $regex: name, $options: 'i' } } : {};
    const patients = await Patient.find(filter);
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const appointment = new Appointment(req.body);
    await appointment.save();
    res.status(201).json(appointment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find().populate('patientId');
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/appointments/:id/done', async (req, res) => {
  try {
    const updated = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status: 'Done' },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/appointments/today/count', async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const count = await Appointment.countDocuments({
      appointmentDate: { $gte: startOfDay, $lte: endOfDay }
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});