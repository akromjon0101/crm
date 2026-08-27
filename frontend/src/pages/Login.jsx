import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Decorative background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-blue-400/15 blur-[120px] pointer-events-none mix-blend-multiply dark:mix-blend-screen" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-primary-400/15 blur-[120px] pointer-events-none mix-blend-multiply dark:mix-blend-screen" />

      <div className="w-full max-w-[420px] relative z-10 animate-slideIn">
        
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/30 mb-5 relative group">
            <div className="absolute inset-0 rounded-2xl bg-white/20 group-hover:bg-white/30 transition-colors" />
            <svg className="w-8 h-8 text-white relative z-10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-200 tracking-tightest">EduCRM</h1>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2">Learning Center Management</p>
        </div>

        {/* Form Card */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/50 dark:border-slate-700/50 p-5 sm:p-8 transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.12)]">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Welcome back</h2>

          {error && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50/80 dark:bg-red-900/30 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm rounded-xl mb-6 animate-fadeIn">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Email address</label>
              <input
                type="email"
                className="w-full px-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all shadow-sm"
                placeholder="you@crm.uz"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoFocus
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Password</label>
              <input
                type="password"
                className="w-full px-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all shadow-sm"
                placeholder="••••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <button 
              type="submit" 
              className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold py-3.5 mt-2 transition-all hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed" 
              disabled={loading}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
              <span className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : 'Sign in to account'}
              </span>
            </button>
          </form>
        </div>

        {/* Demo Accounts */}
        <div className="mt-8">
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center mb-4">Quick Access Demo</p>
          <div className="flex flex-col gap-2.5">
            {[
              { label: 'CEO',     email: 'superadmin@crm.uz', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800' },
              { label: 'Admin',   email: 'admin@crm.uz',      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
              { label: 'Teacher', email: 'sarvar@crm.uz',     color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
            ].map(({ label, email, color }) => (
              <button
                key={email}
                type="button"
                onClick={() => setForm({ email, password: 'password' })}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-slate-700/40 hover:bg-white dark:hover:bg-slate-800 transition-all hover:shadow-md group"
              >
                <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border ${color}`}>
                  {label}
                </span>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 font-mono flex-1 text-left">
                  {email}
                </span>
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 group-hover:text-primary-500 transition-all duration-200 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                  Select →
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
