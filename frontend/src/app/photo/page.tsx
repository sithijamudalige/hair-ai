"use client";

import { useState, useRef } from "react";
import { ChevronLeft, Upload, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { photoResultsToProfile, saveProfile, saveRawAnalysis } from "@/lib/profile";
import type { AnalysisResult, PhotoType } from "@/lib/types";

export default function PhotoMode() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Record<PhotoType, File | null>>({
    Front: null,
    Left: null,
    Right: null,
  });

  const [previews, setPreviews] = useState<Record<PhotoType, string | null>>({
    Front: null,
    Left: null,
    Right: null,
  });

  const [results, setResults] = useState<Record<PhotoType, AnalysisResult | null>>({
    Front: null,
    Left: null,
    Right: null,
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (type: PhotoType, file: File | null) => {
    if (!file) return;
    setPhotos(prev => ({ ...prev, [type]: file }));
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviews(prev => ({ ...prev, [type]: e.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!photos.Front || !photos.Left || !photos.Right) {
      setError("Please upload all 3 photos before analyzing.");
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    
    const newResults: any = { Front: null, Left: null, Right: null };
    
    try {
      for (const type of ["Front", "Left", "Right"] as PhotoType[]) {
        const formData = new FormData();
        formData.append("image", photos[type] as File);
        
        const res = await fetch("http://localhost:8000/analyze", {
          method: "POST",
          body: formData,
        });
        
        if (!res.ok) throw new Error(`Failed to analyze ${type} photo.`);
        const data = await res.json();
        
        if (data.num_faces > 0) {
          newResults[type] = data.faces[0];
        } else {
          throw new Error(`No face detected in ${type} photo.`);
        }
      }
      setResults(newResults);
    } catch (err: any) {
      setError(err.message || "An error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const canAnalyze = photos.Front && photos.Left && photos.Right;
  const hasResults = results.Front || results.Left || results.Right;

  const handleContinue = () => {
    saveRawAnalysis(results);
    saveProfile(photoResultsToProfile(results));
    router.push("/review");
  };

  return (
    <div className="container fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" className="btn-secondary" style={{ padding: '0.5rem 1rem', marginBottom: '1rem', display: 'inline-flex', width: 'auto' }}>
          <ChevronLeft size={18} /> Back
        </Link>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700 }}>Photo <span className="text-gradient">Mode</span></h1>
        <p style={{ color: 'var(--text-secondary)' }}>Upload your photos from different angles for a complete analysis.</p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
          {error}
        </div>
      )}

      {!hasResults ? (
        <>
          <div className="grid-3" style={{ gap: '1.5rem', marginBottom: '2rem' }}>
            {(["Front", "Left", "Right"] as PhotoType[]).map((type) => (
              <div key={type} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                  {type} View {previews[type] && <CheckCircle2 size={20} color="var(--success)" />}
                </h3>
                
                <label className="file-drop-area" style={{ flex: 1, padding: previews[type] ? '0' : '2rem', overflow: 'hidden' }}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                    onChange={(e) => handleFileChange(type, e.target.files?.[0] || null)}
                  />
                  {previews[type] ? (
                    <img src={previews[type]!} alt={type} style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: '200px' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)' }}>
                      <Upload size={32} />
                      <span>Click to upload {type} photo</span>
                    </div>
                  )}
                </label>
              </div>
            ))}
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <button 
              onClick={handleAnalyze} 
              disabled={!canAnalyze || isAnalyzing}
              className="btn-primary" 
              style={{ padding: '1rem 3rem', fontSize: '1.1rem', opacity: (!canAnalyze || isAnalyzing) ? 0.5 : 1 }}
            >
              {isAnalyzing ? <><Loader2 className="spin" size={20} /> Analyzing...</> : "Start Analysis"}
            </button>
          </div>
        </>
      ) : (
        <div className="grid-3 fade-in" style={{ gap: '1.5rem' }}>
          {(["Front", "Left", "Right"] as PhotoType[]).map((type) => {
            const res = results[type];
            return (
              <div key={type} className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>{type} View Results</h3>
                
                <img src={previews[type]!} alt={type} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem' }} />
                
                {res ? (
                  <>
                    <div className="result-item">
                      <span style={{ color: 'var(--text-secondary)' }}>Face Type</span>
                      <span style={{ fontWeight: 600 }}>{res.face_type.label}</span>
                    </div>
                    <div className="result-item">
                      <span style={{ color: 'var(--text-secondary)' }}>Skin Color</span>
                      <span style={{ fontWeight: 600 }}>{res.skin_type.label}</span>
                    </div>
                    <div className="result-item">
                      <span style={{ color: 'var(--text-secondary)' }}>Hair Type</span>
                      <span style={{ fontWeight: 600 }}>{res.hair_type?.label || 'None'}</span>
                    </div>
                  </>
                ) : (
                  <p style={{ color: '#f87171' }}>Failed to analyze.</p>
                )}
              </div>
            );
          })}
          
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
             <button onClick={() => { setResults({Front: null, Left: null, Right: null}); setPreviews({Front: null, Left: null, Right: null}); setPhotos({Front: null, Left: null, Right: null}); }} className="btn-secondary">
               Start Over
             </button>
             <button onClick={handleContinue} className="btn-primary">
               <Sparkles size={18} /> Continue to Hair Assistant
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
