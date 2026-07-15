export interface AnalysisResult {
  face_type: { label: string; confidence: number };
  hair_type: { label: string | null; confidence: number | null };
  skin_type: { label: string; confidence: number };
}

export interface UserProfile {
  faceType: string;
  skinTone: string;
  hairType: string;
  beardStyle: string;
  hairLength: string;
  stylePreference: string;
  additionalNotes: string;
  source: "live" | "photo";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type PhotoType = "Front" | "Left" | "Right";

export interface PhotoAnalysisBundle {
  Front: AnalysisResult | null;
  Left: AnalysisResult | null;
  Right: AnalysisResult | null;
}
