export function clampString(value: string | undefined | null, maxLen: number): string {
  const cleaned = (value ?? '').trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysAgoIsoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function generateDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function formatCurrency(amount: number, symbol = '₹'): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

export function formatCompactCurrency(amount: number, symbol = '₹'): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}${symbol}${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}${symbol}${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}${symbol}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

export function isExpiringSoon(expiryDate: string, withinDays = 45): boolean {
  if (!expiryDate || expiryDate.length !== 10) return false;
  const exp = new Date(expiryDate + 'T00:00:00');
  if (Number.isNaN(exp.getTime())) return false;
  const now = new Date();
  const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= withinDays;
}

export function isExpired(expiryDate: string): boolean {
  if (!expiryDate || expiryDate.length !== 10) return false;
  const exp = new Date(expiryDate + 'T00:00:00');
  if (Number.isNaN(exp.getTime())) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return exp.getTime() < now.getTime();
}
