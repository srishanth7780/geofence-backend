const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const cron       = require('node-cron');
const { db }     = require('./firebaseAdmin');
const { generateDailyReport } = require('./services/aiService');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/devices',    require('./routes/devices'));
app.use('/api/geofences',  require('./routes/geofences'));
app.use('/api/location',   require('./routes/location'));
app.use('/api/alerts',     require('./routes/alerts'));

// CSV export endpoint
app.get('/api/export/alerts.csv', async (req, res) => {
  try {
    const snap = await db.collection('alerts').get();
    const alerts = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        device: data.device_name || '',
        geofence: data.geofence_name || '',
        alert_type: data.alert_type || '',
        priority: data.priority || '',
        lat: data.lat || '',
        lng: data.lng || '',
        notified_via: data.notified_via || '',
        triggered_at: data.triggered_at ? (data.triggered_at.toDate ? data.triggered_at.toDate().toISOString() : data.triggered_at) : ''
      };
    });
    
    // Sort descending by triggered_at
    alerts.sort((a, b) => new Date(b.triggered_at) - new Date(a.triggered_at));
    
    const headers = ['id', 'device', 'geofence', 'alert_type', 'priority', 'lat', 'lng', 'notified_via', 'triggered_at'].join(',');
    const rows = alerts.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=alerts.csv');
    res.send(`${headers}\n${rows}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error exporting alerts CSV');
  }
});

// Daily AI report cron — runs at 11:55 PM every day
cron.schedule('55 23 * * *', async () => {
  console.log('[CRON] Generating daily AI report...');
  try {
    const since = new Date(); since.setHours(0,0,0,0);
    const snap = await db.collection('alerts').where('triggered_at', '>=', since).get();
    const alerts = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        triggered_at: data.triggered_at ? (data.triggered_at.toDate ? data.triggered_at.toDate().toISOString() : data.triggered_at) : null
      };
    });
    
    if (alerts.length) {
      alerts.sort((a, b) => new Date(b.triggered_at) - new Date(a.triggered_at));
      const report = await generateDailyReport(alerts);
      
      const todayStr = since.toISOString().split('T')[0];
      await db.collection('ai_reports').doc(todayStr).set({
        report_date: todayStr,
        summary: report.summary,
        suggestions: report.suggestions || [],
        anomalies: report.anomalies || null,
        model_used: 'gemini-1.5-flash',
        generated_at: new Date()
      });
    }
    console.log('[CRON] Daily report done.');
  } catch (e) { console.error('[CRON] Error:', e); }
});

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || "4000";
app.listen(PORT, () => console.log(`Geofence API running on :${PORT}`));