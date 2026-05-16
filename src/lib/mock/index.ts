import type { UserProfile } from "../types";

export const CURRENT_USER: UserProfile = {
  id: "u_self",
  phone: "13912340000",
  avatarColor: "#1c1917",
  credits: 100,
  createdAt: "2026-01-08T11:00:00.000Z",
  lastLoginAt: "2026-05-15T08:21:00.000Z",
  todayCreationCount: 1,
  dailyCreationLimit: 3,
  breakupCountToday: 0,
};

export * from "./persona";
export * from "./messages";
export * from "./album";
export * from "./admin";
