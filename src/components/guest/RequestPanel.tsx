"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RequestIcon } from "@/components/guest/RequestIcon";
import { RatingCard } from "@/components/guest/RatingCard";
import { pickLocale, getUiStrings, type LocaleMap } from "@/lib/i18n/guest";

/**
 * The guest request panel.
 *
 * One tap, one request, no gates. A button confirms immediately and
 * resets itself after ten seconds.
 *
 * The reset is deliberately NOT tied to the waiter acknowledging or
 * fulfilling anything. Showing a guest "seen by staff" invites them to
 * watch for it, and a guest watching a status is a guest counting the
 * seconds they have been ignored. The confirmation says "we heard you"
 * and then gets out of the way.
 *
 * Tapping again after the reset is allowed and expected. The server
 * keeps one row on the waiter's screen but records every press, so
 * repeat-tapping surfaces in reporting as what it is.
 */

export type RequestTypeView = {
  id: string;
  code: string;
  kind: "signal" | "order";
  label: LocaleMap;
  sublabel: LocaleMap;
  icon: string | null;
  closesSession: boolean;
};

type ButtonState = "idle" | "sending" | "sent" | "failed";

const CONFIRMATION_MS = 10_000;

type Props = {
  tagId: string;
  locale: string;
  venueDefaultLocale: string;
  requestTypes: RequestTypeView[];
  initiallyOpenTypeIds: string[];
};

export function RequestPanel({
  tagId,
  locale,
  venueDefaultLocale,
  requestTypes,
  initiallyOpenTypeIds,
}: Props) {
  const strings = useMemo(() => getUiStrings(locale), [locale]);

  // Requests already outstanding when the page loaded show as confirmed,
  // then clear on the same ten-second timer as a fresh tap.
  const [states, setStates] = useState<Record<string, ButtonState>>(() => {
    const initial: Record<string, ButtonState> = {};
    for (const id of initiallyOpenTypeIds) {
      initial[id] = "sent";
    }
    return initial;
  });

  const timers = useRef<Record<string, number>>({});

  // The satisfaction card appears once per page life, after a request
  // that closes the visit (the bill). The bill request has already
  // fired by then — the card never gates it.
  const [showRating, setShowRating] = useState(false);
  const ratingShown = useRef(false);

  const scheduleReset = useCallback((requestTypeId: string) => {
    const existing = timers.current[requestTypeId];
    if (existing) {
      window.clearTimeout(existing);
    }

    timers.current[requestTypeId] = window.setTimeout(() => {
      setStates((prev) => {
        // Only clear a confirmation. A button that failed, or that the
        // guest re-tapped, must not be reset out from under them.
        if (prev[requestTypeId] !== "sent") {
          return prev;
        }
        const next = { ...prev };
        delete next[requestTypeId];
        return next;
      });
      delete timers.current[requestTypeId];
    }, CONFIRMATION_MS);
  }, []);

  // Clear the initial confirmations too.
  useEffect(() => {
    for (const id of initiallyOpenTypeIds) {
      scheduleReset(id);
    }
  }, [initiallyOpenTypeIds, scheduleReset]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const handle of Object.values(pending)) {
        window.clearTimeout(handle);
      }
    };
  }, []);

  const send = useCallback(
    async (requestTypeId: string) => {
      const current = states[requestTypeId];
      if (current === "sending" || current === "sent") {
        return;
      }

      setStates((prev) => ({ ...prev, [requestTypeId]: "sending" }));

      try {
        const response = await fetch("/api/guest/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId, requestTypeId }),
        });

        const payload = (await response.json()) as {
          ok: boolean;
          reason?: string;
        };

        // A duplicate is not a failure from the guest's point of view:
        // what they asked for is already on its way, and the server has
        // recorded that they asked again.
        if (payload.ok || payload.reason === "duplicate") {
          setStates((prev) => ({ ...prev, [requestTypeId]: "sent" }));
          scheduleReset(requestTypeId);

          const type = requestTypes.find((t) => t.id === requestTypeId);
          if (payload.ok && type?.closesSession && !ratingShown.current) {
            ratingShown.current = true;
            setShowRating(true);
          }
          return;
        }

        setStates((prev) => ({ ...prev, [requestTypeId]: "failed" }));
      } catch {
        setStates((prev) => ({ ...prev, [requestTypeId]: "failed" }));
      }
    },
    [states, tagId, scheduleReset, requestTypes]
  );

  return (
    <>
    {showRating ? (
      <RatingCard
        tagId={tagId}
        locale={locale}
        onDone={() => setShowRating(false)}
      />
    ) : null}
    <div className="mtv-request-grid">
      {requestTypes.map((type) => {
        const state = states[type.id] ?? "idle";
        const label = pickLocale(type.label, locale, venueDefaultLocale);
        const sublabel = pickLocale(type.sublabel, locale, venueDefaultLocale);

        const statusText =
          state === "sending"
            ? strings.sending
            : state === "sent"
              ? strings.onTheWay
              : state === "failed"
                ? strings.tryAgain
                : sublabel;

        return (
          <button
            key={type.id}
            type="button"
            className="mtv-request-card"
            data-state={state}
            data-closes={type.closesSession ? "true" : "false"}
            onClick={() => void send(type.id)}
            disabled={state === "sending" || state === "sent"}
            aria-live={state === "sent" ? "polite" : undefined}
          >
            <span className="mtv-request-icon" aria-hidden="true">
              <RequestIcon name={type.icon ?? type.code} className="mtv-icon-svg" />
            </span>

            <span className="mtv-request-text">
              <span className="mtv-request-label">{label}</span>
              <span className="mtv-request-sublabel">{statusText}</span>
            </span>

            <span className="mtv-request-chevron" aria-hidden="true">
              {state === "sent" ? <CheckMark /> : <Chevron />}
            </span>
          </button>
        );
      })}
    </div>
    </>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="mtv-chevron-svg" aria-hidden="true">
      <path
        d="M9 5l7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" className="mtv-chevron-svg" aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
