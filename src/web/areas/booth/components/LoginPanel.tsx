import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { Card } from "../../../components/ui/Card";
import { copy } from "../../../lib/copy";
import { useEventState } from "../../../lib/event-state";
import { useTurnstile } from "../../../lib/turnstile";
import { boothKeys } from "../booth-api";
import { OtpForm } from "./OtpForm";

/** Masuk ke portal dengan email pemilik (OTP). `ownerChanged` = sesi lama diakhiri karena admin mengubah pemilik (B7). */
export function LoginPanel({
  turnstileSiteKey,
  ownerChanged,
}: {
  turnstileSiteKey: string | null;
  ownerChanged: boolean;
}) {
  const t = copy.booth.login;
  const qc = useQueryClient();
  const turnstile = useTurnstile(turnstileSiteKey);
  const { registrationAccepting } = useEventState();
  return (
    <>
      <div className="grid gap-1">
        <h1 className="font-display text-3xl font-extrabold">{t.title}</h1>
        <p className="text-muted">{t.intro}</p>
      </div>
      {ownerChanged && (
        <p
          role="alert"
          className="rounded-card border-(length:--border-w) border-line bg-surface-tint px-4 py-2 text-sm"
        >
          {t.ownerChanged}
        </p>
      )}
      <Card>
        <div ref={turnstile.ref} />
        <OtpForm
          purpose="login"
          turnstile={turnstile}
          onVerified={() => void qc.invalidateQueries({ queryKey: boothKeys.session })}
        />
      </Card>
      <p className="text-xs text-muted">{t.noOwnerNote}</p>
      {registrationAccepting && (
        <p className="text-sm text-muted">
          {t.noAccount}{" "}
          <Link to="/register" className="font-bold text-primary-strong underline">
            {t.registerLink}
          </Link>
        </p>
      )}
    </>
  );
}
