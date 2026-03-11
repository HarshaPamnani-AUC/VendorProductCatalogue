'use client';

import React, { useEffect, Suspense } from "react"
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Database, Eye, EyeOff, Mail, Lock, Shield, Zap, Users } from 'lucide-react';

function SearchParamsWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      {children}
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Debug: Log when component mounts
  useEffect(() => {
    console.log('LoginPage component mounted');
    
    // Check for success message from password reset
    const message = searchParams.get('message');
    if (message) {
      setSuccess(message);
      // Clear the message from URL after displaying
      router.replace('/login', { scroll: false });
    }
  }, [searchParams, router]);

  // Debug: Log render
  console.log('LoginPage rendering');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('Login attempt:', { email, passwordProvided: !!password });

    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('Frontend response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Login failed:', errorData);
        setError(errorData.error || `Login failed (${response.status})`);
        return;
      }

      const data = await response.json();
      console.log('Login successful:', { hasToken: !!data.token, hasUser: !!data.user });
      
      // Store token and user data
      if (data.token) {
        localStorage.setItem('token', data.token);
        console.log('Token stored in localStorage:', data.token.substring(0, 20) + '...');
      } else {
        console.error('No token received from server');
      }
      
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        console.log('User data stored:', data.user);
      }
      
      console.log('Redirecting to dashboard...');
      console.log('Current localStorage before redirect:', {
        token: localStorage.getItem('token') ? 'exists' : 'missing',
        user: localStorage.getItem('user') ? 'exists' : 'missing'
      });
      
      // Navigate immediately, don't wait for dashboard data
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.name === 'AbortError') {
        setError('Login request timed out. Please try again.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Side - Professional Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex-col justify-center items-center p-16 text-white relative">
        {/* Professional Pattern */}
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
              <Database className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">ProductCatalog Pro</h1>
              <p className="text-blue-200 text-sm tracking-wide">ENTERPRISE VENDOR MANAGEMENT</p>
            </div>
          </div>
          
          <h2 className="text-5xl font-bold mb-8 leading-tight">
            Advanced Product Catalog Solutions
          </h2>
          <p className="text-xl text-gray-300 mb-16 leading-relaxed">
            Empowering enterprises with intelligent vendor management, real-time inventory synchronization, and data-driven insights for optimal supply chain performance.
          </p>
          
          <div className="space-y-8">
            <div className="flex items-start gap-4 group">
              <div className="w-14 h-14 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600/30 transition-colors">
                <Zap className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-white mb-2">Ultra-High Performance</h3>
                <p className="text-gray-400 leading-relaxed">Process 50K+ products per minute with our advanced optimization algorithms</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 group">
              <div className="w-14 h-14 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600/30 transition-colors">
                <Shield className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-white mb-2">Advanced Security</h3>
                <p className="text-gray-400 leading-relaxed">SOC 2 Type II certified with end-to-end encryption and zero-trust architecture</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 group">
              <div className="w-14 h-14 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600/30 transition-colors">
                <Users className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-white mb-2">Enterprise Collaboration</h3>
                <p className="text-gray-400 leading-relaxed">Advanced role-based access control with audit trails and compliance reporting</p>
              </div>
            </div>
          </div>
          
          <div className="mt-16 pt-8 border-t border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Trusted by industry leaders</span>
              <div className="flex items-center gap-6 text-gray-500">
                <span>• ISO 27001</span>
                <span>• GDPR Compliant</span>
                <span>• HIPAA Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Attractive Login Form */}
      <div className="flex-1 flex items-center justify-center p-12 bg-gradient-to-br from-white via-gray-50 to-white relative">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(0deg, #e5e7eb 1px, transparent 1px), 
                            linear-gradient(90deg, #e5e7eb 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        <div className="w-full max-w-md relative z-10">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-10">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 shadow-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">ProductCatalog Pro</h1>
                <p className="text-gray-500 text-sm">Enterprise Vendor Management</p>
              </div>
            </div>
          </div>

          {/* Enhanced Login Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10">
            <div className="mb-10">
              <h2 className="text-4xl font-bold text-gray-900 mb-3">Welcome Back</h2>
              <p className="text-gray-600 text-lg">Sign in to access your enterprise dashboard</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-7">
              {success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-green-600 text-sm font-medium">{success}</p>
                </div>
              )}

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

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your secure password"
                    className="w-full pl-12 pr-14 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all duration-200 text-gray-900 placeholder-gray-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                  <span className="ml-2 text-sm text-gray-600">Remember me</span>
                </label>
                <Link href="/forgot-password" className="text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-lg"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Authenticating...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-10 pt-8 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Don't have access?{' '}
                  <Link href="/register" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                    Contact Sales
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Enhanced Trust Indicators */}
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500 mb-6 font-medium">TRUSTED BY GLOBAL ENTERPRISES</p>
            <div className="flex items-center justify-center gap-10 text-gray-400">
              <div className="flex flex-col items-center gap-1">
                <Shield className="w-5 h-5" />
                <span className="text-xs font-medium">SOC 2</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Zap className="w-5 h-5" />
                <span className="text-xs font-medium">99.99%</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Users className="w-5 h-5" />
                <span className="text-xs font-medium">24/7</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Database className="w-5 h-5" />
                <span className="text-xs font-medium">ISO 27001</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <SearchParamsWrapper>
      <LoginContent />
    </SearchParamsWrapper>
  );
}
