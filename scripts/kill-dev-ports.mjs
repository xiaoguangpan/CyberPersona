#!/usr/bin/env node
// Cross-platform helper: kill any process listening on the dev port range.
// Works on Windows (netstat) and macOS / Linux (lsof). Pure Node, no extra deps.
import { execFileSync } from "node:child_process";

const ports = [3000, 3001, 3002, 3003, 3004];
const isWin = process.platform === "win32";

function findPidsWindows(port) {
  let out = "";
  try {
    out = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
  } catch {
    return [];
  }
  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("TCP") && !trimmed.startsWith("UDP")) continue;
    const cols = trimmed.split(/\s+/);
    const local = cols[1] || "";
    if (!local.endsWith(`:${port}`)) continue;
    const state = cols[3] || "";
    if (cols[0] === "TCP" && state !== "LISTENING") continue;
    const pid = cols[cols.length - 1];
    if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
  }
  return [...pids];
}

function findPidsUnix(port) {
  try {
    const out = execFileSync("lsof", ["-tiTCP:" + port, "-sTCP:LISTEN"], { encoding: "utf8" });
    return out.split(/\s+/).filter(Boolean);
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (isWin) execFileSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
    else execFileSync("kill", ["-9", pid], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

let total = 0;
for (const port of ports) {
  const pids = isWin ? findPidsWindows(port) : findPidsUnix(port);
  if (pids.length === 0) {
    console.log(`port ${port}: free`);
    continue;
  }
  for (const pid of pids) {
    const ok = killPid(pid);
    console.log(`port ${port}: ${ok ? "killed" : "failed to kill"} pid ${pid}`);
    if (ok) total += 1;
  }
}
console.log(`Done. ${total} process(es) terminated.`);
