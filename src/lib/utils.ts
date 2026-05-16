import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatPhone(phone: string) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 11) return phone;
  return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
}

export function maskPhone(phone: string) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 11) return phone;
  return `${digits.slice(0, 3)}****${digits.slice(7)}`;
}

export function formatDuration(sec: number) {
  if (!Number.isFinite(sec)) return "0''";
  const rounded = Math.max(1, Math.round(sec));
  return `${rounded}''`;
}

export function pluralize(count: number, unit: string) {
  return `${count} ${unit}`;
}

export function initials(name: string) {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const first = trimmed[0];
  return first.toUpperCase();
}
