import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyCLzQf_YN-sSHwxcnsBox0IP8ESj7vhv1E",
    authDomain: "coachbooking-2a1bf.firebaseapp.com",
    projectId: "coachbooking-2a1bf",
    storageBucket: "coachbooking-2a1bf.firebasestorage.app",
    messagingSenderId: "32368158060",
    appId: "1:32368158060:web:595d7e082675980002ff49"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);