'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type AuthPageProps = {
  mode: 'login' | 'signup';
};

export function AuthPage({ mode }: AuthPageProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isSignup = mode === 'signup';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to authenticate. Please try again.');
      }

      router.replace('/');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to authenticate. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <Link href="/" className="auth-brand" aria-label="ZestMarket home">
        <span className="auth-brand-mark">Z</span>
        <span>ZestMarket</span>
      </Link>

      <section className="auth-layout" aria-labelledby="auth-title">
        <div className="auth-story">
          <p className="auth-eyebrow">Good food, right on time</p>
          <h1>Make room for something delicious.</h1>
          <p className="auth-story-copy">Your neighborhood favorites are just around the corner.</p>
          <div className="auth-story-note">
            <span className="auth-note-dot" />
            <span>Thoughtful picks from the kitchens near you</span>
          </div>
        </div>

        <div className="auth-panel">
          <p className="auth-eyebrow">Your account</p>
          <h2 id="auth-title">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p className="auth-intro">
            {isSignup ? 'A few details, then the good part.' : 'Sign in to pick up where you left off.'}
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            {isSignup && (
              <label>
                <span>Full name</span>
                <input
                  autoComplete="name"
                  minLength={2}
                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  required
                  value={name}
                />
              </label>
            )}
            <label>
              <span>Email address</span>
              <input
                autoComplete="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                minLength={6}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
                required
                type="password"
                value={password}
              />
            </label>

            {error && <p className="auth-error" role="alert">{error}</p>}

            <button className="auth-submit" disabled={submitting} type="submit">
              {submitting ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="auth-switch">
            {isSignup ? 'Already have an account?' : 'New to ZestMarket?'}{' '}
            <Link href={isSignup ? '/login' : '/signup'}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          <Link href="/" className="auth-back">Back to the menu</Link>
        </div>
      </section>
    </main>
  );
}