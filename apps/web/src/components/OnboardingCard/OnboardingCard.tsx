"use client";

import "./OnboardingCard.scss";

type OnboardingCardProps = {
  title: string;
  inputPlaceholder: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  items: { id: string; label: string }[];
  onSelectItem: (id: string) => void;
};

export function OnboardingCard({
  title,
  inputPlaceholder,
  inputValue,
  onInputChange,
  onSubmit,
  items,
  onSelectItem
}: OnboardingCardProps) {
  return (
    <main className="page onboardingCard">
      <div className="card column">
        <h1 className="onboardingCard__title">{title}</h1>
        <form className="onboardingCard__form row" onSubmit={onSubmit}>
          <input
            className="onboardingCard__input"
            required
            placeholder={inputPlaceholder}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
          />
          <button type="submit" className="onboardingCard__submit">
            Create
          </button>
        </form>
        <div className="onboardingCard__list column">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="onboardingCard__item"
              onClick={() => onSelectItem(item.id)}
            >
              <strong>{item.label}</strong>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
