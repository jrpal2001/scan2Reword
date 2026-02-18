import admin from "firebase-admin";
import { serviceAccount } from "./rehotra-d4d85-firebase-adminsdk-fbsvc-f3ea4e3a34.js";

// const serviceAccount = require("./art-of-living-1b75a-firebase-adminsdk-fbsvc-a08df784cc");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;