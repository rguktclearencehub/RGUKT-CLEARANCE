import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA1ABL-EdckcSt26YZoiqsnqYCSTkyhvt4",
  authDomain: "rgukt-clearance-hub-a67db.firebaseapp.com",
  projectId: "rgukt-clearance-hub-a67db",
  storageBucket: "rgukt-clearance-hub-a67db.firebasestorage.app",
  messagingSenderId: "864696118096",
  appId: "1:864696118096:web:b5a8acc726169ab7139a55",
  measurementId: "G-L12KL523TX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
