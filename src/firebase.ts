import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, getDocFromServer, doc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0322520339",
  appId: "1:1085043462951:web:21405d94b69fd185698f02",
  apiKey: "AIzaSyC81DBZ6FZsGDnQ__8cguxVDucRyEw8WT0",
  authDomain: "gen-lang-client-0322520339.firebaseapp.com",
  storageBucket: "gen-lang-client-0322520339.firebasestorage.app",
  messagingSenderId: "1085043462951"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId
export const db = getFirestore(app, "ai-studio-autoclutch-87e8c7df-e80b-489c-ac55-1e0602e6b514");

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Validate Connection to Firestore (MANDATORY per SKILL.md)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase Connection verified successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
