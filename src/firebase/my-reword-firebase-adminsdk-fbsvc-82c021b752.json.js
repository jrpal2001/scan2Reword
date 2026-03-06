/**
 * Firebase Admin SDK credentials loaded from environment variables.
 * Set these in .env (never commit the real .env or private key).
 *
 * Required: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL
 * Optional: FIREBASE_PRIVATE_KEY_ID, FIREBASE_CLIENT_ID (from service account JSON)
 *
 * For FIREBASE_PRIVATE_KEY: paste the full key from JSON, using \n for newlines
 * (e.g. "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n")
 */

function getServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    return null;
  }

  // Restore actual newlines if stored as literal \n in .env
  const key = (privateKey || '').replace(/\\n/g, '\n');

  return {
    type: 'service_account',
    project_id: projectId,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
    private_key: key,
    client_email: clientEmail,
    client_id: process.env.FIREBASE_CLIENT_ID || '',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`,
    universe_domain: 'googleapis.com',
  };
}

export const serviceAccount = getServiceAccount();
