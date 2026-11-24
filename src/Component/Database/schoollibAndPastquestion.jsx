// Datanase/SchoolResults.jsx

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";


const firebaseConfig = {
apiKey: import.meta.env.VITE_LPQ_API_KEY,
  authDomain: import.meta.env.VITE_LPQ_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_LPQ_PROJECT_ID,
  storageBucket: import.meta.env.VITE_LPQ_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_LPQ_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_LPQ_APP_ID,
  measurementId: import.meta.env.VITE_LPQ_MEASUREMENT_ID,
};

// Initialize Firebase with a unique name: "schoolResultsApp"
const schoolapp = initializeApp(firebaseConfig, "schoolLibAndPastQuestionsApp"); // ⭐️ FIX IS HERE
const analytics = getAnalytics(schoolapp);
const schoollpq = getFirestore(schoolapp);

export { schoollpq };