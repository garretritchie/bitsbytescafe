import { createHash, randomBytes } from "node:crypto";

export function hashPasswordWithSalt(password, salt) {
  return createHash("sha256").update(`${salt}|${password}`, "utf8").digest("hex");
}

export async function createPasswordCredential(password) {
  if (!password || !password.trim()) {
    throw new Error("Password is required");
  }

  const password_salt = randomBytes(16).toString("hex");
  return {
    password_salt,
    password_hash: hashPasswordWithSalt(password, password_salt),
    password_updated_at: new Date().toISOString()
  };
}

export function isPasswordCredentialValid(credential) {
  return Boolean(
    credential?.password_salt &&
    /^[a-f0-9]{32}$/i.test(credential.password_salt) &&
    credential?.password_hash &&
    /^[a-f0-9]{64}$/i.test(credential.password_hash)
  );
}

export async function verifyPasswordCredential(password, credential) {
  if (!isPasswordCredentialValid(credential)) return false;
  return hashPasswordWithSalt(password, credential.password_salt) === credential.password_hash;
}
