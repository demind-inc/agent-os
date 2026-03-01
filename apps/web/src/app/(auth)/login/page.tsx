"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const supabase = createClient();

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      return;
    }

    localStorage.setItem("agentos_access_token", data.session.access_token);
    router.push("/workspace");
  }

  return (
    <main className="page" style={{ maxWidth: 500, margin: "40px auto" }}>
      <div className="card column">
        <h1>Log in</h1>
        <form className="column" onSubmit={onSubmit}>
          <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
          <button type="submit">Continue</button>
        </form>
      </div>
    </main>
  );
}
