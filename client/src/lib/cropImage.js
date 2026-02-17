export async function getCroppedAvatarDataUrl(imageSrc, croppedAreaPixels, { size = 256, quality = 0.85 } = {}) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.crossOrigin = "anonymous";
    img.src = String(imageSrc);
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const { x, y, width, height } = croppedAreaPixels;
  ctx.drawImage(image, x, y, width, height, 0, 0, size, size);

  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return canvas.toDataURL();
  }
}
