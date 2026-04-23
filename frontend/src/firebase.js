import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace with your Firebase project configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

console.log("Firebase Config Initialization...");

const missing = Object.entries(firebaseConfig)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.error("CRITICAL: Missing Firebase environment variables:", missing.join(", "));
  console.log("Check your frontend/.env file and ensure it contains VITE_ prefixes.");
}

let app;
try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    console.log("Firebase App initialized successfully.");
  } else {
    console.warn("Firebase App initialization skipped due to missing config.");
  }
} catch (error) {
  console.error("Error during Firebase initialization:", error);
}

export const auth = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();
export const db = app ? getFirestore(app) : null;

export default app;
