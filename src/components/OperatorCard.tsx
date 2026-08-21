"use client";

import { useEffect, useState } from "react";
import { EmailLink } from "@/components/EmailLink";

/**
 * The LSSI operator-identity block on the legal pages.
 *
 * Same protection as EmailLink: every value is assembled in the
 * browser after hydration from fragments that never form a
 * recognisable pattern (a phone number, a NIE, a postal address) in
 * the served HTML or anywhere in the JS bundle. Harvesters scraping
 * source or regexing assets find nothing; a human reading the page
 * sees the full details.
 */

const NAME = ["Mic", "hael ", "Teg", "ner"];
const STREET = ["Calle Pintor ", "Sobe", "jano ", "70B"];
const CITY = ["30710 Los ", "Alcá", "zares, ", "Murcia, ", "Spain"];
const NIE = ["ES", "Y64", "88", "390", "N"];
const PHONE = ["+34 ", "634 ", "329 ", "788"];

export function OperatorCard() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const join = (parts: string[]) => parts.join("");

  return (
    <dl className="lp-operator">
      <div>
        <dt>Operator</dt>
        <dd>{ready ? join(NAME) : "…"}</dd>
      </div>
      <div>
        <dt>NIF (NIE)</dt>
        <dd>{ready ? join(NIE) : "…"}</dd>
      </div>
      <div>
        <dt>Address</dt>
        <dd>
          {ready ? (
            <>
              {join(STREET)}
              <br />
              {join(CITY)}
            </>
          ) : (
            "…"
          )}
        </dd>
      </div>
      <div>
        <dt>Phone</dt>
        <dd>
          {ready ? (
            <a href={`tel:${join(PHONE).replace(/\s/g, "")}`}>{join(PHONE)}</a>
          ) : (
            "…"
          )}
        </dd>
      </div>
      <div>
        <dt>Email</dt>
        <dd>
          <EmailLink showAddress />
        </dd>
      </div>
    </dl>
  );
}
