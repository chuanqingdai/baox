import { hashPassword } from "../server/security.mjs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
const muted = new Writable({
  write(chunk, encoding, callback) {
    callback();
  },
});
const reader = createInterface({
  input: process.stdin,
  output: muted,
  terminal: !!process.stdin.isTTY,
});
try {
  console.error("Enter administrator password (hidden input):");
  const password = await reader.question("");
  if (password.length < 8 || password.length > 128)
    throw new Error("Administrator password must be 8–128 characters.");
  console.log(await hashPassword(password));
} finally {
  reader.close();
}
