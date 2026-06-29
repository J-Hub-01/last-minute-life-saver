import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { NotificationEngine } from './notifications';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Calendar scopes - Using the most common one that covers events
provider.addScope('https://www.googleapis.com/auth/calendar.events');

// Flag to indicate if we are in the middle of a sign-in flow.
let signInPromise: Promise<{ user: User; accessToken: string } | null> | null = null;
// Cache the access token in memory and session storage.
let cachedAccessToken: string | null = (typeof window !== 'undefined') ? sessionStorage.getItem('lmls_google_token') : null;

// Expose it to the window for the CalendarEngine immediately
if (typeof window !== 'undefined') {
  (window as any).getOAuthToken = async () => {
    if (!cachedAccessToken) {
      cachedAccessToken = sessionStorage.getItem('lmls_google_token');
    }
    return cachedAccessToken;
  };
}

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken) {
        cachedAccessToken = sessionStorage.getItem('lmls_google_token');
      }
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!signInPromise) {
        // If we have a user but no token, we signal failure so the UI can show "Sign In"
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      sessionStorage.removeItem('lmls_google_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (signInPromise) return signInPromise;

  signInPromise = (async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to get access token from Firebase Auth');
      }

      cachedAccessToken = credential.accessToken;
      sessionStorage.setItem('lmls_google_token', cachedAccessToken);
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.code === 'auth/popup-blocked') {
        NotificationEngine.addToast({ 
          title: 'Popup Blocked', 
          message: 'Please allow popups for this site to connect your calendar.', 
          type: 'error' 
        });
      }
      throw error;
    } finally {
      signInPromise = null;
    }
  })();

  return signInPromise;
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  sessionStorage.removeItem('lmls_google_token');
};
