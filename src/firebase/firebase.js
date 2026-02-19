import admin from "firebase-admin";

let firebaseApp = null;
let isFirebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK
 * Gracefully handles missing credentials - server can start without Firebase configured
 */
try {
  // Try to load service account from file (if exists)
  let serviceAccount = null;
  
  try {
    // Try to import service account file
    const serviceAccountModule = await import("./rehotra-d4d85-firebase-adminsdk-fbsvc-f3ea4e3a34.js");
    serviceAccount = serviceAccountModule.serviceAccount;
    
    // Check if service account is valid (has required fields)
    if (!serviceAccount || !serviceAccount.project_id || typeof serviceAccount.project_id !== 'string' || serviceAccount.project_id.trim() === '') {
      serviceAccount = null; // Mark as invalid
    }
  } catch (importError) {
    // File doesn't exist or invalid - skip Firebase initialization
    console.warn('[Firebase] Service account file not found or invalid:', importError.message);
    serviceAccount = null;
  }

  // Initialize Firebase only if service account is available and valid
  if (serviceAccount && serviceAccount.project_id && typeof serviceAccount.project_id === 'string' && serviceAccount.project_id.trim() !== '') {
    // Check if Firebase app already exists
    if (admin.apps.length === 0) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      isFirebaseInitialized = true;
      console.log('[Firebase] Initialized successfully');
    } else {
      firebaseApp = admin.app();
      isFirebaseInitialized = true;
      console.log('[Firebase] Using existing app');
    }
  } else {
    console.warn('[Firebase] Service account not found or invalid. Firebase features (push notifications) will be disabled.');
    console.warn('[Firebase] To enable: Add valid Firebase service account JSON file at src/firebase/rehotra-d4d85-firebase-adminsdk-fbsvc-f3ea4e3a34.js');
    console.warn('[Firebase] The service account object must contain: project_id, private_key, client_email');
  }
} catch (error) {
  console.warn('[Firebase] Failed to initialize:', error.message);
  console.warn('[Firebase] Push notifications will be disabled. Server will continue without Firebase.');
}

// Export admin and initialization status
export default admin;
export { isFirebaseInitialized };