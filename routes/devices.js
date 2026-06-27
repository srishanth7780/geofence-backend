const express = require('express');
const router  = express.Router();
const { db }  = require('../firebaseAdmin');
const { sendEmail } = require('../services/notificationService');

router.get('/', async (_, res) => {
  try {
    const snap = await db.collection('devices').get();
    const devices = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    devices.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(devices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { device_id, name, type, owner_name, phone, email } = req.body;
    
    // Check if device already exists in Firestore by device_id
    const existing = await db.collection('devices').where('device_id', '==', device_id).limit(1).get();
    let device;
    if (!existing.empty) {
      const doc = existing.docs[0];
      device = { id: doc.id, ...doc.data() };
    } else {
      const docRef = await db.collection('devices').add({
        device_id,
        name,
        type: type || 'vehicle',
        owner_name: owner_name || null,
        phone: phone || null,
        email: email || null,
        status: 'unknown',
        last_seen: new Date().toISOString(),
        last_lat: null,
        last_lng: null,
        created_at: new Date()
      });
      device = {
        id: docRef.id,
        device_id,
        name,
        type: type || 'vehicle',
        owner_name: owner_name || null,
        phone: phone || null,
        email: email || null,
        status: 'unknown',
        last_seen: new Date().toISOString(),
        last_lat: null,
        last_lng: null
      };
    }

    // Send notification email about successful device registration
    const subject = `✅ Device Added Successfully — ${name}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; color: #1a202c;">
        <h2 style="color: #3182ce; margin-top: 0;">Device Registered Successfully</h2>
        <p>Hello,</p>
        <p>The following tracking device has been successfully registered to the <strong>GeoFence Alert System</strong>:</p>
        
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid #cbd5e0; margin: 15px 0;">
          <thead>
            <tr style="background-color: #f7fafc;">
              <th align="left" style="border: 1px solid #cbd5e0; color: #4a5568;">Field</th>
              <th align="left" style="border: 1px solid #cbd5e0; color: #4a5568;">Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #cbd5e0; font-weight: bold;">Device ID</td>
              <td style="border: 1px solid #cbd5e0;">${device_id}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e0; font-weight: bold;">Device Name</td>
              <td style="border: 1px solid #cbd5e0;">${name}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e0; font-weight: bold;">Type</td>
              <td style="border: 1px solid #cbd5e0; text-transform: capitalize;">${type || 'vehicle'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e0; font-weight: bold;">Owner Name</td>
              <td style="border: 1px solid #cbd5e0;">${owner_name || 'N/A'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e0; font-weight: bold;">Phone</td>
              <td style="border: 1px solid #cbd5e0;">${phone || 'N/A'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e0; font-weight: bold;">Email</td>
              <td style="border: 1px solid #cbd5e0;">${email || 'N/A'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e0; font-weight: bold;">Registration Time</td>
              <td style="border: 1px solid #cbd5e0;">${new Date().toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        
        <p>This device is now active and ready to log telemetry data and evaluate geofence boundaries.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #718096; margin-bottom: 0;">This is an automated notification from your GeoFence Alert System server. Please do not reply directly to this email.</p>
      </div>
    `;

    // Send to the device email if provided, fallback to the main test email
    const recipient = email || 'ksrisri97@gmail.com';
    await sendEmail(recipient, subject, htmlContent);



    res.status(201).json(device);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const batch = db.batch();

    // 1. Device ref
    const deviceRef = db.collection('devices').doc(id);
    batch.delete(deviceRef);

    // 2. Fetch and delete associated alerts
    const alertsSnap = await db.collection('alerts').where('device_id', '==', id).get();
    alertsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 3. Fetch and delete associated location logs
    const logsSnap = await db.collection('location_logs').where('device_id', '==', id).get();
    logsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;