import { useState } from "react";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Field, Input } from "../../../components/ui/Form";
import { copy } from "../../../lib/copy";
import type { TurnstileState } from "../../../lib/turnstile";
import { visitorApi } from "../visitor-data";

/**
 * Masuk lewat email OTP dalam dua langkah: minta kode, lalu isi kode (+ nama panggilan opsional).
 * Di dev lokal server mengembalikan `devCode` supaya alur bisa dicoba tanpa penyedia email.
 */
export function EmailLogin({
  turnstile,
  onLoggedIn,
}: {
  turnstile: TurnstileState;
  onLoggedIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const humanReady = !turnstile.required || !!turnstile.token;

  if (sentTo === null) {
    return (
      <div className="grid gap-3">
        <Field label={copy.event.login.email} hint={copy.event.login.emailHint}>
          {(id) => (
            <Input
              id={id}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <ActionButton
          variant="primary"
          disabled={!email.includes("@") || !humanReady}
          resetOn={email}
          action={async () => {
            const r = await visitorApi.requestOtp(email.trim(), turnstile.token);
            turnstile.reset();
            setDevCode(r.devCode ?? null);
            setCode(r.devCode ?? "");
            setSentTo(email.trim());
          }}
        >
          {copy.event.login.sendCode}
        </ActionButton>
        {!humanReady && <p className="text-xs text-muted">{copy.event.login.humanWait}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <p role="status" className="text-sm">
        {copy.event.login.codeSent(sentTo)}
      </p>
      {devCode && (
        <p className="text-xs font-bold text-accent-strong">{copy.event.login.devCode(devCode)}</p>
      )}
      <Field label={copy.event.login.code}>
        {(id) => (
          <Input
            id={id}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        )}
      </Field>
      <Field label={copy.event.login.name} hint={copy.event.login.nameHint}>
        {(id) => (
          <Input id={id} maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
        )}
      </Field>
      <div className="flex flex-wrap items-start gap-3">
        <ActionButton
          variant="primary"
          disabled={code.length !== 6}
          resetOn={`${code}|${name}`}
          action={async () => {
            await visitorApi.verifyOtp(sentTo, code, name.trim());
            onLoggedIn();
          }}
        >
          {copy.event.login.verify}
        </ActionButton>
        <ActionButton
          disabled={!humanReady}
          action={async () => {
            const r = await visitorApi.requestOtp(sentTo, turnstile.token);
            turnstile.reset();
            setDevCode(r.devCode ?? null);
            if (r.devCode) setCode(r.devCode);
          }}
        >
          {copy.event.login.resend}
        </ActionButton>
      </div>
    </div>
  );
}
