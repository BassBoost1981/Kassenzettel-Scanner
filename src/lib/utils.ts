import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format amount as EUR currency / Betrag als EUR-Währung formatieren
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

// Format ISO date string to German locale / ISO-Datumsstring ins deutsche Format
export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("de-DE");
}
