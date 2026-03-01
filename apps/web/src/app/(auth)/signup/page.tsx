"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./signup.scss";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName || undefined } }
    });
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    const token = data.session?.access_token;
    if (token) localStorage.setItem("agentos_access_token", token);
    router.push("/workspace");
  }

  return (
    <main className="signup">
      <div className="signup__left">
        <div className="signup__brand">
          <div className="signup__logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h4zm-4 6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8zm6 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-6z" />
            </svg>
          </div>
          <span className="signup__logoText">AgentOS</span>
        </div>
        <h1 className="signup__tagline">
          Orchestrate your work with
          <br />
          AI-powered agents
        </h1>
        <p className="signup__desc">
          Automate tasks, delegate to AI agents, and focus on what matters most. Join thousands of
          teams shipping faster.
        </p>
        <div className="signup__features">
          <div className="signup__feature">
            <span className="signup__featureIcon">✓</span>
            Intelligent task delegation
          </div>
          <div className="signup__feature">
            <span className="signup__featureIcon">✓</span>
            Real-time progress tracking
          </div>
          <div className="signup__feature">
            <span className="signup__featureIcon">✓</span>
            Human-in-the-loop approvals
          </div>
        </div>
      </div>

      <div className="signup__right">
        <div className="signup__formHeader">
          <h2 className="signup__formTitle">Create your account</h2>
          <p className="signup__formSubtitle">
            Start your 14-day free trial. No credit card required.
          </p>
        </div>
        <form className="signup__form" onSubmit={onSubmit}>
          <div className="signup__nameRow">
            <div className="signup__field">
              <label className="signup__label" htmlFor="firstName">
                First name
              </label>
              <input
                id="firstName"
                className="signup__input"
                required
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="signup__field">
              <label className="signup__label" htmlFor="lastName">
                Last name
              </label>
              <input
                id="lastName"
                className="signup__input"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="signup__field">
            <label className="signup__label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              className="signup__input"
              required
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="signup__field">
            <label className="signup__label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="signup__input"
              required
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="signup__error">{error}</p>}
          <button type="submit" className="signup__submit">
            Create account
          </button>
          <div className="signup__divider">
            <span className="signup__dividerLine" />
            <span className="signup__dividerText">or continue with</span>
            <span className="signup__dividerLine" />
          </div>
          <div className="signup__socialBtns">
            <button type="button" className="signup__socialBtn signup__socialBtn--google">
              <span className="signup__googleIcon">G</span>
              Google
            </button>
            <button type="button" className="signup__socialBtn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </button>
          </div>
        </form>
        <div className="signup__signinLink">
          <span className="signup__signinText">Already have an account?</span>
          <Link href="/login" className="signup__signinLinkText">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
