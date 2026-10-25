import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Code2,
  ArrowRight,
  Shield,
  X
} from 'lucide-react';
import { registerStudent, loginStudent } from '../api';
import type { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (user: User) => void;
  onClose?: () => void;
  canClose?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onSuccess,
  onClose,
  canClose = false
}) => {
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 4) {
      setErrorMessage('Password must be at least 4 characters long.');
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      if (isRegister) {
        const res = await registerStudent(cleanEmail, password, name.trim() || undefined);
        onSuccess(res.user);
      } else {
        const res = await loginStudent(cleanEmail, password);
        onSuccess(res.user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoFill = () => {
    setIsRegister(false);
    setEmail('student@example.com');
    setPassword('password123');
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Clean, minimalist card with neutral tones */}
      <div className="relative w-full max-w-[420px] bg-[#11141b] border border-[#232938] rounded-xl shadow-2xl text-zinc-100 flex flex-col overflow-hidden">
        {canClose && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-1.5 text-zinc-400 hover:text-zinc-200 rounded-md hover:bg-zinc-800/60 transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header section */}
        <div className="pt-8 px-7 pb-4 text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 mb-3 shadow-inner">
            <Code2 className="w-5 h-5 text-zinc-300" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
            {isRegister ? 'Create an Account' : 'Sign In to CodeArena'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
            {isRegister
              ? 'Enter your email and choose a password to start learning and tracking your solutions.'
              : 'Sign in to access your course modules, saved solutions, and test progress.'}
          </p>
        </div>

        {/* Tab switch control (Muted segment control) */}
        <div className="px-7 pb-3">
          <div className="grid grid-cols-2 p-1 bg-[#0a0c10] rounded-lg border border-[#1e2330]">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setErrorMessage(null);
              }}
              className={`py-1.5 text-xs font-medium rounded-md transition ${
                !isRegister
                  ? 'bg-[#1e2432] text-zinc-100 shadow-sm border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setErrorMessage(null);
              }}
              className={`py-1.5 text-xs font-medium rounded-md transition ${
                isRegister
                  ? 'bg-[#1e2432] text-zinc-100 shadow-sm border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Register
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mx-7 mb-2 p-2.5 rounded-lg bg-red-950/30 border border-red-900/50 flex items-start space-x-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-tight">{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-7 pb-6 space-y-3">
          {isRegister && (
            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                Full Name <span className="text-zinc-500 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full bg-[#0b0e14] border border-[#232a3a] rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@university.edu"
                className="w-full bg-[#0b0e14] border border-[#232a3a] rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-medium text-zinc-300">
                {isRegister ? 'Create Password' : 'Password'}
              </label>
              {isRegister && (
                <span className="text-[10px] text-zinc-500">Min 4 characters</span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0b0e14] border border-[#232a3a] rounded-lg pl-9 pr-9 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0b0e14] border border-[#232a3a] rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition font-mono"
                />
              </div>
            </div>
          )}

          {/* Understated feature checklist */}
          <div className="pt-1 space-y-1 text-[11px] text-zinc-400">
            <div className="flex items-center space-x-2">
              <Check className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>Full curriculum access (18 modules, 450+ problems)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>Cloud auto-saved progress & code drafts</span>
            </div>
          </div>

          {/* High-contrast, clean solid action button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-3 py-2 px-4 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs rounded-lg shadow-sm flex items-center justify-center space-x-2 transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          {/* Subtle demo fill button */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={handleDemoFill}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 transition font-medium underline underline-offset-4 decoration-zinc-700 hover:decoration-zinc-400 cursor-pointer"
            >
              Fill Demo Student Credentials (1-Click)
            </button>
          </div>
        </form>

        {/* Minimalist footer */}
        <div className="bg-[#0b0d12] border-t border-[#1c222e] px-7 py-2.5 text-center text-[11px] text-zinc-500 flex items-center justify-center space-x-1.5">
          <Shield className="w-3 h-3 text-zinc-500" />
          <span>Encrypted password storage & server session management</span>
        </div>
      </div>
    </div>
  );
};
