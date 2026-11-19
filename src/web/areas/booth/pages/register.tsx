import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/states";
import { useEventData } from "../../../features/event-data";
import { copy } from "../../../lib/copy";
import { useEventState } from "../../../lib/event-state";
import { useTurnstile } from "../../../lib/turnstile";
import { boothApi, boothKeys } from "../booth-api";
import { OtpForm } from "../components/OtpForm";
import { emptyProfile, ProfileFields, type ProfileValues } from "../components/ProfileFields";
import { useBoothSession } from "../session";

/** Pendaftaran mandiri (A4): verifikasi email (OTP) → profil (hanya nama yang wajib) → menunggu admin. */
export function Component() {
  const { event, serverNow } = useEventData();
  const state = useEventState();
  const t = copy.booth.register;

  if (state.frozen) return <EmptyState title={t.endedTitle} body={t.endedBody} />;
  if (!state.registrationAccepting) {
    const open = event.schedule.registrationOpenAt;
    const notYet = open !== null && serverNow() < open;
    return notYet ? (
      <EmptyState title={t.notYetTitle} body={t.notYetBody} />
    ) : (
      <EmptyState title={t.closedTitle} body={t.closedBody} />
    );
  }
  return <RegisterFlow late={state.registrationIsLate} />;
}

function RegisterFlow({ late }: { late: boolean }) {
  const t = copy.booth.register;
  const session = useBoothSession();
  const turnstile = useTurnstile(session.data?.turnstileSiteKey ?? null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileValues>(emptyProfile);

  // Sudah punya sesi (mis. baru mendaftar atau sudah punya booth): arahkan ke portal.
  if (session.data?.me) {
    return (
      <Card title={t.alreadyHave}>
        <Link to="/booth" className="font-bold text-primary-strong underline">
          {t.toPortal}
        </Link>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-1">
        <h1 className="font-display text-3xl font-extrabold">{t.title}</h1>
        <p className="text-muted">{t.intro}</p>
      </div>
      {late && (
        <p
          role="status"
          className="rounded-card border-(length:--border-w) border-line bg-surface-tint px-4 py-2 text-sm"
        >
          {t.lateNotice}
        </p>
      )}

      <Card title={t.emailStep}>
        {email === null ? (
          <>
            <div ref={turnstile.ref} />
            <OtpForm purpose="register" turnstile={turnstile} onVerified={setEmail} />
          </>
        ) : (
          <p role="status" className="text-sm font-bold text-primary-strong">
            {t.verified(email)}
          </p>
        )}
      </Card>

      {email !== null && (
        <Card title={t.profileStep}>
          <ProfileFields value={profile} onChange={setProfile} />
          <p className="text-xs text-muted">{t.photoTip}</p>
          <div>
            <ActionButton
              variant="primary"
              disabled={profile.name.trim() === ""}
              resetOn={JSON.stringify(profile)}
              action={async (ctx) => {
                await boothApi.register(
                  {
                    email,
                    name: profile.name,
                    boothNo: profile.boothNo,
                    tagline: profile.tagline,
                    description: profile.description,
                    teamName: profile.teamName,
                  },
                  ctx,
                );
                await qc.invalidateQueries({ queryKey: boothKeys.session });
                navigate("/booth", { state: { registered: true } });
              }}
            >
              {t.submit}
            </ActionButton>
          </div>
        </Card>
      )}
      <p className="text-sm text-muted">
        {t.alreadyHave}{" "}
        <Link to="/booth" className="font-bold text-primary-strong underline">
          {t.loginLink}
        </Link>
      </p>
    </>
  );
}
