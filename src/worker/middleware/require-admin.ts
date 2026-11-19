// Hanya admin yang boleh masuk /api/admin/* (explore.md B7). Tidak ada login admin buatan sendiri:
// Cloudflare Access yang mengautentikasi, Worker memverifikasi JWT-nya lalu mencocokkan email dengan daftar admin.

import { ApiError } from "@shared/errors";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app-env";
import {
  AccessAuthError,
  type AccessJwk,
  fetchAccessJwks,
  type JwksFetcher,
  verifyAccessJwt,
} from "../lib/access-jwt";
import { logEvent } from "../lib/logger";

const ACCESS_HEADER = "Cf-Access-Jwt-Assertion";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const parseAdminList = (raw: string | undefined) =>
  new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

export interface RequireAdminOptions {
  getJwks?: JwksFetcher;
}

export function requireAdmin(opts: RequireAdminOptions = {}) {
  const getJwks = opts.getJwks ?? fetchAccessJwks;

  return createMiddleware<AppEnv>(async (c, next) => {
    const deny = (reason: string): never => {
      logEvent(c, {
        eventId: c.get("event")?.id ?? "-",
        category: "auth",
        action: "auth.admin_denied",
        level: "warn",
        meta: { reason },
      });
      throw new ApiError("unauthorized");
    };

    // Jalur pengembangan lokal: ketat, dan tidak mungkin aktif di produksi.
    const host = new URL(c.req.url).hostname;
    if (c.env.APP_ENV === "development" && c.env.DEV_ADMIN_EMAIL && LOCAL_HOSTS.has(host)) {
      c.set("admin", { email: c.env.DEV_ADMIN_EMAIL.toLowerCase() });
      return next();
    }

    const { ACCESS_TEAM_DOMAIN: team, ACCESS_AUD: aud, ADMIN_EMAILS: list } = c.env;
    if (!team || !aud) return deny("access_not_configured"); // gagal tertutup bila belum dikonfigurasi

    const token = c.req.header(ACCESS_HEADER);
    if (!token) return deny("no_token");

    const now = c.get("now")();
    const verify = (keys: readonly AccessJwk[]) =>
      verifyAccessJwt(token, { keys, audience: aud, issuer: `https://${team}`, now });

    let payload: Awaited<ReturnType<typeof verifyAccessJwt>>;
    try {
      try {
        payload = await verify(await getJwks(team, false, now));
      } catch (err) {
        // Kunci Access dirotasi: coba sekali lagi dengan kunci segar.
        if (err instanceof AccessAuthError && err.message === "jwt_unknown_kid") {
          payload = await verify(await getJwks(team, true, now));
        } else {
          throw err;
        }
      }
    } catch (err) {
      return deny(err instanceof AccessAuthError ? err.message : "jwt_error");
    }

    if (!parseAdminList(list).has(payload.email)) return deny("not_in_admin_list");
    c.set("admin", { email: payload.email });
    await next();
  });
}
