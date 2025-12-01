import bcrypt from "bcrypt";
import { config } from "~/lib/config.server";

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const rounds = config<number>("auth.password.bcryptRounds", 12);
  return bcrypt.hash(password, rounds);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password meets requirements
 */
export function validatePassword(password: string): {
  valid: boolean;
  error?: string;
} {
  const minLength = config<number>("auth.password.minLength", 8);

  if (!password || password.length < minLength) {
    return {
      valid: false,
      error: `Password must be at least ${minLength} characters`,
    };
  }

  return { valid: true };
}
