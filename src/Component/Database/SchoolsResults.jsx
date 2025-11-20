// Datanase/SchoolResults.jsx

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";


const firebaseConfig = {
    apiKey: "AIzaSyD5qJ705TA9wXjvAjPj78amYZG4LVtbVOU",
    authDomain: "myschoolhubresults.firebaseapp.com",
    projectId: "myschoolhubresults",
    storageBucket: "myschoolhubresults.firebasestorage.app",
    messagingSenderId: "983553432441",
    appId: "1:983553432441:web:eb918a435e0367a652eda8",
    measurementId: "G-SDZPMHVJRN"
};

// Initialize Firebase with a unique name: "schoolResultsApp"
const schoolapp = initializeApp(firebaseConfig, "schoolResultsApp"); // ⭐️ FIX IS HERE
const analytics = getAnalytics(schoolapp);
const schooldb = getFirestore(schoolapp);

export { schooldb };