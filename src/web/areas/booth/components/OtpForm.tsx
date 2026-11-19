import type { BoothAuthPurpose } from "@shared/schemas";
import { useState } from "react";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Button } from "../../../components/ui/Button";
import { Field, Input } from "../../../components/ui/Form";
import { copy } from "../../../lib/copy";
import type { TurnstileState } from "../../../lib/turnstile";
import { boothApi } from "../booth-api";

/**
 * Verifikasi email dua langkah (minta kode → isi kode), dipakai untuk masuk dan mendaftar. Setelah kode benar,
 * `onVerified(email)` dipanggil: untuk "login" server sudah memasang sesi, untuk "register" server memasang bukti email.
 * Di dev lokal server mengembalikan `devCode` supaya alur bisa dicoba tanpa penyedia email.
 */
export function OtpForm({
  purpose,
  turnstile,
  onVerified,
}: {
  purpose: BoothAuthPurpose;
  turnstile: TurnstileState;
  onVerified: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const humanReady = !turnstile.required || !!turnstile.token;
  const t = copy.booth.otp;

  const request = async (to: string) => {
    const r = await boothApi.requestOtp(to, purpose, turnstile.token);
    turnstile.reset();
    setDevCode(r.devCode ?? null);
    if (r.devCode) setCode(r.devCode);
    setSentTo(to);
  };

  if (sentTo === null) {
    return (
      <div className="grid gap-3">
        <Field label={t.email} hint={t.emailHint}>
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
        <div>
          <ActionButton
            variant="primary"
            disabled={!email.includes("@") || !humanReady}
            resetOn={email}
            action={() => request(email.trim())}
          >
            {t.sendCode}
          </ActionButton>
        </div>
        {!humanReady && <p className="text-xs text-muted">{t.humanWait}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <p role="status" className="text-sm">
        {purpose === "register" ? t.codeSentRegister(sentTo) : t.codeSent(sentTo)}
      </p>
      {devCode && <p className="text-xs font-bold text-accent-strong">{t.devCode(devCode)}</p>}
      <Field label={t.code}>
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
      <div className="flex flex-wrap items-start gap-3">
        <ActionButton
          variant="primary"
          disabled={code.length !== 6}
          resetOn={code}
          action={async () => {
            await boothApi.verifyOtp(sentTo, purpose, code);
            onVerified(sentTo);
          }}
        >
          {t.verify}
        </ActionButton>
        <ActionButton disabled={!humanReady} action={() => request(sentTo)}>
          {t.resend}
        </ActionButton>
        <Button
          variant="ghost"
          onClick={() => {
            setSentTo(null);
            setCode("");
            setDevCode(null);
          }}
        >
          {t.changeEmail}
        </Button>
      </div>
    </div>
  );
}
