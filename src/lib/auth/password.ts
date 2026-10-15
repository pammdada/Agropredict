import { hash, verify } from "@node-rs/argon2";

// argon2id with OWASP-recommended parameters (19 MiB, 2 iterations).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string | null, password: string): Promise<boolean> {
  if (!passwordHash) return false;
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export const PASSWORD_RULES = "Mínimo 10 caracteres, con al menos una letra y un número.";

export function isStrongPassword(password: string): boolean {
  return password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password);
}
