export const ksh = (cents: number) =>
  "KSh " + (cents / 100).toLocaleString("en-KE", { maximumFractionDigits: 0 });

export const normalizeKePhone = (raw: string) => {
  const d = raw.replace(/[^\d]/g, "");
  if (/^0[17]\d{8}$/.test(d)) return "254" + d.slice(1);
  if (/^[17]\d{8}$/.test(d)) return "254" + d;
  if (/^254[17]\d{8}$/.test(d)) return d;
  return null;
};
