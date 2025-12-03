import { Amplify } from 'aws-amplify';
import { 
  signIn, 
  signUp, 
  signOut, 
  getCurrentUser, 
  fetchAuthSession,
  signInWithRedirect,
  fetchUserAttributes
} from 'aws-amplify/auth';

const cognitoConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID || '',
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN || '',
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [import.meta.env.VITE_COGNITO_REDIRECT_URI || window.location.origin],
          redirectSignOut: [import.meta.env.VITE_COGNITO_LOGOUT_URI || window.location.origin],
          responseType: 'code' as const,
        },
      },
    },
  },
};

let isConfigured = false;

export function initializeCognito() {
  if (isConfigured) return;
  
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const clientId = import.meta.env.VITE_COGNITO_APP_CLIENT_ID;
  
  if (!userPoolId || !clientId) {
    console.warn('⚠️ AWS Cognito credentials not configured. Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_APP_CLIENT_ID');
    return;
  }
  
  try {
    Amplify.configure(cognitoConfig);
    isConfigured = true;
    console.log('✅ AWS Cognito initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize AWS Cognito:', error);
  }
}

export async function cognitoSignUp(email: string, password: string, name: string): Promise<{ userId: string; email: string; name: string }> {
  initializeCognito();
  
  const result = await signUp({
    username: email,
    password,
    options: {
      userAttributes: {
        email,
        name,
      },
    },
  });
  
  if (!result.userId) {
    throw new Error('Sign up failed - no user ID returned');
  }
  
  return {
    userId: result.userId,
    email,
    name,
  };
}

export async function cognitoSignIn(email: string, password: string): Promise<{ userId: string; email: string; name: string }> {
  initializeCognito();
  
  const result = await signIn({
    username: email,
    password,
  });
  
  if (!result.isSignedIn) {
    throw new Error('Sign in failed');
  }
  
  const session = await fetchAuthSession();
  const attributes = await fetchUserAttributes();
  
  const userId = session.tokens?.idToken?.payload?.sub as string || '';
  const userName = attributes.name || attributes.email || email;
  
  return {
    userId,
    email: attributes.email || email,
    name: userName,
  };
}

export async function cognitoSignInWithGoogle(): Promise<void> {
  initializeCognito();
  
  await signInWithRedirect({
    provider: 'Google',
  });
}

export async function cognitoSignOut(): Promise<void> {
  initializeCognito();
  await signOut();
}

export async function getCognitoUser(): Promise<{ userId: string; email: string; name: string; displayName: string } | null> {
  initializeCognito();
  
  try {
    const user = await getCurrentUser();
    const session = await fetchAuthSession();
    const attributes = await fetchUserAttributes();
    
    const name = attributes.name || attributes.email || '';
    
    return {
      userId: user.userId,
      email: attributes.email || '',
      name,
      displayName: name,
    };
  } catch {
    return null;
  }
}

export async function getCognitoToken(): Promise<string | null> {
  initializeCognito();
  
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || null;
  } catch {
    return null;
  }
}

export async function handleCognitoCallback(): Promise<{ userId: string; email: string; name: string } | null> {
  initializeCognito();
  
  try {
    const session = await fetchAuthSession();
    
    if (session.tokens?.idToken) {
      const attributes = await fetchUserAttributes();
      const userId = session.tokens.idToken.payload.sub as string;
      
      return {
        userId,
        email: attributes.email || '',
        name: attributes.name || attributes.email || '',
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error handling Cognito callback:', error);
    return null;
  }
}

export { signOut };
