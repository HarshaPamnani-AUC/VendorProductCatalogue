'use client';

import React from "react"
import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to process request');
        return;
      }

      setResetToken(data.resetToken);
      setSuccess(true);
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters long');
      return;
    }

    setResetLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResetError(data.error || 'Failed to reset password');
        return;
      }

      // Redirect to login after successful reset
      window.location.href = '/login?message=Password reset successful';
    } catch (err) {
      setResetError('An error occurred. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex-col justify-center items-center p-16 text-white relative">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 20% 80%, #3b82f6 0%, transparent 50%), 
                            radial-gradient(circle at 80% 20%, #1e40af 0%, transparent 50%), 
                            radial-gradient(circle at 40% 40%, #2563eb 0%, transparent 50%)`,
            backgroundSize: '100% 100%'
          }}></div>
        </div>
        
        <div className="max-w-lg relative z-10">
          <div className="flex items-center gap-4 mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-blue-600 shadow-lg shadow-blue-600/25">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Password Recovery</h1>
              <p className="text-blue-200 text-sm tracking-wide">SECURE ACCESS RECOVERY</p>
            </div>
          </div>
          
          <h2 className="text-5xl font-bold mb-8 leading-tight">
            Reset Your Password
          </h2>
          <p className="text-xl text-gray-300 mb-16 leading-relaxed">
            Enter your email to reset your password directly without email configuration.
          </p>
          
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-white mb-2">Direct Reset</h3>
                <p className="text-gray-400 leading-relaxed">Reset your password directly without email configuration</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-white mb-2">Instant Access</h3>
                <p className="text-gray-400 leading-relaxed">Get immediate reset token and set new password right away</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-white mb-2">1-Hour Expiry</h3>
                <p className="text-gray-400 leading-relaxed">Reset tokens automatically expire for enhanced security</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-12 bg-gradient-to-br from-white via-gray-50 to-white relative">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(0deg, #e5e7eb 1px, transparent 1px), 
                            linear-gradient(90deg, #e5e7eb 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        <div className="w-full max-w-md relative z-10">
          {/* Enhanced Form Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10">
            <div className="mb-10">
              <h2 className="text-4xl font-bold text-gray-900 mb-3">Reset Password</h2>
              <p className="text-gray-600 text-lg">Enter your email to receive reset token</p>
            </div>

            {!success ? (
              <form onSubmit={handleRequestReset} className="space-y-7">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-600 text-sm font-medium">{error}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Email Address
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your corporate email"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all duration-200 text-gray-900 placeholder-gray-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-lg"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Sending Reset Link...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            ) : (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Reset Token Generated!</h3>
                <p className="text-gray-600 mb-6">
                  Use the token below to reset your password directly:
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <p className="text-sm text-blue-700 mb-2">
                    <strong>Reset Token:</strong>
                  </p>
                  <div className="bg-white border border-blue-300 rounded-lg p-3 font-mono text-sm break-all">
                    {resetToken}
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-8">
                  <p className="text-sm text-yellow-700">
                    <strong>Important:</strong> This token will expire in 1 hour for security reasons.
                  </p>
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 mb-4">Reset Your Password:</h4>
                  <form onSubmit={handleDirectReset} className="space-y-4">
                    <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all duration-200 text-gray-900 placeholder-gray-500"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm Password
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all duration-200 text-gray-900 placeholder-gray-500"
                        required
                      />
                    </div>
                    {resetError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-red-600 text-sm font-medium">{resetError}</p>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      {resetLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Resetting Password...
                        </>
                      ) : (
                        'Reset Password'
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

            <div className="mt-10 pt-8 border-t border-gray-200">
              <div className="flex items-center justify-center">
                <Link href="/login" className="inline-flex items-center text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
