const form = document.querySelector("#upload-form");
const passwordInput = document.querySelector("#upload-password");
const fileInput = document.querySelector("#image-file");
const filenameInput = document.querySelector("#filename");
const dropZone = document.querySelector("#drop-zone");
const previewPanel = document.querySelector("#preview-panel");
const imagePreview = document.querySelector("#image-preview");
const fileSummary = document.querySelector("#file-summary");
const uploadButton = document.querySelector("#upload-button");
const statusBox = document.querySelector("#status");
const result = document.querySelector("#result");
const resultUrl = document.querySelector("#result-url");
const copyButton = document.querySelector("#copy-button");
const openImageLink = document.querySelector("#open-image-link");
const uploadAnotherButton = document.querySelector("#upload-another");

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
let selectedFile = null;
let previewObjectUrl = null;

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function safeFilename(file) {
  const extension = EXTENSIONS[file.type];
  const withoutExtension = file.name.replace(/\.[^.]+$/, "");
  const base = slugify(withoutExtension) || `winkwink-image-${Date.now()}`;
  return `${base}.${extension}`;
}

function normalizeFilename(value, file) {
  const extension = EXTENSIONS[file.type];
  const withoutExtension = String(value || "").replace(/\.[^.]+$/, "");
  const base = slugify(withoutExtension) || `winkwink-image-${Date.now()}`;
  return `${base}.${extension}`;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function setStatus(message, isError = false) {
  statusBox.hidden = !message;
  statusBox.textContent = message;
  statusBox.classList.toggle("is-error", isError);
}

function resetFile() {
  selectedFile = null;
  fileInput.value = "";
  filenameInput.value = "";
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
  imagePreview.removeAttribute("src");
  previewPanel.hidden = true;
  result.hidden = true;
  setStatus("");
  fileInput.focus();
}

function setSelectedFile(file) {
  if (!file) return;
  if (!EXTENSIONS[file.type]) {
    setStatus("รองรับเฉพาะไฟล์ JPG, PNG และ WebP", true);
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    setStatus("ไฟล์ต้องมีขนาดไม่เกิน 4 MB", true);
    return;
  }

  selectedFile = file;
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  imagePreview.src = previewObjectUrl;
  filenameInput.value = safeFilename(file);
  fileSummary.textContent = `${file.name} · ${formatBytes(file.size)}`;
  previewPanel.hidden = false;
  result.hidden = true;
  setStatus("");
}

async function fileToBase64(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
  return String(dataUrl).split(",", 2)[1];
}

fileInput.addEventListener("change", () => setSelectedFile(fileInput.files[0]));

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
}

dropZone.addEventListener("drop", (event) => setSelectedFile(event.dataTransfer.files[0]));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.hidden = true;

  if (!form.reportValidity()) return;
  if (!selectedFile) {
    setStatus("กรุณาเลือกรูปก่อนอัปโหลด", true);
    return;
  }

  const filename = normalizeFilename(filenameInput.value, selectedFile);
  filenameInput.value = filename;
  uploadButton.disabled = true;
  uploadButton.classList.add("is-loading");
  setStatus("กำลังอัปโหลดรูปไปยัง GitHub…");

  try {
    const contentBase64 = await fileToBase64(selectedFile);
    const response = await fetch("/.netlify/functions/upload-image", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-upload-password": passwordInput.value,
      },
      body: JSON.stringify({ filename, contentBase64, mimeType: selectedFile.type }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `อัปโหลดไม่สำเร็จ (${response.status})`);

    resultUrl.value = payload.rawUrl;
    openImageLink.href = payload.rawUrl;
    result.hidden = false;
    setStatus(`อัปโหลด ${formatBytes(selectedFile.size)} สำเร็จ`);
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    setStatus(error.message || "อัปโหลดไม่สำเร็จ", true);
  } finally {
    uploadButton.disabled = false;
    uploadButton.classList.remove("is-loading");
  }
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(resultUrl.value);
  } catch {
    resultUrl.select();
    document.execCommand("copy");
  }
  copyButton.textContent = "คัดลอกแล้ว ✓";
  window.setTimeout(() => { copyButton.textContent = "คัดลอก URL"; }, 1600);
});

uploadAnotherButton.addEventListener("click", resetFile);
