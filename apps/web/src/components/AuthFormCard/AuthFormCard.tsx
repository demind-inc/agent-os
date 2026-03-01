"use client";

import "./AuthFormCard.scss";

type AuthFormCardProps = {
  title: string;
  submitLabel: string;
  children: React.ReactNode;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function AuthFormCard({
  title,
  submitLabel,
  children,
  error,
  onSubmit
}: AuthFormCardProps) {
  return (
    <main className="page authFormCard">
      <div className="card column">
        <h1 className="authFormCard__title">{title}</h1>
        <form className="authFormCard__form column" onSubmit={onSubmit}>
          {children}
          {error && <p className="authFormCard__error">{error}</p>}
          <button type="submit" className="authFormCard__submit">
            {submitLabel}
          </button>
        </form>
      </div>
    </main>
  );
}
