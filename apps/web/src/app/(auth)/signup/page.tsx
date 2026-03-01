"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthFormCard } from "@/components/AuthFormCard/AuthFormCard";
import "./signup.scss";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
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
    <AuthFormCard
      title="Create your account"
      submitLabel="Sign up"
      error={error}
      onSubmit={onSubmit}
    >
      <input
        className="authFormCard__input"
        required
        placeholder="Full name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <input
        className="authFormCard__input"
        required
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="authFormCard__input"
        required
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </AuthFormCard>
  );
}
