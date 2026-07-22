import { timingSafeEqual } from "node:crypto";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const SAFE_FILENAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpe?g|png|webp)$/;
const MIME_EXTENSIONS = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function passwordMatches(provided, expected) {
  if (!provided || !expected) return false;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

function detectedMime(buffer) {
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

function appendSuffix(filename) {
  const dot = filename.lastIndexOf(".");
  return `${filename.slice(0, dot)}-${Date.now()}${filename.slice(dot)}`;
}

export default async function uploadImage(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const uploadPassword = process.env.UPLOAD_PASSWORD;
  const githubToken = process.env.GITHUB_TOKEN;
  if (!uploadPassword || !githubToken) return json({ error: "ระบบยังตั้งค่าไม่ครบ กรุณาแจ้งเจ้าของเว็บ" }, 500);
  if (!passwordMatches(request.headers.get("x-upload-password"), uploadPassword)) {
    return json({ error: "รหัสผ่านไม่ถูกต้อง" }, 401);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, 400);
  }

  let filename = String(payload.filename || "").toLowerCase();
  const contentBase64 = String(payload.contentBase64 || "");
  const claimedMime = String(payload.mimeType || "");
  if (!SAFE_FILENAME.test(filename)) return json({ error: "ชื่อไฟล์ไม่ถูกต้อง" }, 400);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(contentBase64)) return json({ error: "ข้อมูลรูปไม่ถูกต้อง" }, 400);

  const content = Buffer.from(contentBase64, "base64");
  if (!content.length || content.length > MAX_FILE_BYTES) return json({ error: "ไฟล์ต้องมีขนาดไม่เกิน 4 MB" }, 413);

  const actualMime = detectedMime(content);
  const extension = filename.split(".").at(-1);
  if (!actualMime || actualMime !== claimedMime || !MIME_EXTENSIONS[actualMime]?.includes(extension)) {
    return json({ error: "ชนิดไฟล์รูปไม่ตรงกับนามสกุล" }, 415);
  }

  const owner = process.env.GITHUB_OWNER || "callmemamayy-4949";
  const repo = process.env.GITHUB_REPO || "rentwinkwink";
  const branch = process.env.GITHUB_BRANCH || "main";
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${githubToken}`,
    "x-github-api-version": "2022-11-28",
    "user-agent": "winkwink-image-uploader",
  };

  let path = `public/images/uploads/${filename}`;
  let apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
  const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  if (existing.ok) {
    filename = appendSuffix(filename);
    path = `public/images/uploads/${filename}`;
    apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
  } else if (existing.status !== 404) {
    return json({ error: "เชื่อมต่อ GitHub ไม่สำเร็จ กรุณาลองใหม่" }, 502);
  }

  const uploaded = await fetch(apiUrl, {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({
      message: `Add uploaded image: ${filename}`,
      content: contentBase64,
      branch,
    }),
  });

  const githubResponse = await uploaded.json().catch(() => ({}));
  if (!uploaded.ok) return json({ error: "GitHub ปฏิเสธการอัปโหลด กรุณาลองใหม่" }, 502);

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  return json({ ok: true, path, rawUrl }, 201);
}

export const config = { path: "/.netlify/functions/upload-image" };
