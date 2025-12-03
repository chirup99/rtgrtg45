import { CognitoJwtVerifier } from 'aws-jwt-verify';

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

export function initializeCognitoVerifier() {
  const userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
  const clientId = process.env.AWS_COGNITO_APP_CLIENT_ID;
  const region = process.env.AWS_COGNITO_REGION || process.env.AWS_REGION || 'eu-north-1';
  
  if (!userPoolId || !clientId) {
    console.warn('⚠️ AWS Cognito credentials not configured for backend verification');
    console.warn('   Required: AWS_COGNITO_USER_POOL_ID, AWS_COGNITO_APP_CLIENT_ID');
    return null;
  }
  
  try {
    verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'id',
      clientId,
    });
    
    console.log('✅ AWS Cognito JWT Verifier initialized');
    console.log(`   Region: ${region}`);
    console.log(`   User Pool: ${userPoolId}`);
    
    return verifier;
  } catch (error) {
    console.error('❌ Failed to initialize Cognito JWT Verifier:', error);
    return null;
  }
}

export interface CognitoUserClaims {
  sub: string;
  email: string;
  name?: string;
  email_verified?: boolean;
  iat: number;
  exp: number;
}

export async function verifyCognitoToken(token: string): Promise<CognitoUserClaims | null> {
  if (!verifier) {
    verifier = initializeCognitoVerifier() as ReturnType<typeof CognitoJwtVerifier.create> | null;
  }
  
  if (!verifier) {
    console.warn('⚠️ Cognito verifier not available - cannot verify token');
    return null;
  }
  
  try {
    const payload = await verifier.verify(token);
    
    return {
      sub: payload.sub,
      email: payload.email as string,
      name: payload.name as string | undefined,
      email_verified: payload.email_verified as boolean | undefined,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    console.error('❌ Token verification failed:', error);
    return null;
  }
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

export async function authenticateRequest(authHeader: string | undefined): Promise<CognitoUserClaims | null> {
  const token = extractBearerToken(authHeader);
  if (!token) {
    return null;
  }
  return verifyCognitoToken(token);
}
