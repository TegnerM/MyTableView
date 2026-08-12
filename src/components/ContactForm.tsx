"use client";

import { useState } from "react";

/**
 * The contact page's form. Strings arrive from the server component
 * (landing i18n) so this stays a dumb, serializable client island.
 */

export type ContactFormStrings = {
  name: string;
  email: string;
  business: string;
  message: string;
  send: string;
  sending: string;
  sentTitle: string;
  sentBody: string;
  error: string;
};

type Props = { strings: ContactFormStrings };

export function ContactForm({ strings }: Props) {
  const t = strings;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot — visually hidden, never filled by humans.
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">(
    "idle"
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, business, message, website }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
      } | null;
      setState(payload?.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  };

  if (state === "sent") {
    return (
      <div className="lp-cform-sent" role="status">
        <span className="lp-cform-check" aria-hidden="true">
          ✓
        </span>
        <h3>{t.sentTitle}</h3>
        <p>{t.sentBody}</p>
      </div>
    );
  }

  return (
    <form className="lp-cform" onSubmit={(event) => void submit(event)}>
      <label>
        <span>{t.name}</span>
        <input
          type="text"
          required
          maxLength={80}
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label>
        <span>{t.email}</span>
        <input
          type="email"
          required
          maxLength={120}
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label>
        <span>{t.business}</span>
        <input
          type="text"
          maxLength={120}
          autoComplete="organization"
          value={business}
          onChange={(event) => setBusiness(event.target.value)}
        />
      </label>

      <label>
        <span>{t.message}</span>
        <textarea
          required
          rows={6}
          maxLength={2000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>

      {/* Honeypot — hidden from people, irresistible to bots. */}
      <label className="lp-cform-hp" aria-hidden="true">
        <span>Website</span>
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </label>

      {state === "failed" ? (
        <p className="lp-cform-error" role="alert">
          {t.error}
        </p>
      ) : null}

      <button
        type="submit"
        className="lp-btn lp-btn-orange lp-cform-submit"
        disabled={state === "sending"}
      >
        {state === "sending" ? t.sending : t.send}
      </button>
    </form>
  );
}
