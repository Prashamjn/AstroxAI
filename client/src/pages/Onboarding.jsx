/**
 * Profile completion wizard: name, DOB (required); step 2: photo, bio, country, gender (required).
 */

import { useState, useEffect, useRef } from "react";
import CountryDropdown from "../components/CountryDropdown";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { setUserProfile } from "../lib/firestore";
import { useAuthStore } from "../store/useAuthStore";
import { useAvatarStore } from "../store/useAvatarStore";
import AvatarCropModal from "../components/AvatarCropModal";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export default function Onboarding() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setLocalAvatar = useAvatarStore((s) => s.setAvatar);
  const error = useAuthStore((s) => s.error);
  const setError = useAuthStore((s) => s.setError);
  const clearError = useAuthStore((s) => s.clearError);

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [gender, setGender] = useState("");
  const [genderDropdownOpen, setGenderDropdownOpen] = useState(false);
  const genderDropdownRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.displayName) setName(user.displayName);
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (genderDropdownRef.current && !genderDropdownRef.current.contains(e.target)) {
        setGenderDropdownOpen(false);
      }
    }
    if (genderDropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [genderDropdownOpen]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    e.target.value = "";
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(String(reader.result || ""));
      setCropOpen(true);
    };
    reader.onerror = () => {
      setError("Failed to read image.");
    };
    reader.readAsDataURL(file);
  };

  const handleCropCancel = () => {
    setCropOpen(false);
    setCropImageSrc("");
  };

  const handleCropSave = (dataUrl) => {
    const uid = auth.currentUser?.uid;
    if (uid) setLocalAvatar(uid, dataUrl);
    setCropOpen(false);
    setCropImageSrc("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError("Not signed in.");
      return;
    }
    setLoading(true);
    try {
      let photoURL = user?.photoURL ?? "";
      if (photoFile) photoURL = "";
      await setUserProfile(uid, {
        name: name.trim(),
        dob: dob.trim(),
        photoURL,
        email: user?.email ?? "",
        bio: bio.trim() || null,
        country: country.trim() || null,
        gender: gender || null,
        settings: { theme: "dark", defaultAgent: "auto" },
      });
      setProfile({
        id: uid,
        name: name.trim(),
        dob: dob.trim(),
        photoURL,
        email: user?.email ?? "",
        bio: bio.trim() || null,
        country: country.trim() || null,
        gender: gender || null,
        settings: { theme: "dark", defaultAgent: "auto" },
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    navigate("/login", { replace: true });
    return null;
  }
  if (profile && profile.name && profile.dob) {
    navigate("/", { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] p-4">
      <AvatarCropModal open={cropOpen} imageSrc={cropImageSrc} onCancel={handleCropCancel} onSave={handleCropSave} />
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white">Complete your profile</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Step {step} of 2 — Required fields first
          </p>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Full name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--border)] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <input
              type="date"
              placeholder="Date of birth"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--border)] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!name.trim() || !dob}
              className="w-full py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2">
              <label className="text-sm text-[var(--text-muted)]">Profile picture (optional)</label>
              <label className="w-20 h-20 rounded-full bg-white/10 border-2 border-dashed border-[var(--border)] flex items-center justify-center overflow-hidden cursor-pointer hover:border-[var(--accent)]">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-[var(--text-muted)]">+</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>
            </div>
            <textarea
              placeholder="Bio (optional)"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--border)] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
            />
            <CountryDropdown
              value={country}
              onChange={setCountry}
              required
            />
            <div ref={genderDropdownRef} className="relative">
              <label className="block text-sm text-[var(--text-muted)] mb-1.5">Gender *</label>
              <button
                type="button"
                onClick={() => setGenderDropdownOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl
                  bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10
                  text-left text-sm text-white font-medium
                  hover:border-white/20 hover:from-white/[0.12] hover:to-white/[0.04]
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/30
                  transition-all duration-200 shadow-sm"
              >
                <span className={gender ? "" : "text-zinc-500"}>
                  {gender ? GENDER_OPTIONS.find((o) => o.value === gender)?.label : "Select gender"}
                </span>
                <span className={`shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${genderDropdownOpen ? "rotate-180" : ""}`}>
                  <ChevronDownIcon className="w-4 h-4" />
                </span>
              </button>
              {genderDropdownOpen && (
                <div
                  className="absolute top-full left-0 right-0 mt-1.5 py-1 rounded-xl
                    bg-[var(--bg-tertiary)]/95 backdrop-blur-md border border-white/10 shadow-xl
                    animate-fade-in z-10 overflow-hidden"
                >
                  {GENDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setGender(opt.value);
                        setGenderDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors duration-150
                        ${opt.value === gender
                          ? "bg-indigo-500/10 text-indigo-200"
                          : "text-[var(--text-primary)] hover:bg-white/8"}`}
                    >
                      <span>{opt.label}</span>
                      {opt.value === gender && (
                        <span className="shrink-0 text-indigo-400">
                          <CheckIcon className="w-4 h-4" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-[var(--border)] text-white font-medium"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !country.trim() || !gender}
                className="flex-1 py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Saving…" : "Complete"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
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
