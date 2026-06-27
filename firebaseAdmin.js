const fs = require('fs');
const path = require('path');

let db;
let admin = null;

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(__dirname, 'serviceAccountKey.json');

let hasServiceAccount = false;
let credential;

if (serviceAccountJson) {
  try {
    admin = require('firebase-admin');
    credential = admin.credential.cert(JSON.parse(serviceAccountJson));
    hasServiceAccount = true;
  } catch (err) {
    console.error('[Firebase Admin] Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON:', err.message);
    process.exit(1);
  }
} else if (fs.existsSync(serviceAccountPath)) {
  try {
    admin = require('firebase-admin');
    credential = admin.credential.cert(require(serviceAccountPath));
    hasServiceAccount = true;
  } catch (err) {
    console.warn('[Firebase Admin] Failed to load service account file:', err.message);
  }
}

if (hasServiceAccount) {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'geofence-alert-system-488b8';
  admin.initializeApp({
    projectId,
    credential
  });
  const { getFirestore } = require('firebase-admin/firestore');
  db = getFirestore();
  console.log('[Firebase Admin] Initialized successfully with service account.');
} else {
  console.warn(
    '[Firebase Admin] No service account file found. Falling back to Firebase Client SDK.'
  );
  const firebase = require('firebase/compat/app');
  require('firebase/compat/firestore');
  
  const projectId = process.env.FIREBASE_PROJECT_ID || 'geofence-alert-system-488b8';
  const apiKey = process.env.FIREBASE_API_KEY || 'REDACTED_FIREBASE_API_KEY';
  const app = firebase.initializeApp({
    projectId,
    apiKey
  });
  db = app.firestore();
}

module.exports = { db, admin };