import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  cognitoSignIn, 
  cognitoSignUp, 
  cognitoSignInWithGoogle,
  handleCognitoCallback,
  getCognitoToken,
  initializeCognito,
  cognitoForgotPassword,
  cognitoConfirmResetPassword
} from "@/cognito";

export default function Landing() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isCheckingCallback, setIsCheckingCallback] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    initializeCognito();
    
    const checkOAuthCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const hasCode = urlParams.has('code');
        
        if (hasCode) {
          console.log('🔐 OAuth callback detected, processing...');
          const user = await handleCognitoCallback();
          
          if (user) {
            localStorage.setItem('currentUserId', user.userId);
            localStorage.setItem('currentUserEmail', user.email);
            localStorage.setItem('currentUserName', user.name);
            
            const token = await getCognitoToken();
            if (token) {
              try {
                await fetch('/api/auth/cognito', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  }
                });
              } catch (err) {
                console.warn('Backend sync failed, continuing...', err);
              }
            }
            
            console.log('✅ OAuth sign-in successful, redirecting...');
            window.location.href = '/';
            return;
          }
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
      } finally {
        setIsCheckingCallback(false);
      }
    };
    
    checkOAuthCallback();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      console.log('🔐 Initiating Google OAuth via AWS Cognito...');
      await cognitoSignInWithGoogle();
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      
      if (error.message?.includes('not configured')) {
        toast({
          title: "Configuration Error",
          description: "Google Sign-In is not configured. Please set up AWS Cognito with Google federation.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sign-In Error",
          description: error.message || "An unexpected error occurred during Google sign-in.",
          variant: "destructive",
        });
      }
      setIsGoogleLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!isLogin && !name) {
      toast({
        title: "Missing Information",
        description: "Please enter your name to create an account.",
        variant: "destructive",
      });
      return;
    }

    if (!email || !password) {
      toast({
        title: "Missing Information",
        description: "Please enter email and password.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsEmailLoading(true);
    try {
      let user;
      
      if (isLogin) {
        console.log('🔐 Signing in with AWS Cognito...');
        user = await cognitoSignIn(email, password);
      } else {
        console.log('🔐 Signing up with AWS Cognito...');
        await cognitoSignUp(email, password, name);
        
        // Auto-confirm the user via backend API
        console.log('🔐 Auto-confirming user...');
        try {
          await fetch('/api/auth/cognito/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
        } catch (confirmError) {
          console.warn('⚠️ Auto-confirm failed, user may already be confirmed:', confirmError);
        }
        
        console.log('🔐 Auto-signing in after signup...');
        user = await cognitoSignIn(email, password);
        
        toast({
          title: "Account Created",
          description: "Welcome! Your account has been created successfully.",
        });
      }

      localStorage.setItem('currentUserId', user.userId);
      localStorage.setItem('currentUserEmail', user.email);
      localStorage.setItem('currentUserName', user.name);

      console.log('🔑 Authentication successful:', { 
        action: isLogin ? 'login' : 'register',
        userId: user.userId,
        email: user.email 
      });

      const token = await getCognitoToken();
      if (token) {
        try {
          await fetch('/api/auth/cognito', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: user.name, email: user.email }),
            signal: AbortSignal.timeout(8000)
          });
        } catch (fetchError) {
          console.warn('⚠️ Backend sync failed, but Cognito Auth succeeded. Continuing...', fetchError);
        }
      }

      console.log('✅ Authentication successful, redirecting to app...');
      window.location.href = "/";
    } catch (error: any) {
      console.error('❌ Authentication error:', error);
      
      let errorMessage = error.message || "Something went wrong. Please try again.";
      
      if (error.name === 'UserNotConfirmedException') {
        errorMessage = "Please verify your email before signing in. Check your inbox for a verification link.";
      } else if (error.name === 'NotAuthorizedException') {
        errorMessage = "Incorrect email or password.";
      } else if (error.name === 'UserNotFoundException') {
        errorMessage = "No account found with this email. Please sign up first.";
      } else if (error.name === 'UsernameExistsException') {
        errorMessage = "An account with this email already exists.";
      } else if (error.name === 'InvalidPasswordException') {
        errorMessage = "Password does not meet requirements. Use at least 8 characters with uppercase, lowercase, numbers, and symbols.";
      }
      
      toast({
        title: "Authentication Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!email) {
      toast({
        title: "Missing Email",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingOtp(true);
    try {
      await cognitoForgotPassword(email);
      setIsOtpSent(true);
      toast({
        title: "OTP Sent Successfully",
        description: "A verification code has been sent to your email address. Check your inbox and spam folder.",
      });
    } catch (error: any) {
      console.error('Forgot password error:', error);
      let errorMessage = error.message || "Failed to send verification code.";
      
      if (error.name === 'UserNotFoundException') {
        errorMessage = "No account found with this email address. Please sign up first.";
      } else if (error.name === 'LimitExceededException') {
        errorMessage = "Too many attempts. Please try again in a few minutes.";
      } else if (error.name === 'InvalidParameterException') {
        errorMessage = "AWS Configuration Issue: Email service is not configured. Please contact support or configure AWS SES with your Cognito user pool.";
      } else if (error.message?.includes('InvalidParameter')) {
        errorMessage = "Email configuration error. Please ensure your AWS account is properly configured for sending emails.";
      }
      
      toast({
        title: "Failed to Send OTP",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = () => {
    if (otp.length >= 6) {
      setIsOtpVerified(true);
      toast({
        title: "OTP Verified",
        description: "You can now set your new password.",
      });
    } else {
      toast({
        title: "Invalid OTP",
        description: "Please enter a valid 6-digit code.",
        variant: "destructive",
      });
    }
  };

  const handleSaveNewPassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Missing Password",
        description: "Please enter and confirm your new password.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "New password and confirmation must match.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingPassword(true);
    try {
      await cognitoConfirmResetPassword(email, otp, newPassword);
      toast({
        title: "Password Reset Successful",
        description: "Your password has been updated. Please login with your new password.",
      });
      
      // Reset all forgot password states and go back to login
      setIsForgotPassword(false);
      setIsOtpSent(false);
      setIsOtpVerified(false);
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setIsLogin(true);
    } catch (error: any) {
      console.error('Password reset error:', error);
      let errorMessage = error.message || "Failed to reset password.";
      
      if (error.name === 'CodeMismatchException') {
        errorMessage = "Invalid verification code. Please check and try again.";
        setIsOtpVerified(false);
      } else if (error.name === 'ExpiredCodeException') {
        errorMessage = "Verification code has expired. Please request a new one.";
        setIsOtpSent(false);
        setIsOtpVerified(false);
        setOtp("");
      } else if (error.name === 'InvalidPasswordException') {
        errorMessage = "Password does not meet requirements. Use at least 8 characters with uppercase, lowercase, numbers, and symbols.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleBackToLogin = () => {
    setIsForgotPassword(false);
    setIsOtpSent(false);
    setIsOtpVerified(false);
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  if (isCheckingCallback) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="text-white text-lg">Processing authentication...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-8">
      <div className="text-center mb-12">
        <h1 className="text-7xl md:text-8xl font-bold text-white tracking-tight">PERALA</h1>
      </div>
      <div className="max-w-xl w-full space-y-6">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Get Early Access</h2>
          <p className="text-gray-400 text-lg mb-2">Type a prompt, get a trading strategy</p>
          <p className="text-gray-400 text-lg mb-6">instantly.</p>
          <p className="text-gray-500 text-sm">AI-powered trading insights.</p>
        </div>
        <div className="w-full max-w-md mx-auto space-y-4">
          {isForgotPassword ? (
            <>
              <div className="text-center mb-4">
                <h3 className="text-xl font-semibold text-white mb-2">Reset Password</h3>
                <p className="text-gray-400 text-sm">Enter your email to receive a verification code</p>
              </div>
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isOtpSent}
                  className="bg-gray-800 border-gray-700 text-white placeholder-gray-400 h-12 rounded-lg disabled:opacity-50"
                  data-testid="input-forgot-email"
                />
                {!isOtpSent ? (
                  <Button
                    onClick={handleSendOtp}
                    disabled={isSendingOtp}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium h-12 rounded-lg"
                    data-testid="button-send-otp"
                  >
                    {isSendingOtp ? "Sending..." : "Send OTP"}
                    {!isSendingOtp && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Enter OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        maxLength={6}
                        disabled={isOtpVerified}
                        className="bg-gray-800 border-gray-700 text-white placeholder-gray-400 h-12 rounded-lg flex-1 disabled:opacity-50"
                        data-testid="input-otp"
                      />
                      {!isOtpVerified && (
                        <Button
                          onClick={handleVerifyOtp}
                          disabled={otp.length < 6}
                          className="bg-green-600 hover:bg-green-700 text-white font-medium h-12 px-6 rounded-lg"
                          data-testid="button-verify-otp"
                        >
                          Verify
                        </Button>
                      )}
                    </div>
                    <Input
                      type="password"
                      placeholder="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={!isOtpVerified}
                      className="bg-gray-800 border-gray-700 text-white placeholder-gray-400 h-12 rounded-lg disabled:opacity-50"
                      data-testid="input-new-password"
                    />
                    <Input
                      type="password"
                      placeholder="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={!isOtpVerified}
                      className="bg-gray-800 border-gray-700 text-white placeholder-gray-400 h-12 rounded-lg disabled:opacity-50"
                      data-testid="input-confirm-password"
                    />
                    <Button
                      onClick={handleSaveNewPassword}
                      disabled={!isOtpVerified || isSavingPassword}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium h-12 rounded-lg disabled:opacity-50"
                      data-testid="button-save-password"
                    >
                      {isSavingPassword ? "Saving..." : "Save New Password"}
                      {!isSavingPassword && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  </>
                )}
                <div className="flex justify-center">
                  <button
                    onClick={handleBackToLogin}
                    className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
                    data-testid="button-back-to-login"
                  >
                    Back to Login
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-2 p-1 bg-gray-800 rounded-lg">
                <Button
                  variant="ghost"
                  className={`flex-1 ${isLogin ? "bg-gray-700 text-white" : "text-gray-400"}`}
                  onClick={() => setIsLogin(true)}
                  data-testid="button-toggle-login"
                >
                  Login
                </Button>
                <Button
                  variant="ghost"
                  className={`flex-1 ${!isLogin ? "bg-gray-700 text-white" : "text-gray-400"}`}
                  onClick={() => setIsLogin(false)}
                  data-testid="button-toggle-signup"
                >
                  Sign Up
                </Button>
              </div>
              <div className="space-y-3">
                {!isLogin && (
                  <Input
                    type="text"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white placeholder-gray-400 h-12 rounded-lg"
                    data-testid="input-name"
                  />
                )}
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white placeholder-gray-400 h-12 rounded-lg"
                  data-testid="input-email"
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleEmailAuth()}
                  className="bg-gray-800 border-gray-700 text-white placeholder-gray-400 h-12 rounded-lg"
                  data-testid="input-password"
                />
                <Button
                  onClick={handleEmailAuth}
                  disabled={isEmailLoading || isGoogleLoading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium h-12 rounded-lg"
                  data-testid="button-email-auth"
                >
                  {isEmailLoading ? "Processing..." : isLogin ? "Login" : "Create Account"}
                  {!isEmailLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
                {isLogin && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                      data-testid="button-forgot-password"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-black px-2 text-gray-500">Or continue with</span>
                </div>
              </div>
              <Button
                onClick={handleGoogleSignIn}
                disabled={isEmailLoading || isGoogleLoading}
                className="w-full bg-white hover:bg-gray-100 text-gray-900 font-medium h-12 rounded-lg transition-colors duration-200 flex items-center justify-center gap-3"
                data-testid="button-google-signin"
              >
                {isGoogleLoading ? (
                  'Processing...'
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign in with Google
                  </>
                )}
              </Button>
            </>
          )}
        </div>
        <div className="flex flex-col items-center space-y-3 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
            <span>AI Social feed </span>
          </div>
         
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
            <span>AI-Journal tracking</span>
          </div>
        </div>
      </div>
    </div>
  );
}
