import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;

export function initializeFirebase() {
  if (app) return auth;
  
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    console.log('Firebase initialized successfully');
    return auth;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return null;
  }
}

export async function signInWithGoogle(): Promise<{ userId: string; email: string; name: string; photoURL: string | null }> {
  const authInstance = initializeFirebase();
  if (!authInstance) {
    throw new Error('Firebase not initialized');
  }

  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');

  try {
    console.log('Starting Google Sign-In with Firebase...');
    const result = await signInWithPopup(authInstance, provider);
    const user = result.user;

    console.log('Google Sign-In successful:', user.email);

    return {
      userId: user.uid,
      email: user.email || '',
      name: user.displayName || user.email || '',
      photoURL: user.photoURL,
    };
  } catch (error: any) {
    console.error('Google Sign-In error:', error);
    
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in was cancelled');
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error('Pop-up was blocked. Please allow pop-ups for this site.');
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error('This domain is not authorized for Google Sign-In. Please add it in Firebase Console.');
    }
    
    throw error;
  }
}

export async function firebaseGoogleSignOut(): Promise<void> {
  const authInstance = initializeFirebase();
  if (!authInstance) return;

  try {
    await firebaseSignOut(authInstance);
    console.log('Firebase sign-out successful');
  } catch (error) {
    console.error('Firebase sign-out error:', error);
  }
}

export function getCurrentFirebaseUser(): User | null {
  const authInstance = initializeFirebase();
  if (!authInstance) return null;
  return authInstance.currentUser;
}

export function onFirebaseAuthChange(callback: (user: User | null) => void): () => void {
  const authInstance = initializeFirebase();
  if (!authInstance) {
    callback(null);
    return () => {};
  }
  
  return onAuthStateChanged(authInstance, callback);
}

export async function getFirebaseIdToken(): Promise<string | null> {
  const authInstance = initializeFirebase();
  if (!authInstance || !authInstance.currentUser) return null;
  
  try {
    return await authInstance.currentUser.getIdToken();
  } catch (error) {
    console.error('Failed to get Firebase ID token:', error);
    return null;
  }
}
