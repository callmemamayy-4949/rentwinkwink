import test from "node:test";
import assert from "node:assert/strict";
import uploadImage from "../netlify/functions/upload-image.mjs";

const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");

function request(password = "secret", filename = "page-background.png") {
  return new Request("https://example.netlify.app/.netlify/functions/upload-image", {
    method: "POST",
    headers: { "content-type": "application/json", "x-upload-password": password },
    body: JSON.stringify({ filename, contentBase64: pngBase64, mimeType: "image/png" }),
  });
}

test.beforeEach(() => {
  process.env.UPLOAD_PASSWORD = "secret";
  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_OWNER = "callmemamayy-4949";
  process.env.GITHUB_REPO = "rentwinkwink";
  process.env.GITHUB_BRANCH = "main";
});

test("rejects an incorrect uploader password", async () => {
  const response = await uploadImage(request("wrong"));
  assert.equal(response.status, 401);
});

test("rejects unsafe filenames", async () => {
  const response = await uploadImage(request("secret", "../secret.png"));
  assert.equal(response.status, 400);
});

test("uploads a PNG and returns its raw GitHub URL", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (!options.method) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    return new Response(JSON.stringify({ commit: { html_url: "https://github.com/example/commit/1" } }), { status: 201 });
  };
  try {
    const response = await uploadImage(request());
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].options.method, "PUT");
    assert.equal(body.rawUrl, "https://raw.githubusercontent.com/callmemamayy-4949/rentwinkwink/main/public/images/uploads/page-background.png");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("adds a timestamp instead of overwriting an existing file", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  Date.now = () => 1234567890;
  globalThis.fetch = async (_url, options = {}) => {
    if (!options.method) return new Response(JSON.stringify({ sha: "existing" }), { status: 200 });
    return new Response("{}", { status: 201 });
  };
  try {
    const response = await uploadImage(request());
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.path, "public/images/uploads/page-background-1234567890.png");
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});
