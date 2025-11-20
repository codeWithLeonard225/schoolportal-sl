// Datanase/SchoolResults.jsx

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";


const firebaseConfig = {
  apiKey: "AIzaSyCktgDiFsomVU6gi1x324KksMUR18gVI2U",
  authDomain: "schoolslogin-5bff5.firebaseapp.com",
  projectId: "schoolslogin-5bff5",
  storageBucket: "schoolslogin-5bff5.firebasestorage.app",
  messagingSenderId: "899115561044",
  appId: "1:899115561044:web:ec9a9fd0912d08465ebdc1",
  measurementId: "G-Y71SKD2JWE"
};

// Initialize Firebase with a unique name: "schoolResultsApp"
const schoolapp = initializeApp(firebaseConfig, "pupilLogin"); // ⭐️ FIX IS HERE
const analytics = getAnalytics(schoolapp);
const pupilLoginFetch = getFirestore(schoolapp);

export { pupilLoginFetch };