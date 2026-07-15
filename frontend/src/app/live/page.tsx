"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, AlertCircle, RefreshCw, ChevronLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { analysisToProfile, saveProfile, saveRawAnalysis } from "@/lib/profile";
import type { AnalysisResult } from "@/lib/types";

export default function LiveCam() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 640, facingMode: "user" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        setError(null);
      }
    } catch (err: any) {
      setError("Could not access camera. Please allow permissions.");
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsStreaming(false);
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const analyzeFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setIsAnalyzing(true);
      
      const formData = new FormData();
      formData.append("image", blob, "frame.jpg");

      try {
        const res = await fetch("http://localhost:8000/analyze", {
          method: "POST",
          body: formData,
        });
        
        if (!res.ok) throw new Error("Analysis failed");
        
        const data = await res.json();
        if (data.num_faces > 0) {
          setResult(data.faces[0]);
        }
      } catch (err) {
        console.error("Error analyzing frame", err);
      } finally {
        setIsAnalyzing(false);
      }
    }, "image/jpeg", 0.8);
  }, [isStreaming]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (isStreaming) {
      intervalRef.current = setInterval(() => {
        analyzeFrame();
      }, 3000); // Analyze every 3 seconds
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isStreaming, analyzeFrame]);

  const handleContinue = () => {
    if (!result) return;
    stopCamera();
    saveRawAnalysis(result);
    saveProfile(analysisToProfile(result, "live"));
    router.push("/review");
  };

  return (
    <div className="container fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" className="btn-secondary" style={{ padding: '0.5rem 1rem', marginBottom: '1rem', display: 'inline-flex', width: 'auto' }}>
          <ChevronLeft size={18} /> Back
        </Link>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700 }}>Live Cam <span className="text-gradient">Analysis</span></h1>
        <p style={{ color: 'var(--text-secondary)' }}>Scanning in real-time. Look directly at the camera.</p>
      </div>

      <div className="grid-3" style={{ gap: '2rem' }}>
        <div className="glass-card" style={{ gridColumn: 'span 2' }}>
          {error ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>
              <AlertCircle size={48} style={{ margin: '0 auto 1rem' }} />
              <p>{error}</p>
              <button onClick={startCamera} className="btn-primary" style={{ marginTop: '1rem' }}>Try Again</button>
            </div>
          ) : (
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000', aspectRatio: '1/1' }}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              
              {isAnalyzing && (
                <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', padding: '0.5rem 1rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <RefreshCw size={14} className="fade-in" style={{ animation: 'spin 2s linear infinite' }} /> Analyzing
                </div>
              )}
            </div>
          )}
        </div>

        <div className="glass-card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={20} className="text-gradient" /> Results
          </h2>
          
          {!result ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
              <RefreshCw size={32} style={{ margin: '0 auto 1rem', opacity: 0.5, animation: isStreaming ? 'spin 3s linear infinite' : 'none' }} />
              <p>Waiting for face detection...</p>
            </div>
          ) : (
            <div className="fade-in">
              <div className="result-card">
                <div className="result-item">
                  <span style={{ color: 'var(--text-secondary)' }}>Face Type</span>
                  <span style={{ fontWeight: 600 }}>{result.face_type.label}</span>
                </div>
                <div className="result-item">
                  <span style={{ color: 'var(--text-secondary)' }}>Confidence</span>
                  <span className="badge">{(result.face_type.confidence * 100).toFixed(1)}%</span>
                </div>
              </div>

              <div className="result-card">
                <div className="result-item">
                  <span style={{ color: 'var(--text-secondary)' }}>Skin Color</span>
                  <span style={{ fontWeight: 600 }}>{result.skin_type.label}</span>
                </div>
                <div className="result-item">
                  <span style={{ color: 'var(--text-secondary)' }}>Confidence</span>
                  <span className="badge">{(result.skin_type.confidence * 100).toFixed(1)}%</span>
                </div>
              </div>

              <div className="result-card">
                <div className="result-item">
                  <span style={{ color: 'var(--text-secondary)' }}>Hair Type</span>
                  <span style={{ fontWeight: 600 }}>{result.hair_type?.label || 'None'}</span>
                </div>
                <div className="result-item">
                  <span style={{ color: 'var(--text-secondary)' }}>Confidence</span>
                  <span className="badge">{result.hair_type?.confidence != null ? (result.hair_type.confidence * 100).toFixed(1) + '%' : 'N/A'}</span>
                </div>
              </div>

              <button
                onClick={handleContinue}
                className="btn-primary"
                style={{ width: "100%", marginTop: "1.5rem", padding: "0.85rem 1rem" }}
              >
                <Sparkles size={18} /> Continue to Hair Assistant
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
