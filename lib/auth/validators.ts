export const isEmail = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v ?? "").trim());

// M1 spec 4.1: minimum 10 characters, no composition rules — length and
// uniqueness beat complexity theatre.
export const isPass = (v: string) => (v ?? "").length >= 10;
