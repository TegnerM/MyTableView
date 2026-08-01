"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * TOTP enrollment + challenge for admins.
 *
 * needsEnroll=true  → create a factor, show the QR (+ manual secret),
 *                     verify the first code to activate it.
 * needsEnroll=false → factor exists; challenge + verify a code to lift
 *                     this session to aal2.
 *
 * Success either way = full navigation to /admin, where the server
 * gate re-checks everything.
 */

type Props = {
  needsEnroll: boolean;
};

export function AdminMfa({ needsEnroll }: Props) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();

    const prepare = async () => {
      try {
        if (needsEnroll) {
          const { data, error: enrollError } = await supabase.auth.mfa.enroll({
            factorType: "totp",
            friendlyName: "Admin TOTP",
          });

          if (enrollError || !data) {
            setError("Could not start enrollment. Reload to try again.");
            return;
          }

          setFactorId(data.id);
          setQrSvg(data.totp?.qr_code ?? null);
          setSecret(data.totp?.secret ?? null);
        } else {
          const { data } = await supabase.auth.mfa.listFactors();
          const factor = (data?.totp ?? []).find(
            (f) => f.status === "verified"
          );
          if (!factor) {
            setError("No authenticator found. Reload to try again.");
            return;
          }
          setFactorId(factor.id);
        }
        setReady(true);
      } catch {
        setError("Could not prepare two-factor. Reload to try again.");
      }
    };

    void prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsEnroll]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!factorId) {
      return;
    }
    setError(null);
    setBusy(true);

    try {
      const supabase = getBrowserClient();

      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });

      if (challengeError || !challenge) {
        setError("Verification failed. Try again.");
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });

      if (verifyError) {
        setError("Wrong code. Try again.");
        return;
      }

      window.location.href = "/admin";
    } catch {
      setError("Verification failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {needsEnroll && qrSvg ? (
        <>
          {qrSvg.startsWith("data:") ? (
            // Supabase returns the QR as a data-URL image.
            // eslint-disable-next-line @next/next/no-img-element
            <div className="mtv-adminauth-qr">
              <img src={qrSvg} alt="Scan with your authenticator app" />
            </div>
          ) : (
            <div
              className="mtv-adminauth-qr"
              // Raw SVG variant (older API shape), our own factor.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          )}
          {secret ? (
            <p className="mtv-adminauth-secret">{secret}</p>
          ) : null}
        </>
      ) : null}

      <form onSubmit={(e) => void submit(e)}>
        <label>
          6-digit code
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            required
          />
        </label>

        {error ? <p className="mtv-adminauth-error">{error}</p> : null}

        <button
          type="submit"
          className="mtv-adminauth-button"
          disabled={busy || !ready}
        >
          {busy ? "Verifying…" : needsEnroll ? "Activate" : "Verify"}
        </button>
      </form>
    </>
  );
}
