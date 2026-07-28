"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getUiStrings } from "@/lib/i18n/guest";

/**
 * The two-question satisfaction card, shown after the guest asks for
 * the bill. It must never stand between the guest and the bill: the
 * bill request has already fired by the time this appears, answering
 * is optional, and the whole thing is two taps.
 *
 * Submits by itself the moment both faces are chosen — a third
 * "submit" tap is friction with no purpose.
 */

const FACES = ["😖", "🙁", "😐", "🙂", "😍"];
const THANKS_MS = 3_500;

type Props = {
  tagId: string;
  locale: string;
  onDone: () => void;
};

export function RatingCard({ tagId, locale, onDone }: Props) {
  const strings = getUiStrings(locale);

  const [food, setFood] = useState<number | null>(null);
  const [service, setService] = useState<number | null>(null);
  const [phase, setPhase] = useState<"asking" | "sending" | "thanks">("asking");
  const submitted = useRef(false);

  const submit = useCallback(
    async (foodValue: number, serviceValue: number) => {
      if (submitted.current) return;
      submitted.current = true;
      setPhase("sending");

      try {
        await fetch("/api/guest/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tagId,
            food: foodValue,
            service: serviceValue,
          }),
        });
      } catch {
        // The guest is waiting for their bill; a lost rating is not
        // their problem to solve. Thank them either way.
      }

      setPhase("thanks");
    },
    [tagId]
  );

  // Auto-submit once both answers are in.
  useEffect(() => {
    if (food !== null && service !== null) {
      void submit(food, service);
    }
  }, [food, service, submit]);

  // The thanks note excuses itself.
  useEffect(() => {
    if (phase !== "thanks") return;
    const timer = window.setTimeout(onDone, THANKS_MS);
    return () => window.clearTimeout(timer);
  }, [phase, onDone]);

  return (
    <div className="mtv-rating-card" role="dialog" aria-label={strings.rateTitle}>
      {phase === "thanks" ? (
        <p className="mtv-rating-thanks">{strings.rateThanks}</p>
      ) : (
        <>
          <p className="mtv-rating-title">{strings.rateTitle}</p>

          <FaceRow
            label={strings.rateFood}
            value={food}
            onPick={setFood}
            disabled={phase === "sending"}
          />
          <FaceRow
            label={strings.rateService}
            value={service}
            onPick={setService}
            disabled={phase === "sending"}
          />

          <button type="button" className="mtv-rating-skip" onClick={onDone}>
            {strings.rateSkip}
          </button>
        </>
      )}
    </div>
  );
}

function FaceRow({
  label,
  value,
  onPick,
  disabled,
}: {
  label: string;
  value: number | null;
  onPick: (rating: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="mtv-rating-row">
      <span className="mtv-rating-q">{label}</span>
      <div className="mtv-rating-faces">
        {FACES.map((face, index) => (
          <button
            key={index}
            type="button"
            className="mtv-face"
            data-active={value === index + 1 ? "true" : "false"}
            aria-label={`${label}: ${index + 1} / 5`}
            disabled={disabled}
            onClick={() => onPick(index + 1)}
          >
            {face}
          </button>
        ))}
      </div>
    </div>
  );
}
