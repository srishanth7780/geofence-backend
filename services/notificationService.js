const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const emailjs = require('@emailjs/nodejs');

async function sendEmail(to, subject, html) {
  try {
    const serviceId = process.env.EMAILJS_SERVICE_ID || 'service_xey5zfs';
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    console.log(`[Email Service] Sending email to <${to}> via EmailJS...`);

    const result = await emailjs.send(
      serviceId,
      templateId,
      {
        to_email: to,
        subject: subject,
        message_html: html,
        to_name: to,
        from_name: 'GeoFence Alert System',
      },
      {
        publicKey,
        privateKey,
      }
    );

    console.log(`[Email Service] Email sent successfully via EmailJS:`, result.text);
    return result;
  } catch (error) {
    console.error(`[Email Service] Failed to send email to <${to}> via EmailJS:`, error.message || error);
    return null;
  }
}

async function notifyAlert(device, geofence, alert) {
  const msg = `🚨 GEOFENCE ALERT\nDevice: ${device.name}\nEvent: ${alert.alert_type} — ${geofence.name}\nTime: ${new Date().toLocaleString()}\nLocation: https://maps.google.com/?q=${alert.lat},${alert.lng}`;
  let sentChannel = 'none';

  const recipientEmail = device.email || 'ksrisri97@gmail.com';

  if (recipientEmail) {
    const info = await sendEmail(recipientEmail, `Geofence ${alert.alert_type} — ${device.name}`, `<pre>${msg}</pre>`);
    if (info) {
      sentChannel = 'email';
    }
  }



  return sentChannel;
}

module.exports = { notifyAlert, sendEmail };