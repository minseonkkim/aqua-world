import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './config';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<FirebaseUser> {
  if (!auth) throw new Error('Firebase Auth가 설정되지 않았습니다.');
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOut(): Promise<void> {
  if (!auth) return;
  await firebaseSignOut(auth);
}

export function onAuthChanged(callback: (user: FirebaseUser | null) => void): () => void {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}
