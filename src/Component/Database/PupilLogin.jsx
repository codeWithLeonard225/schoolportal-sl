// Datanase/SchoolResults.jsx

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";


const firebaseConfig = {
apiKey: import.meta.env.VITE_LOGIN_API_KEY,
  authDomain: import.meta.env.VITE_LOGIN_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_LOGIN_PROJECT_ID,
  storageBucket: import.meta.env.VITE_LOGIN_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_LOGIN_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_LOGIN_APP_ID,
  measurementId: import.meta.env.VITE_LOGIN_MEASUREMENT_ID,
};

// Initialize Firebase with a unique name: "schoolResultsApp"
const schoolapp = initializeApp(firebaseConfig, "pupilLogin"); // ⭐️ FIX IS HERE
const analytics = getAnalytics(schoolapp);
const pupilLoginFetch = getFirestore(schoolapp);

export { pupilLoginFetch };