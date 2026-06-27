const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generateDailyReport(alerts) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
      throw new Error('API key is invalid or not configured.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const summary = alerts.map(a =>
      `[${a.triggered_at}] Device "${a.device_name}" ${a.alert_type} geofence "${a.geofence_name}" (Priority: ${a.priority})`
    ).join('\n');

    const prompt = `You are a fleet operations analyst. Below are today's geofence alerts:\n\n${summary}\n\nProvide:\n1. A concise summary (2–3 sentences)\n2. Top 3 actionable recommendations for the operations team\n3. Any anomalies or patterns to flag\n\nRespond in JSON: { "summary": "...", "suggestions": ["...", "...", "..."], "anomalies": "..." }`;

    const result   = await model.generateContent(prompt);
    const text     = result.response.text();
    const match    = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('No JSON object found in response');
    }
    const clean    = match[0].trim();
    return JSON.parse(clean);
  } catch (err) {
    console.warn('[AI Service] Gemini API failed, using fallback report generator:', err.message);
    
    // Fallback: Generate a simple summary dynamically from the actual alerts
    const totalAlerts = alerts.length;
    const entryCount = alerts.filter(a => a.alert_type === 'ENTRY').length;
    const exitCount = alerts.filter(a => a.alert_type === 'EXIT').length;
    const criticalCount = alerts.filter(a => a.priority === 'critical').length;
    
    const devicesList = [...new Set(alerts.map(a => a.device_name))];
    const geofencesList = [...new Set(alerts.map(a => a.geofence_name))];
    
    return {
      summary: `[Demo Fallback] Today saw ${totalAlerts} total geofence events (${entryCount} entries, ${exitCount} exits) across ${devicesList.length} devices. Operations occurred within ${geofencesList.length} monitored geofences.`,
      suggestions: [
        `Review the ${criticalCount} critical alert(s) immediately.`,
        `Examine device paths for ${devicesList.slice(0, 3).join(', ')} to ensure route compliance.`,
        `Verify geofence boundary rules for ${geofencesList.slice(0, 2).join(', ')}.`
      ],
      anomalies: criticalCount > 0 
        ? `Flagged ${criticalCount} critical event(s). Gemini API key is currently unconfigured or invalid, using local rule-based analysis fallback.` 
        : `No significant anomalies detected. Gemini API key is currently unconfigured or invalid, using local rule-based analysis fallback.`
    };
  }
}

module.exports = { generateDailyReport };