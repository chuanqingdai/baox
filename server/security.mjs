import process from "node:process";
import {Buffer} from "node:buffer";
import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { imageSize } from "image-size";
const derive = promisify(scrypt);
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
export const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
export function validatePassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128 ||
    !/[a-zA-Z]/.test(password) ||
    !/[0-9]/.test(password)
  )
    fail(400, "密码需为10–128位，并包含字母与数字。");
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${salt}$${key.toString("hex")}`;
}
export async function verifyPassword(password, hash) {
  const [scheme, salt, key] = String(hash).split("$");
  if (scheme !== "scrypt" || !salt || !/^[a-f0-9]{128}$/.test(key || ""))
    return false;
  const candidate = await derive(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(candidate, Buffer.from(key, "hex"));
}
export function cookieToken(req) {
  const cookie = String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("baox_session="));
  const token = cookie?.slice(13) || "";
  return /^[a-f0-9]{64}$/.test(token) ? token : "";
}
export function sessionCookie(token, seconds = SESSION_SECONDS) {
  return `baox_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${seconds}${process.env.NODE_ENV === "production" || process.env.VERCEL || typeof Deno !== "undefined" ? "; Secure" : ""}`;
}
export function assertSameOrigin(req) {
  const allowed = new URL(process.env.SITE_ORIGIN || "https://baox.ai").origin;
  const origin = req.headers.origin;
  if (!origin || origin !== allowed)
    fail(403, "请求来源不受信任，请从本站重新操作。");
  if (!String(req.headers["content-type"] || "").startsWith("application/json"))
    fail(415, "请使用 JSON 请求。");
}
export async function readBody(req) {
  const limit = 420000;
  if (Number(req.headers["content-length"]) > limit)
    fail(413, "上传内容过大。");
  if (req.body && typeof req.body === "object") {
    if (Array.isArray(req.body)) fail(400, "无效请求。");
    if (Buffer.byteLength(JSON.stringify(req.body)) > limit)
      fail(413, "上传内容过大。");
    return req.body;
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > limit) fail(413, "上传内容过大。");
  }
  try {
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
      fail(400, "无效请求。");
    return parsed;
  } catch {
    fail(400, "请求内容格式不正确。");
  }
}
export function validateAvatar(value) {
  if (value === "") return "";
  if (
    typeof value !== "string" ||
    value.length > 120000 ||
    !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)
  )
    fail(400, "头像需为压缩后的 JPG、PNG 或 WebP 图片。");
  const [, kind] = value.match(/^data:image\/(\w+);/);
  const data = Buffer.from(value.split(",")[1], "base64");
  const magic =
    kind === "jpeg"
      ? data[0] === 255 && data[1] === 216 && data[2] === 255
      : kind === "png"
        ? data
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : data.subarray(0, 4).toString() === "RIFF" &&
          data.subarray(8, 12).toString() === "WEBP";
  if (!magic) fail(400, "头像文件格式不正确。");
  try {
    const { width, height } = imageSize(data);
    if (!width || !height || width > 1024 || height > 1024)
      fail(400, "请上传压缩后的头像，边长不超过1024像素。");
  } catch (error) {
    if (error.status) throw error;
    fail(400, "无法识别头像图片。");
  }
  return value;
}
