import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { setUserProfile } from "../lib/firestore";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useAvatarStore } from "../store/useAvatarStore";
import SystemPromptEditor from "./SystemPromptEditor";
import AvatarCropModal from "./AvatarCropModal";

export default function SettingsModal({ open, onClose }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const signOutStore = useAuthStore((s) => s.signOut);
  const showToast = useChatStore((s) => s.showToast);

  const [activeTab, setActiveTab] = useState("general");
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoUploadProgress, setPhotoUploadProgress] = useState(0);
  const [photoLastFile, setPhotoLastFile] = useState(null);
  const [photoUploadError, setPhotoUploadError] = useState(null);
  const [photoDiagnosticsOpen, setPhotoDiagnosticsOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const themeDropdownRef = useRef(null);
  const [bioDraft, setBioDraft] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const themeSelection = useSettingsStore((s) => s.settings?.theme || "system");
  const setTheme = useSettingsStore((s) => s.setTheme);

  const localAvatar = useAvatarStore((s) => s.avatarDataUrl);
  const setLocalAvatar = useAvatarStore((s) => s.setAvatar);
  const clearLocalAvatar = useAvatarStore((s) => s.clearAvatar);

  const displayName = profile?.name || user?.displayName || "User";
  const photoURL = localAvatar || profile?.photoURL || user?.photoURL || null;
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target)) {
        setThemeDropdownOpen(false);
      }
    }
    if (themeDropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [themeDropdownOpen]);

  useEffect(() => {
    setBioDraft(profile?.bio || "");
  }, [profile?.bio, open]);

  const tabs = useMemo(
    () => [
      { id: "general", label: "General", icon: <GeneralIcon className="w-5 h-5" /> },
      { id: "profile", label: "Profile", icon: <ProfileIcon className="w-5 h-5" /> },
      { id: "system_prompts", label: "System prompts", icon: <PromptIcon className="w-5 h-5" /> },
      { id: "account", label: "Account", icon: <AccountIcon className="w-5 h-5" /> },
    ],
    []
  );

  const handleSignOut = () => {
    firebaseSignOut(auth);
    signOutStore();
    onClose();
    navigate("/login", { replace: true });
  };

  const handleSaveTheme = async (nextTheme) => {
    try {
      await setTheme(nextTheme);
      showToast("Theme updated");
    } catch {
      showToast("Failed to update theme");
    }
  };

  const handleSaveBio = async () => {
    if (!user?.uid) return;
    setSavingProfile(true);
    try {
      await setUserProfile(user.uid, { bio: bioDraft.trim() || null });
      if (profile) setProfile({ ...profile, bio: bioDraft.trim() || null });
      showToast("Profile updated");
    } catch {
      showToast("Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type?.startsWith("image/") || !user?.uid) return;

    setPhotoLastFile(file);
    setPhotoUploadError(null);
    setPhotoDiagnosticsOpen(false);
    setPhotoLoadFailed(false);
    setPhotoUploadProgress(0);

    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    const localPreview = URL.createObjectURL(file);
    setPhotoPreviewUrl(localPreview);

    try {
      const src = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });
      setCropImageSrc(src);
      setCropOpen(true);
    } catch (err) {
      const details = {
        code: err?.code || null,
        message: err?.message || "Failed to load image",
        name: err?.name || null,
      };
      setPhotoUploadError(details);
      showToast(details.code ? `${details.code}: ${details.message}` : details.message);
    }
  };

  const handleClearPhoto = () => {
    if (!user?.uid) return;
    clearLocalAvatar(user.uid);
    setPhotoLoadFailed(false);
    setPhotoUploadError(null);
    setPhotoDiagnosticsOpen(false);
    setPhotoUploadProgress(0);
    setPhotoPreviewUrl("");
    showToast("Profile picture cleared");
  };

  const handleCropCancel = () => {
    setCropOpen(false);
    setCropImageSrc("");
    setPhotoUploading(false);
  };

  const handleCropSave = (dataUrl) => {
    if (!user?.uid) return;
    setPhotoUploading(true);
    try {
      setLocalAvatar(user.uid, dataUrl);
      showToast("Profile picture updated");
      setPhotoPreviewUrl("");
      setPhotoUploadProgress(1);
    } finally {
      setPhotoUploading(false);
      setCropOpen(false);
      setCropImageSrc("");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-black/60 animate-fade-in" onClick={onClose}>
      <AvatarCropModal
        open={cropOpen}
        imageSrc={cropImageSrc}
        onCancel={handleCropCancel}
        onSave={handleCropSave}
      />
      <div
        className="w-full max-w-5xl rounded-none sm:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-2xl flex overflow-hidden h-[100svh] sm:h-auto max-h-[100svh] sm:max-h-[85vh] animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hidden sm:flex w-[240px] shrink-0 bg-gradient-to-b from-white/[0.04] to-transparent border-r border-[var(--border)] p-3 flex-col">
          <div className="flex items-center justify-between px-2 py-2">
            <span className="text-sm font-semibold text-white">Settings</span>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white"
              aria-label="Close"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-1">
            {tabs.map((t) => {
              const active = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 border ${
                    active
                      ? "bg-white/10 text-white border-white/10"
                      : "text-[var(--text-primary)] border-transparent hover:bg-white/5"
                  }`}
                >
                  <span className={`shrink-0 ${active ? "text-indigo-300" : "text-[var(--text-muted)]"}`}>{t.icon}</span>
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto px-2 py-2">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              {photoURL && !photoLoadFailed ? (
                <img
                  src={photoURL}
                  alt=""
                  onError={() => setPhotoLoadFailed(true)}
                  className="w-9 h-9 rounded-full object-cover bg-white/10"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-indigo-600/80 flex items-center justify-center text-white text-sm font-semibold">
                  {displayName
                    .trim()
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "?"}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">{displayName}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">{profile?.email || user?.email || ""}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
            <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">{tabs.find((t) => t.id === activeTab)?.label}</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white"
                aria-label="Close"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="sm:hidden px-4 pb-3">
              <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {tabs.map((t) => {
                  const active = t.id === activeTab;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      className={`
                        shrink-0 px-3 py-2 rounded-full text-sm border transition-colors
                        ${active
                          ? "bg-white/10 text-white border-white/10"
                          : "bg-white/[0.03] text-[var(--text-muted)] border-white/10 hover:bg-white/5 hover:text-white"}
                      `}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
            {activeTab === "general" && (
              <div className="flex flex-col gap-5">
                <Section title="Appearance">
                  <Row
                    label="Theme"
                    right={
                      <div ref={themeDropdownRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setThemeDropdownOpen((o) => !o)}
                          className="min-w-[160px] flex items-center justify-between gap-2 px-3 py-2 rounded-lg
                            bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10
                            text-sm text-white font-medium
                            hover:border-white/20 hover:from-white/[0.12] hover:to-white/[0.04]
                            focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40
                            transition-all duration-200"
                          aria-label="Theme"
                        >
                          <span className="truncate">
                            {themeSelection === "system" ? "System" : themeSelection === "dark" ? "Dark" : "Light"}
                          </span>
                          <span className={`shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${themeDropdownOpen ? "rotate-180" : ""}`}>
                            <ChevronDownIcon className="w-4 h-4" />
                          </span>
                        </button>
                        {themeDropdownOpen && (
                          <div
                            className="absolute right-0 mt-2 w-[180px] rounded-xl overflow-hidden z-20
                              bg-[var(--bg-tertiary)]/95 backdrop-blur-md border border-white/10 shadow-xl
                              max-h-48 overflow-y-auto overscroll-contain animate-fade-in"
                          >
                            {[
                              { id: "system", label: "System" },
                              { id: "dark", label: "Dark" },
                              { id: "light", label: "Light" },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setThemeDropdownOpen(false);
                                  handleSaveTheme(opt.id);
                                }}
                                className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors duration-150
                                  ${opt.id === themeSelection
                                    ? "bg-[var(--accent)]/10 text-white shadow-[inset_2px_0_0_0_rgba(99,102,241,0.7)]"
                                    : "text-[var(--text-primary)] hover:bg-white/8"}`}
                              >
                                <span className="truncate">{opt.label}</span>
                                {opt.id === themeSelection && (
                                  <span className="ml-auto shrink-0 text-[var(--accent)]">
                                    <CheckIcon className="w-4 h-4" />
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    }
                  />
                  <Row label="Accent color" right={<span className="text-sm text-[var(--text-muted)]">Default</span>} />
                </Section>

                <Section title="Language">
                  <Row label="Language" right={<span className="text-sm text-[var(--text-muted)]">Auto-detect</span>} />
                  <Row label="Spoken language" right={<span className="text-sm text-[var(--text-muted)]">Auto-detect</span>} />
                </Section>
              </div>
            )}

            {activeTab === "profile" && (
              <div className="flex flex-col gap-5">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />

                <Section title="Profile picture">
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      {photoPreviewUrl ? (
                        <img src={photoPreviewUrl} alt="" className="w-16 h-16 rounded-full object-cover bg-white/10" />
                      ) : photoURL && !photoLoadFailed ? (
                        <img
                          src={photoURL}
                          alt=""
                          onError={() => setPhotoLoadFailed(true)}
                          className="w-16 h-16 rounded-full object-cover bg-white/10"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-indigo-600/80 flex items-center justify-center text-white text-lg font-semibold">
                          {displayName
                            .trim()
                            .split(/\s+/)
                            .map((w) => w[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2) || "?"}
                        </div>
                      )}
                      {photoUploading && (
                        <span className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                          <span className="w-5 h-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-white font-medium">Change your photo</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">You can only change your profile picture here.</div>
                      {(photoUploading || photoUploadProgress > 0) && (
                        <div className="mt-2">
                          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-[var(--accent)] transition-[width] duration-150"
                              style={{ width: `${Math.round((photoUploading ? photoUploadProgress : 1) * 100)}%` }}
                            />
                          </div>
                          <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                            {photoUploading ? `Uploading… ${Math.round(photoUploadProgress * 100)}%` : "Upload complete"}
                          </div>
                        </div>
                      )}
                      {photoUploadError && (
                        <div className="mt-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
                          <div className="text-sm text-red-300 font-medium">Upload failed</div>
                          <div className="text-xs text-red-200/80 mt-0.5 truncate">
                            {photoUploadError.code ? `${photoUploadError.code}` : "Unknown error"}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => photoLastFile && handlePhotoUpload(photoLastFile)}
                              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/25 border border-red-500/30 text-red-100 text-xs font-medium"
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              onClick={() => setPhotoDiagnosticsOpen((v) => !v)}
                              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[var(--text-primary)] text-xs font-medium"
                            >
                              {photoDiagnosticsOpen ? "Hide details" : "Details"}
                            </button>
                          </div>
                          {photoDiagnosticsOpen && (
                            <div className="mt-2 text-[11px] text-red-100/80 whitespace-pre-wrap break-words">
                              {photoUploadError.message}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          disabled={photoUploading}
                          className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] light-mint-primary text-white text-sm font-medium disabled:opacity-50"
                        >
                          Upload new
                        </button>
                        {localAvatar && (
                          <button
                            type="button"
                            onClick={handleClearPhoto}
                            disabled={photoUploading}
                            className="ml-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 light-mint-secondary border border-white/10 text-white text-sm font-medium disabled:opacity-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Section>

                <Section title="Your details">
                  <div className="flex flex-col gap-3 mb-4">
                    <label className="text-sm font-medium text-white/90">Bio / Description</label>
                    <textarea
                      value={bioDraft}
                      onChange={(e) => setBioDraft(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none transition-colors duration-200"
                      placeholder="Write something about yourself…"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveBio}
                        disabled={savingProfile}
                        className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] light-mint-primary text-white text-sm font-medium disabled:opacity-50 transition-colors duration-200"
                      >
                        {savingProfile ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                  <InfoGrid
                    items={[
                      { k: "Name", v: profile?.name || user?.displayName || "" },
                      { k: "Email", v: profile?.email || user?.email || "" },
                      { k: "Date of birth", v: profile?.dob || "" },
                      { k: "Country", v: profile?.country || "" },
                      { k: "Gender", v: profile?.gender || "" },
                      { k: "Bio", v: profile?.bio || "" },
                    ]}
                  />
                </Section>
              </div>
            )}

            {activeTab === "system_prompts" && (
              <div className="flex flex-col gap-5">
                <SystemPromptEditor embedded />
              </div>
            )}

            {activeTab === "account" && (
              <div className="flex flex-col gap-5">
                <Section title="Account">
                  <Row
                    label="Sign out"
                    right={
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-medium"
                      >
                        Sign out
                      </button>
                    }
                  />
                </Section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] overflow-visible min-h-[400px]">
      <div className="px-4 sm:px-5 py-4 border-b border-white/10">
        <div className="text-sm font-semibold text-white">{title}</div>
      </div>
      <div className="px-4 sm:px-5 py-4 min-h-[300px]">{children}</div>
    </div>
  );
}

function Row({ label, right }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/10 last:border-b-0">
      <div className="text-sm text-white/90">{label}</div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function InfoGrid({ items }) {
  const filtered = items.filter((i) => i.v);
  if (!filtered.length) {
    return <div className="text-sm text-[var(--text-muted)]">No profile details found.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {filtered.map((i) => (
        <div key={i.k} className="rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3">
          <div className="text-xs text-[var(--text-muted)]">{i.k}</div>
          <div className="text-sm text-white mt-1 break-words">{i.v}</div>
        </div>
      ))}
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

function GeneralIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ProfileIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A9 9 0 1118.88 17.804" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function PromptIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function AccountIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c1.657 0 3-1.567 3-3.5S13.657 4 12 4 9 5.567 9 7.5 10.343 11 12 11z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" />
    </svg>
  );
}

function ChevronDownIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function withCacheBuster(url) {
  try {
    const u = new URL(url);
    u.searchParams.set("v", String(Date.now()));
    return u.toString();
  } catch {
    const join = url.includes("?") ? "&" : "?";
    return `${url}${join}v=${Date.now()}`;
  }
}
