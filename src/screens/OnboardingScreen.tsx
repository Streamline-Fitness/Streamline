import { useState } from "react";
import type { TrainingExperience } from "../domain/onboarding";

type Props = {
  onComplete: (experience: TrainingExperience) => void;
};

const options: Array<{
  value: TrainingExperience;
  title: string;
  description: string;
  preview: string;
}> = [
  {
    value: "beginner",
    title: "I'm new or getting back into it",
    description: "Little recent experience with regular strength training.",
    preview: "2 full-body workouts per week · 2 sets per movement · approachable variations",
  },
  {
    value: "intermediate",
    title: "I've been training consistently",
    description: "Comfortable with basic movements and ready for a steady routine.",
    preview: "3 full-body workouts per week · 3 sets per movement · moderate targets",
  },
  {
    value: "advanced",
    title: "I have years of consistent training",
    description: "Comfortable with more challenging bodyweight movements and volume.",
    preview: "4 workouts per week · 3–4 sets per movement · advanced variations",
  },
];

export function OnboardingScreen({ onComplete }: Props) {
  const [experience, setExperience] = useState<TrainingExperience | null>(null);

  return (
    <main className="auth-page">
      <section className="auth-card onboarding-card">
        <div className="eyebrow">STREAMLINE FITNESS · GETTING STARTED</div>
        <h1>Choose your starting workout.</h1>
        <p>All three plans will be available in your account. Choose the option that best describes your recent strength-training experience to set your starting active plan. This is not a permanent level.</p>
        <div aria-label="Training experience" className="onboarding-levels" role="group">
          {options.map((option) => (
            <button
              aria-pressed={experience === option.value}
              className="onboarding-choice"
              key={option.value}
              onClick={() => setExperience(option.value)}
              type="button"
            >
              <strong>{option.title}</strong>
              <span>{option.description}</span>
              <span className="onboarding-preview">{option.preview}</span>
            </button>
          ))}
        </div>
        <p className="onboarding-note">You can edit your plan, exercises, and schedule at any time. Choose movements you can do comfortably and with control.</p>
        <button className="button primary" disabled={!experience} onClick={() => experience && onComplete(experience)} type="button">
          Set up my plans
        </button>
      </section>
    </main>
  );
}
