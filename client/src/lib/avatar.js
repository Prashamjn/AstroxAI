export async function fileToAvatarDataUrl(file, { maxSize = 256, quality = 0.85 } = {}) {
  if (!file || !file.type?.startsWith("image/")) {
    throw new Error("Invalid image file");
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Failed to load image"));
    i.src = String(dataUrl);
  });

  let w = img.width;
  let h = img.height;
  if (w > maxSize || h > maxSize) {
    if (w >= h) {
      h = Math.round((h * maxSize) / w);
      w = maxSize;
    } else {
      w = Math.round((w * maxSize) / h);
      h = maxSize;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return String(dataUrl);

  ctx.drawImage(img, 0, 0, w, h);

  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return String(dataUrl);
  }
}
