import type { VisitorMe } from "@shared/api-types";
import { useRef } from "react";
import { describeError } from "../../../components/ui/ActionButton";
import { copy } from "../../../lib/copy";
import { GoogleButton } from "../../../lib/google-signin";
import type { TurnstileState } from "../../../lib/turnstile";
import { useAction } from "../../../lib/use-action";
import { visitorApi } from "../visitor-data";
import { EmailLogin } from "./EmailLogin";

function GoogleLogin({
  clientId,
  turnstile,
  onLoggedIn,
}: {
  clientId: string;
  turnstile: TurnstileState;
  onLoggedIn: () => void;
}) {
  const credential = useRef("");
  const login = useAction(async () => {
    await visitorApi.google(credential.current, turnstile.token);
    turnstile.reset();
    onLoggedIn();
  });
  return (
    <div className="grid gap-2">
      <GoogleButton
        clientId={clientId}
        onCredential={(c) => {
          credential.current = c;
          void login.run();
        }}
      />
      {login.status === "pending" && (
        <p className="text-xs text-muted">{copy.event.login.checking}</p>
      )}
      {login.status === "error" && login.error && (
        <p role="alert" className="text-xs text-danger">
          {describeError(login.error)}
        </p>
      )}
    </div>
  );
}

/** Masuk dengan email terverifikasi (kode OTP) atau Google. Tidak ada login anonim dan tidak ada keluar (A6). */
export function LoginPanel({
  me,
  turnstile,
  onLoggedIn,
}: {
  me: VisitorMe;
  turnstile: TurnstileState;
  onLoggedIn: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1 rounded-card bg-surface-tint px-3.5 py-2.5">
        <h3 className="font-display text-base font-extrabold">{copy.event.login.title}</h3>
        <p className="text-xs leading-relaxed text-muted">{copy.event.login.why}</p>
      </div>
      {me.googleClientId && (
        <>
          <GoogleLogin clientId={me.googleClientId} turnstile={turnstile} onLoggedIn={onLoggedIn} />
          <p className="text-center text-xs text-muted">{copy.event.login.or}</p>
        </>
      )}
      <EmailLogin turnstile={turnstile} onLoggedIn={onLoggedIn} />
    </div>
  );
}
