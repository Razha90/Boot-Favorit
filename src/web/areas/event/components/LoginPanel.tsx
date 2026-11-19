import type { VisitorMe } from "@shared/api-types";
import { useRef, useState } from "react";
import { ActionButton, describeError } from "../../../components/ui/ActionButton";
import { Field, Input } from "../../../components/ui/Form";
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

function SimpleLogin({
  mode,
  turnstile,
  onLoggedIn,
}: {
  mode: "ticket_code" | "open_turnstile";
  turnstile: TurnstileState;
  onLoggedIn: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const humanReady = !turnstile.required || !!turnstile.token;
  const ticket = mode === "ticket_code";
  return (
    <div className="grid gap-3">
      {ticket && (
        <Field label={copy.event.login.ticket} hint={copy.event.login.ticketHint}>
          {(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value)} />}
        </Field>
      )}
      <Field label={copy.event.login.name} info={copy.event.login.nameInfo}>
        {(id) => (
          <Input
            id={id}
            maxLength={30}
            placeholder={copy.event.login.anonymousName}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </Field>
      <ActionButton
        variant="primary"
        disabled={ticket ? code.trim().length < 4 : !humanReady}
        resetOn={`${code}|${name}`}
        action={async () => {
          if (ticket) await visitorApi.ticket(code.trim(), name.trim());
          else await visitorApi.anonymous(name.trim(), turnstile.token);
          turnstile.reset();
          onLoggedIn();
        }}
      >
        {ticket ? copy.event.login.verify : copy.event.login.anonymous}
      </ActionButton>
    </div>
  );
}

/** Masuk sekali per event; bentuknya mengikuti `reviewerAuthMode` event (A6). */
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
        <p className="text-xs leading-relaxed text-muted">
          {copy.event.login.why}
          {me.authMode === "open_turnstile" ? ` ${copy.event.login.anonymousHint}` : ""}
        </p>
      </div>
      {me.authMode === "google_or_email" ? (
        <>
          {me.googleClientId && (
            <>
              <GoogleLogin
                clientId={me.googleClientId}
                turnstile={turnstile}
                onLoggedIn={onLoggedIn}
              />
              <p className="text-center text-xs text-muted">{copy.event.login.or}</p>
            </>
          )}
          <EmailLogin turnstile={turnstile} onLoggedIn={onLoggedIn} />
        </>
      ) : (
        <SimpleLogin mode={me.authMode} turnstile={turnstile} onLoggedIn={onLoggedIn} />
      )}
    </div>
  );
}
