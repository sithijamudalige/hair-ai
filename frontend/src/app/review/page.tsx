"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, CheckCircle2, Sparkles } from "lucide-react";
import { loadProfile, saveProfile } from "@/lib/profile";
import type { UserProfile } from "@/lib/types";

const emptyProfile: UserProfile = {
  faceType: "",
  skinTone: "",
  hairType: "",
  beardStyle: "Not specified",
  hairLength: "Not specified",
  stylePreference: "",
  additionalNotes: "",
  source: "live",
};

export default function ReviewPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadProfile();
    if (!stored) {
      router.replace("/");
      return;
    }
    setProfile(stored);
    setReady(true);
  }, [router]);

  const updateField = (field: keyof UserProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleConfirm = () => {
    saveProfile(profile);
    router.push("/assistant");
  };

  if (!ready) {
    return (
      <div className="container fade-in">
        <p style={{ color: "var(--text-secondary)" }}>Loading your analysis...</p>
      </div>
    );
  }

  return (
    <div className="container fade-in">
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/" className="btn-secondary" style={{ padding: "0.5rem 1rem", marginBottom: "1rem", display: "inline-flex", width: "auto" }}>
          <ChevronLeft size={18} /> Back
        </Link>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 700 }}>
          Review Your <span className="text-gradient">Details</span>
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          We detected these traits from your {profile.source === "live" ? "live camera" : "photo"} scan.
          Please confirm or edit them before talking to the hair assistant.
        </p>
      </div>

      <div className="glass-card review-panel">
        <div className="review-banner">
          <CheckCircle2 size={22} color="var(--success)" />
          <span>Are these details correct? You can edit any field below.</span>
        </div>

        <div className="review-grid">
          <label className="form-field">
            <span>Face Type</span>
            <input value={profile.faceType} onChange={(e) => updateField("faceType", e.target.value)} />
          </label>

          <label className="form-field">
            <span>Skin Tone</span>
            <input value={profile.skinTone} onChange={(e) => updateField("skinTone", e.target.value)} />
          </label>

          <label className="form-field">
            <span>Hair Type</span>
            <input value={profile.hairType} onChange={(e) => updateField("hairType", e.target.value)} />
          </label>

          <label className="form-field">
            <span>Current Beard Style</span>
            <select value={profile.beardStyle} onChange={(e) => updateField("beardStyle", e.target.value)}>
              <option>Not specified</option>
              <option>Clean shaven</option>
              <option>Stubble</option>
              <option>Short beard</option>
              <option>Medium beard</option>
              <option>Full beard</option>
              <option>Mustache only</option>
            </select>
          </label>

          <label className="form-field">
            <span>Current Hair Length</span>
            <select value={profile.hairLength} onChange={(e) => updateField("hairLength", e.target.value)}>
              <option>Not specified</option>
              <option>Very short / buzz cut</option>
              <option>Short</option>
              <option>Medium</option>
              <option>Long</option>
              <option>Very long</option>
            </select>
          </label>

          <label className="form-field">
            <span>Style Preference</span>
            <input
              value={profile.stylePreference}
              onChange={(e) => updateField("stylePreference", e.target.value)}
              placeholder="e.g. modern, professional, low maintenance"
            />
          </label>
        </div>

        <label className="form-field" style={{ marginTop: "1rem" }}>
          <span>Additional Notes</span>
          <textarea
            rows={4}
            value={profile.additionalNotes}
            onChange={(e) => updateField("additionalNotes", e.target.value)}
            placeholder="Anything else the stylist should know..."
          />
        </label>

        <div className="review-actions">
          <button onClick={handleConfirm} className="btn-primary" style={{ padding: "1rem 2rem" }}>
            <Sparkles size={18} /> Yes, these look correct — Get Recommendations
          </button>
        </div>
      </div>
    </div>
  );
}
