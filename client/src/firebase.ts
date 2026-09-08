import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAwIxWKaS1dMhlNs6hRuIrGaZ2vjY9lXu4",
  authDomain: "rguktclearencehu.firebaseapp.com",
  projectId: "rguktclearencehu",
  storageBucket: "rguktclearencehu.firebasestorage.app",
  messagingSenderId: "15838254933",
  appId: "1:15838254933:web:768d69b9127b0d16cfc1dc",
  measurementId: "G-40J5M56CJT"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
