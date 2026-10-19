import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth, ApiClientError } from '../hooks/useAuth';

export const StaffLoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Email wajib diisi.');
      return;
    }
    if (!password) {
      setErrorMessage('Password wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate('/staff/orders');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          setErrorMessage('Email atau kata sandi tidak valid.');
        } else if (err.statusCode === 429) {
          setErrorMessage('Terlalu banyak percobaan. Silakan tunggu beberapa saat.');
        } else {
          setErrorMessage('Gagal terhubung ke server. Pastikan backend aktif dan coba lagi.');
        }
      } else {
        setErrorMessage('Terjadi kesalahan yang tidak terduga. Silakan coba lagi.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans bg-surface">
      {/* Left Panel — Brand Hero (matches Login.png) */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand flex-col justify-between p-10 xl:p-12">
        {/* Top Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ink flex items-center justify-center text-brand font-extrabold text-sm shadow-subtle">
            MG
          </div>
          <div className="leading-tight">
            <span className="block text-base font-extrabold text-ink">Mavera</span>
            <span className="block text-[10px] font-bold text-ink/70 uppercase tracking-wider">
              ADMIN
            </span>
          </div>
        </div>

        {/* Middle Hero Copy (Left-aligned per Login.png) */}
        <div className="max-w-md my-auto">
          <p className="text-xs font-extrabold text-ink uppercase tracking-wider mb-3">
            PUSAT KENDALI WARUNG
          </p>
          <h1 className="text-4xl xl:text-5xl font-extrabold text-ink tracking-tight leading-tight mb-3">
            Dashboard Mavera
          </h1>
          <p className="text-base text-ink/80 font-medium">
            Kelola pesanan &amp; menu warung dengan cepat.
          </p>
        </div>

        {/* Bottom Tagline */}
        <p className="text-xs font-semibold text-ink/80">
          Pesanan rapi, pelayanan makin sigap.
        </p>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-surface">
        <div className="w-full max-w-md">
          {/* Mobile Brand Header */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-ink font-extrabold text-sm">
              MG
            </div>
            <div className="leading-tight">
              <span className="block text-base font-extrabold text-ink">Mavera</span>
              <span className="block text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                ADMIN
              </span>
            </div>
          </div>

          {/* Greeting */}
          <div className="mb-7">
            <p className="text-[11px] font-extrabold text-[#946C00] uppercase tracking-wider mb-2">
              SELAMAT DATANG KEMBALI
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink leading-tight">
              Masuk ke Dashboard
            </h2>
            <p className="text-sm text-ink-muted mt-1.5">
              Gunakan akun kasir atau owner
            </p>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-danger-surface border border-danger/20 mb-5"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-danger">{errorMessage}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email field */}
            <div className="space-y-1.5">
              <label htmlFor="staff-email" className="block text-xs font-bold text-ink">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-muted">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="staff-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="nama@mavera.id"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-border text-ink text-sm placeholder:text-ink-light focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-smooth disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label htmlFor="staff-password" className="block text-xs font-bold text-ink">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="staff-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Masukkan password"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-surface border border-border text-ink text-sm placeholder:text-ink-light focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-smooth disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-muted hover:text-ink transition-colors"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-ink font-bold text-sm transition-smooth active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                'Masuk ke Dashboard'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-ink-muted mt-6">
            Hubungi owner jika lupa password
          </p>
        </div>
      </div>
    </div>
  );
};
