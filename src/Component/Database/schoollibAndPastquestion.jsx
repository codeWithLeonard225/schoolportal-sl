// Datanase/SchoolResults.jsx

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";


const firebaseConfig = {
  apiKey: "AIzaSyAcss-5kmMOsMrMj-I-qx7Yx50P0XrBayI",
  authDomain: "myschoolhublibarypastquestion.firebaseapp.com",
  projectId: "myschoolhublibarypastquestion",
  storageBucket: "myschoolhublibarypastquestion.firebasestorage.app",
  messagingSenderId: "29315692621",
  appId: "1:29315692621:web:4edd11bb0b684e54c6c404",
  measurementId: "G-Q5P8H81JW4"
};

// Initialize Firebase with a unique name: "schoolResultsApp"
const schoolapp = initializeApp(firebaseConfig, "schoolLibAndPastQuestionsApp"); // ⭐️ FIX IS HERE
const analytics = getAnalytics(schoolapp);
const schoollpq = getFirestore(schoolapp);

export { schoollpq };