// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";


const firebaseConfig = {
apiKey: import.meta.env.VITE_ADM_API_KEY,
  authDomain: import.meta.env.VITE_ADM_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_ADM_PROJECT_ID,
  storageBucket: import.meta.env.VITE_ADM_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_ADM_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_ADM_APP_ID,
  measurementId: import.meta.env.VITE_ADM_MEASUREMENT_ID,
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db };
