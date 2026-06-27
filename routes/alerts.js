const express = require('express');
const router  = express.Router();
const { db }  = require('../firebaseAdmin');
const { generateDailyReport } = require('../services/aiService');

// GET /api/alerts — paginated list
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, unread_only } = req.query;
    let queryRef = db.collection('alerts').orderBy('triggered_at', 'desc');
    
    if (unread_only === 'true') {
      queryRef = queryRef.where('is_read', '==', false);
    }
    
    const limitNum = Number(limit);
    const offsetNum = Number(offset);
    
    const snap = await queryRef.limit(limitNum + offsetNum).get();
    let alerts = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        triggered_at: data.triggered_at ? (data.triggered_at.toDate ? data.triggered_at.toDate().toISOString() : data.triggered_at) : null
      };
    });
    
    if (offsetNum > 0) {
      alerts = alerts.slice(offsetNum);
    }
    res.json(alerts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/alerts/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    await db.collection('alerts').doc(req.params.id).update({ is_read: true });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/ai-report — generate AI daily summary
router.post('/ai-report', async (req, res) => {
  try {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    // Note: Since Firestore queries with multiple conditions/ordering can require indexes,
    // a simple date filter works out of the box. We can sort in memory to be safe.
    const snap = await db.collection('alerts').where('triggered_at', '>=', since).get();
    const alerts = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        triggered_at: data.triggered_at ? (data.triggered_at.toDate ? data.triggered_at.toDate().toISOString() : data.triggered_at) : null
      };
    });
    if (!alerts.length) {
      return res.status(400).json({ error: 'No geofence alerts recorded today. Please trigger entry or exit events first to view the AI Operations Report.' });
    }
    
    // Sort descending by triggered_at
    alerts.sort((a, b) => new Date(b.triggered_at) - new Date(a.triggered_at));
    
    const report = await generateDailyReport(alerts);

    // Save report to Firestore collection 'ai_reports'
    const todayStr = since.toISOString().split('T')[0];
    await db.collection('ai_reports').doc(todayStr).set({
      report_date: todayStr,
      summary: report.summary,
      suggestions: report.suggestions || [],
      anomalies: report.anomalies || null,
      model_used: 'gemini-1.5-flash',
      generated_at: new Date()
    });
    
    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/alerts/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.collection('alerts').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;