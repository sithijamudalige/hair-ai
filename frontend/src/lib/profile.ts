import type { AnalysisResult, PhotoAnalysisBundle, UserProfile } from "./types";

const PROFILE_KEY = "aura_user_profile";
const RAW_ANALYSIS_KEY = "aura_raw_analysis";

export function analysisToProfile(
  result: AnalysisResult,
  source: "live" | "photo"
): UserProfile {
  return {
    faceType: result.face_type.label,
    skinTone: result.skin_type.label,
    hairType: result.hair_type?.label || "Unknown",
    beardStyle: "Not specified",
    hairLength: "Not specified",
    stylePreference: "",
    additionalNotes: "",
    source,
  };
}

export function photoResultsToProfile(results: PhotoAnalysisBundle): UserProfile {
  const primary = results.Front || results.Left || results.Right;
  if (!primary) {
    return {
      faceType: "",
      skinTone: "",
      hairType: "",
      beardStyle: "Not specified",
      hairLength: "Not specified",
      stylePreference: "",
      additionalNotes: "",
      source: "photo",
    };
  }

  const profile = analysisToProfile(primary, "photo");
  const angleNotes = (["Front", "Left", "Right"] as const)
    .map((angle) => {
      const res = results[angle];
      if (!res) return null;
      return `${angle}: face ${res.face_type.label}, skin ${res.skin_type.label}, hair ${res.hair_type?.label || "None"}`;
    })
    .filter(Boolean)
    .join("\n");

  if (angleNotes) {
    profile.additionalNotes = `Multi-angle scan:\n${angleNotes}`;
  }

  return profile;
}

export function saveProfile(profile: UserProfile) {
  sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadProfile(): UserProfile | null {
  const raw = sessionStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveRawAnalysis(data: unknown) {
  sessionStorage.setItem(RAW_ANALYSIS_KEY, JSON.stringify(data));
}

export function loadRawAnalysis<T>(): T | null {
  const raw = sessionStorage.getItem(RAW_ANALYSIS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearProfileSession() {
  sessionStorage.removeItem(PROFILE_KEY);
  sessionStorage.removeItem(RAW_ANALYSIS_KEY);
}
