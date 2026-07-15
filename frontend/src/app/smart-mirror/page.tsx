"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadProfile } from "@/lib/profile";

export default function SmartMirror() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);

  useEffect(() => {
    // Make sure user has a profile, otherwise redirect
    const stored = loadProfile();
    if (!stored) {
      router.replace("/");
      return;
    }

    // Load the latest recommendation passed from the assistant
    const rec = localStorage.getItem("latestRecommendation");
    if (rec) {
      setRecommendation(rec);
    } else {
      setRecommendation("Please ask the Assistant for recommendations first.");
    }

    startCamera();
    return () => stopCamera();
  }, [router]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: "user" } 
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
  };

  return (
    <div className="container fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/assistant" className="btn-secondary" style={{ padding: '0.5rem 1rem', marginBottom: '1rem', display: 'inline-flex', width: 'auto' }}>
          <ChevronLeft size={18} /> Back to Assistant
        </Link>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700 }}>
          <Wand2 size={32} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} className="text-gradient" />
          Smart <span className="text-gradient">Mirror</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Visualize your styling recommendations in real-time AR view.</p>
      </div>

      {error ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>
          <p>{error}</p>
          <button onClick={startCamera} className="btn-primary" style={{ marginTop: '1rem' }}>Try Again</button>
        </div>
      ) : (
        <div className="smart-mirror-container">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            className="mirror-video"
          />
          
          {isStreaming && <div className="scan-line"></div>}

          <div className="mirror-hud">
            <div className="hud-top">
              {/* Left HUD: Current Active Profile */}
              <div className="hud-card fade-in" style={{ animationDelay: '0.2s' }}>
                <div className="hud-title">
                  <Camera size={16} /> Live Feed Active
                </div>
                <div className="hud-content">
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>AI Overlay System</p>
                  <p>Align your face in the center of the frame to visualize suggested styles.</p>
                </div>
              </div>

              {/* Right HUD: The Recommendations */}
              <div className="hud-card fade-in" style={{ animationDelay: '0.5s', maxWidth: '400px' }}>
                <div className="hud-title">
                  <Sparkles size={16} /> Recommended Styles
                </div>
                <div className="hud-content" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
                  {/* Render the markdown-like content as simple text for now, or just pre-wrap */}
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                    {recommendation}
                  </div>
                </div>
              </div>
            </div>

            <div className="hud-bottom">
              <div className="badge" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
                Powered by Aura AI
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
