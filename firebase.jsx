// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";


const firebaseConfig = {
  apiKey: "AIzaSyBiM6FPhCh7m0C0RVkFxD0DVCNJl04RI3E",
  authDomain: "myschoolhubadmission.firebaseapp.com",
  projectId: "myschoolhubadmission",
  storageBucket: "myschoolhubadmission.firebasestorage.app",
  messagingSenderId: "23728177178",
  appId: "1:23728177178:web:331178c4bbe3e0652811a3",
  measurementId: "G-4P3MSXWV7B"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db };
