import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import { getCroppedAvatarDataUrl } from "../lib/cropImage";

export default function AvatarCropModal({ open, imageSrc, onCancel, onSave }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setSaving(false);
  }, [open, imageSrc]);

  const canSave = useMemo(() => !!imageSrc && !!croppedAreaPixels && !saving, [imageSrc, croppedAreaPixels, saving]);

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const dataUrl = await getCroppedAvatarDataUrl(imageSrc, croppedAreaPixels, { size: 256, quality: 0.85 });
      onSave?.(dataUrl);
    } catch (e) {
      onCancel?.(e);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={() => onCancel?.()}>
      <div
        className="w-full max-w-xl rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-2xl overflow-hidden animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-white">Crop photo</h2>
          <button
            type="button"
            onClick={() => onCancel?.()}
            className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white"
            aria-label="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black/40 border border-white/10">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-white/90">Zoom</div>
              <div className="text-xs text-[var(--text-muted)]">{Math.round(zoom * 100)}%</div>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full mt-2"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onCancel?.()}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CloseIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
