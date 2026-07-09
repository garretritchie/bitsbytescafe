import assert from "node:assert/strict";
import test from "node:test";
import {
  createPasswordCredential,
  isPasswordCredentialValid,
  verifyPasswordCredential
} from "../scripts/admin-password-auth.mjs";

test("creates a salted credential that verifies the matching password only", async () => {
  const credential = await createPasswordCredential("simple-password");

  assert.equal(isPasswordCredentialValid(credential), true);
  assert.equal(await verifyPasswordCredential("simple-password", credential), true);
  assert.equal(await verifyPasswordCredential("wrong-password", credential), false);
});

test("rejects blank passwords", async () => {
  await assert.rejects(
    () => createPasswordCredential("   "),
    /Password is required/
  );
});
