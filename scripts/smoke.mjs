#!/usr/bin/env node
// Lightweight end-to-end smoke test. Run after `npm run dev` is up.
//
// Usage:
//   node scripts/smoke.mjs            # uses http://127.0.0.1:3000
//   BASE=https://example.com node scripts/smoke.mjs
//
// Performs:
//   1. /api/health
//   2. register a fresh phone (auto-promoted to admin if first)
//   3. /api/auth/me round-trip
//   4. /api/personas/active or /api/personas/assign (auto-creates a persona)
//   5. /api/chat/send a real LLM turn
//   6. /api/admin/overview + /api/admin/turns (admin only)
//   7. /api/auth/logout

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const phone = process.env.SMOKE_PHONE || `1${String(Date.now()).slice(-10)}`;
const password = process.env.SMOKE_PASSWORD || "Smoke@123456";

let cookie = "";

function mergeCookies(setCookie) {
  if (!setCookie) return;
  const parts = setCookie.split(/,(?=[^ ]+=)/);
  for (const part of parts) {
    const segment = part.split(";")[0];
    const [name] = segment.split("=");
    cookie = cookie
      .split("; ")
      .filter(Boolean)
      .filter((existing) => !existing.startsWith(`${name}=`))
      .concat(segment)
      .join("; ");
  }
}

async function call(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  mergeCookies(response.headers.get("set-cookie"));
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  return { status: response.status, payload };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`\u2717 ${message}`);
    process.exit(1);
  }
  console.log(`\u2713 ${message}`);
}

async function main() {
  console.log(`Smoke target: ${BASE}`);
  console.log(`Smoke phone:  ${phone}`);

  const health = await call("GET", "/api/health");
  assert(health.status === 200 && health.payload.ok, "/api/health responds 200");
  console.log("  providers:", health.payload.providers);

  const reg = await call("POST", "/api/auth/register", { phone, password, confirmPassword: password });
  assert(reg.status === 200 && reg.payload.ok, `register ${phone}`);

  const me = await call("GET", "/api/auth/me");
  assert(me.status === 200 && me.payload.user?.phone === phone, "/api/auth/me returns current user");
  console.log("  isAdmin:", me.payload.user?.isAdmin);

  let persona = await call("GET", "/api/personas/active");
  if (persona.status === 200 && !persona.payload.persona) {
    console.log("  no active persona yet, calling /api/personas/assign...");
    const assign = await call("POST", "/api/personas/assign");
    assert(assign.status === 200 && assign.payload.ok, "/api/personas/assign creates a persona");
    persona = await call("GET", "/api/personas/active");
  }
  assert(persona.status === 200 && persona.payload.persona, "/api/personas/active returns a persona");
  console.log("  persona:", persona.payload.persona?.nickname);

  const send = await call("POST", "/api/chat/send", { type: "text", text: "你好，今天还顺利吗？" });
  assert(send.status === 200 && send.payload.ok, "/api/chat/send real LLM turn ok");
  const assistantText = send.payload.assistant?.[0]?.text;
  console.log("  reply:", assistantText);
  console.log("  creditsLeft:", send.payload.creditsLeft);

  if (me.payload.user?.isAdmin) {
    const overview = await call("GET", "/api/admin/overview");
    assert(overview.status === 200 && overview.payload.ok, "/api/admin/overview admin only");
    const turns = await call("GET", "/api/admin/turns");
    const lastTurn = turns.payload?.turns?.[0];
    console.log("  last turn validation:", lastTurn?.validationStatus, "latency:", lastTurn?.latencyMs);
  } else {
    console.log("\u26a0 Skipping admin checks (this account is not admin).");
  }

  const logout = await call("POST", "/api/auth/logout");
  assert(logout.status === 200, "logout ok");

  console.log("\nSmoke OK \u2713");
}

main().catch((error) => {
  console.error("Smoke failed:", error);
  process.exit(1);
});
