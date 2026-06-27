const express = require('express');
const router  = express.Router();
const { db }  = require('../firebaseAdmin');
const { isInsideGeofence, determinePriority } = require('../services/geofenceEngine');
const { notifyAlert } = require('../services/notificationService');

router.post('/', async (req, res) => {
  const { device_id, lat, lng, accuracy_m } = req.body;
  if (!device_id || !lat || !lng)
    return res.status(400).json({ error: 'device_id, lat, lng required' });

  try {
    // 1. Find device by device_id field
    const devSnap = await db.collection('devices').where('device_id', '==', device_id).limit(1).get();
    if (devSnap.empty) return res.status(404).json({ error: 'Device not found' });
    const devDoc = devSnap.docs[0];
    const device = { id: devDoc.id, ...devDoc.data() };

    // 2. Fetch active geofences
    const geoSnap = await db.collection('geofences').where('is_active', '==', true).get();
    const geofences = geoSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const alertsCreated = [];
    const prevStatus = device.status;

    for (const geofence of geofences) {
      const nowInside = isInsideGeofence(parseFloat(lat), parseFloat(lng), geofence);



      // 4. Detect boundary crossing
      const prevInside = prevStatus === 'inside';
      const crossedIn  = nowInside  && !prevInside && prevStatus !== 'unknown';
      const crossedOut = !nowInside && prevInside;

      if (crossedIn || crossedOut) {
        const alertType = crossedIn ? 'ENTRY' : 'EXIT';
        const priority  = determinePriority(device, alertType);
        const message   = `${device.name} ${alertType === 'ENTRY' ? 'entered' : 'exited'} ${geofence.name}`;

        // 5. Save alert to Firestore
        const alertRef = await db.collection('alerts').add({
          device_id:    devDoc.id,
          device_name:  device.name,
          geofence_id:  geofence.id,
          geofence_name:geofence.name,
          alert_type:   alertType,
          priority,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          message,
          notified_via: 'none',
          is_read:      false,
          triggered_at: new Date(),
        });

        // 6. Send notifications
        const channel = await notifyAlert(device, geofence, { id: alertRef.id, alert_type: alertType, lat, lng });
        await alertRef.update({ notified_via: channel });

        alertsCreated.push({ id: alertRef.id, alertType, priority });
      }
    }

    // 7. Update device status
    const anyInside = geofences.some(g => isInsideGeofence(parseFloat(lat), parseFloat(lng), g));
    await devDoc.ref.update({
      last_lat:  parseFloat(lat),
      last_lng:  parseFloat(lng),
      last_seen: new Date(),
      status:    anyInside ? 'inside' : 'outside',
    });

    res.json({ success: true, alerts_created: alertsCreated.length, alerts: alertsCreated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/location/logs
router.delete('/logs', async (req, res) => {
  try {
    const { device_id, geofence_id } = req.query;
    let queryRef = db.collection('location_logs');
    if (device_id) {
      queryRef = queryRef.where('device_id', '==', device_id);
    }
    if (geofence_id) {
      queryRef = queryRef.where('geofence_id', '==', geofence_id);
    }
    const snap = await queryRef.get();
    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    res.json({ success: true, deleted_count: snap.size });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;