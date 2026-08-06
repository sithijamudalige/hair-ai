"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, Sparkles, Wand2, Loader2, Image as ImageIcon, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadProfile } from "@/lib/profile";

export default function SmartMirror() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [recommendedHair, setRecommendedHair] = useState<string[]>([]);
  const [recommendedBeards, setRecommendedBeards] = useState<string[]>([]);
  const [recommendedFashion, setRecommendedFashion] = useState<string[]>([]);
  
  const [activeItem, setActiveItem] = useState<{category: string, index: number} | null>(null); 
  const [isLoadingStyle, setIsLoadingStyle] = useState<boolean>(false);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const [generatedHairUrl, setGeneratedHairUrl] = useState<string | null>(null);
  const [generatedBeardUrl, setGeneratedBeardUrl] = useState<string | null>(null);
  const [generatedFashionUrl, setGeneratedFashionUrl] = useState<string | null>(null);
  
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);

  const [faceBbox, setFaceBbox] = useState<number[] | null>(null); // [x1, y1, x2, y2]
  const [facePose, setFacePose] = useState<number[] | null>(null); // [pitch, yaw, roll]
  
  // Photo Mode State
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isAvatarMode, setIsAvatarMode] = useState<boolean>(false);
  
  const [avatarTexture, setAvatarTexture] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadProfile();
    if (!stored) {
      router.replace("/");
      return;
    }

    const rec = localStorage.getItem("latestRecommendation");
    if (rec) {
      setRecommendation(rec);
    } else {
      setRecommendation("Please ask the Assistant for recommendations first.");
    }

    const loadList = (key: string, setter: any) => {
      const val = localStorage.getItem(key);
      if (val) {
        try {
          setter(JSON.parse(val));
        } catch(e) {}
      }
    };
    
    loadList("recommendedHair", setRecommendedHair);
    loadList("recommendedBeards", setRecommendedBeards);
    loadList("recommendedFashion", setRecommendedFashion);
    
    // Fallback for old data
    const recStyles = localStorage.getItem("recommendedStyles");
    if (recStyles && recommendedHair.length === 0) {
      try {
        setRecommendedHair(JSON.parse(recStyles));
      } catch(e) {}
    }

    const savedGeminiKey = localStorage.getItem("geminiApiKey");
    if (savedGeminiKey) setGeminiApiKey(savedGeminiKey);

    startCamera();
    
    return () => {
      stopCamera();
      if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
    };
  }, [router]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: "user" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', () => {
           if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
           trackingIntervalRef.current = setInterval(trackFaceWithBackend, 500); // 2fps
        });
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

  const trackFaceWithBackend = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (isAnalyzing) return;
    setIsAnalyzing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) { setIsAnalyzing(false); return; }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(async (blob) => {
        if (!blob) { setIsAnalyzing(false); return; }

        const formData = new FormData();
        formData.append("image", blob, "frame.jpg");

        try {
          const res = await fetch("http://localhost:8000/analyze", {
            method: "POST",
            body: formData,
          });
          
          if (!res.ok) throw new Error("Backend error");
          
          const data = await res.json();
          if (data && data.num_faces > 0 && data.faces && data.faces.length > 0) {
            // Find largest face by area
            let largestFace = data.faces[0];
            let maxArea = 0;
            for (const face of data.faces) {
              const [x1, y1, x2, y2] = face.bbox;
              const area = (x2 - x1) * (y2 - y1);
              if (area > maxArea) {
                maxArea = area;
                largestFace = face;
              }
            }
            setFaceBbox(largestFace.bbox); // [x1, y1, x2, y2]
            if (largestFace.pose) {
               setFacePose(largestFace.pose); // [pitch, yaw, roll]
            }
            setDebugError(null);
          } else {
            setFaceBbox(null);
            setFacePose(null);
          }
        } catch (err: any) {
          setDebugError("API Tracking Failed");
        }
        
        setIsAnalyzing(false);
      }, 'image/jpeg', 0.8);
      
    } catch (e) {
      setIsAnalyzing(false);
    }
  };

  const handleLoadModel = async (category: string, styleName: string) => {
    setIsGeneratingImage(true);
    if (category === "hair") setGeneratedHairUrl(null);
    if (category === "beard") setGeneratedBeardUrl(null);
    if (category === "fashion") setGeneratedFashionUrl(null);
    setDebugError(null);

    // Auto-scan using front photo
    setIsScanning(true);
    setScanResult(`Generating ${category} style: ${styleName}...`);
    setIsScanning(false);
    
    try {
      const res = await fetch("http://localhost:8000/generate-hairstyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: capturedPhoto,
          style_name: styleName,
          category: category
        })
      });

      if (!res.ok) {
        throw new Error(`Failed to generate ${category}.`);
      }

      const data = await res.json();
      if (category === "hair") setGeneratedHairUrl(data.image_url);
      if (category === "beard") setGeneratedBeardUrl(data.image_url);
      if (category === "fashion") setGeneratedFashionUrl(data.image_url);
    } catch (err: any) {
      setDebugError(err.message || "Image generation failed.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleStyleChange = (category: string, index: number, styleName: string) => {
    setIsLoadingStyle(true);
    setActiveItem({ category, index });
    setTimeout(() => {
      setIsLoadingStyle(false);
      handleLoadModel(category, styleName);
    }, 800);
  };

  const handleCapturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror image
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
    
    setCapturedPhoto(dataUrl);
    setIsAvatarMode(true);
    setActiveItem(null);
    
    // Auto-scan using front photo
    setIsScanning(true);
    setScanResult("Hugging Face API connected. Ready for Image-to-Image editing.");
    setIsScanning(false);
  };

  const resetCapture = () => {
    setCapturedPhoto(null);
    setIsAvatarMode(false);
    startCamera(); // Restart camera
  };

  const handleDownloadPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF();
      
      pdf.setFontSize(22);
      pdf.setTextColor(16, 185, 129); // green
      pdf.text("Aura AI - Personal Style Report", 20, 20);
      
      pdf.setFontSize(12);
      pdf.setTextColor(50, 50, 50);
      
      let yPos = 30;
      const imgWidth = 75;
      const imgHeight = 75 * (9/16);
      
      if (capturedPhoto) {
        pdf.text("Original Photo", 20, yPos);
        pdf.addImage(capturedPhoto, "JPEG", 20, yPos + 5, imgWidth, imgHeight); 
      }
      
      if (generatedHairUrl && !generatedHairUrl.startsWith("http")) {
        pdf.text("AI Hair Style", 110, yPos);
        pdf.addImage(generatedHairUrl, "JPEG", 110, yPos + 5, imgWidth, imgHeight);
      }
      
      yPos += imgHeight + 15;
      
      if (generatedBeardUrl && !generatedBeardUrl.startsWith("http")) {
        pdf.text("AI Beard Style", 20, yPos);
        pdf.addImage(generatedBeardUrl, "JPEG", 20, yPos + 5, imgWidth, imgHeight);
      }
      
      if (generatedFashionUrl && !generatedFashionUrl.startsWith("http")) {
        pdf.text("AI Fashion Style", 110, yPos);
        pdf.addImage(generatedFashionUrl, "JPEG", 110, yPos + 5, imgWidth, imgHeight);
      }
      
      // If we added a second row of images, increment yPos
      if (generatedBeardUrl || generatedFashionUrl) {
        yPos += imgHeight + 15;
      }
      
      pdf.setFontSize(16);
      pdf.setTextColor(99, 102, 241); // indigo
      pdf.text("Your Personalized Recommendations", 20, yPos);
      
      pdf.setFontSize(11);
      pdf.setTextColor(80, 80, 80);
      
      let recText = recommendation || "No recommendations available. Please chat with the assistant first.";
      // Strip non-ASCII characters (like emojis) because jsPDF default fonts crash on them
      recText = recText.replace(/[^\x00-\x7F]/g, " ");
      
      const splitText = pdf.splitTextToSize(recText, 170);
      pdf.text(splitText, 20, yPos + 10);
      
      pdf.save("Aura_Style_Report.pdf");
      setScanResult("PDF Style Report downloaded successfully!");
    } catch (e: any) {
      console.error("PDF generation failed", e);
      alert("PDF Error: " + (e.message || String(e)));
      setDebugError("PDF Error: " + (e.message || String(e)));
    }
  };

  let hairStyle = {};
  let isFaceCentered = false;
  let pitch = "0.0", yaw = "0.0", roll = "0.0";

  if (facePose) {
    // InsightFace returns angles typically. If they are in radians or raw values, we just display them
    pitch = (facePose[0]).toFixed(1);
    yaw = (facePose[1]).toFixed(1);
    roll = (facePose[2]).toFixed(1);
  }

  if (isAvatarMode) {
    // Fullscreen 3D Canvas in Avatar Mode — no face tracking needed
    hairStyle = {
      inset: 0,
      width: '100%',
      height: '100%',
      position: 'absolute',
      zIndex: 10,
      background: '#1a1a2e',
      borderRadius: '1rem'
    };
  } else if (faceBbox && videoRef.current) {
    const videoWidth = videoRef.current.videoWidth || 1280;
    const videoHeight = videoRef.current.videoHeight || 720;
    const [x1, y1, x2, y2] = faceBbox;
    
    const faceWidth = x2 - x1;
    const faceHeight = y2 - y1;

    const faceCenterX = (x1 + x2) / 2;
    const faceCenterY = (y1 + y2) / 2;
    const minX = videoWidth * 0.3;
    const maxX = videoWidth * 0.7;
    const minY = videoHeight * 0.2;
    const maxY = videoHeight * 0.8;
    isFaceCentered = faceCenterX > minX && faceCenterX < maxX && faceCenterY > minY && faceCenterY < maxY;

    const leftPerc = (x1 / videoWidth) * 100;
    const topPerc = (y1 / videoHeight) * 100;
    const widthPerc = (faceWidth / videoWidth) * 100;
    const heightPerc = (faceHeight / videoHeight) * 100;

    // Flipped left because the video has scaleX(-1) CSS
    const flippedLeftPerc = 100 - leftPerc - widthPerc;

    const offsetX = 0;
    const offsetY = 0;
    const scale = 1.3;

    // Increase the width to encompass the hair and shift top slightly upwards
    hairStyle = {
      left: `${flippedLeftPerc - (widthPerc * 0.15) + offsetX}%`,
      top: `${topPerc - (heightPerc * 0.7) + offsetY}%`,
      width: `${widthPerc * scale}%`,
      aspectRatio: '1 / 1',
      position: 'absolute',
      zIndex: 10,
      transition: 'all 0.4s ease-out'
    };
  }

  return (
    <div className="container fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/assistant" className="btn-secondary" style={{ padding: '0.5rem 1rem', marginBottom: '1rem', display: 'inline-flex', width: 'auto' }}>
          <ChevronLeft size={18} /> Back to Assistant
        </Link>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700 }}>
          <Wand2 size={32} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} className="text-gradient" />
          Smart <span className="text-gradient">Mirror (AR)</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Visualize your styling recommendations in real-time AR view.</p>
      </div>

      {error ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>
          <p>{error}</p>
          <button onClick={startCamera} className="btn-primary" style={{ marginTop: '1rem' }}>Try Again</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', alignItems: 'start' }} className="mirror-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="smart-mirror-container" style={{ position: 'relative', overflow: 'hidden', borderRadius: '1rem', background: '#000', margin: 0, maxWidth: '100%', aspectRatio: '16/9' }}>
              
              {!isAvatarMode ? (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    width={1280}
                    height={720}
                    className="mirror-video"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  
                  {/* Capture Instructions Overlay */}
                  <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 30, background: 'rgba(0,0,0,0.8)', padding: '1rem 2rem', borderRadius: '30px', border: '1px solid var(--primary)', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
                    <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 700, fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Look Straight Ahead
                    </h3>
                    <p style={{ margin: '0.5rem 0 0 0', color: '#fff', fontSize: '0.9rem' }}>Align your face and click Capture.</p>
                  </div>
                  
                  {/* Center crosshair for alignment */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', width: '150px', height: '200px', transform: 'translate(-50%, -50%)', border: '2px dashed rgba(255,255,255,0.4)', borderRadius: '50%', pointerEvents: 'none', zIndex: 10 }}></div>
                </>
              ) : (
                /* PHOTO MODE / GENERATION RESULT */
                <div style={{ position: 'absolute', inset: 0, background: '#111', display: 'flex', flexDirection: 'column' }}>
                   <div style={{ padding: '1rem', background: '#000', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50 }}>
                     <h3 style={{ margin: 0, color: '#fff' }}>AI Image Studio</h3>
                     <button onClick={resetCapture} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>Retake Photo</button>
                   </div>
                   
                   <div style={{ flex: 1, position: 'relative' }}>
                     {/* Base captured photo */}
                     <img src={capturedPhoto!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                     
                     {/* Generated image overlay */}
                     {activeItem !== null && (
                       <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (generatedHairUrl || generatedBeardUrl || generatedFashionUrl) ? 'transparent' : 'rgba(0,0,0,0.7)', zIndex: 10 }}>
                          {isGeneratingImage ? (
                            <div style={{ textAlign: 'center' }}>
                              <Loader2 className="spin" size={48} style={{ color: 'var(--primary)', margin: '0 auto 15px auto' }} />
                              <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 600 }}>AI is styling your hair...</div>
                              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>This may take up to 20 seconds.</p>
                            </div>
                          ) : debugError ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>
                              <div style={{ color: '#ef4444', fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>Generation Failed</div>
                              <div style={{ color: '#fff', fontSize: '0.9rem' }}>{debugError}</div>
                            </div>
                          ) : (activeItem?.category === 'hair' && generatedHairUrl) ? (
                            <img src={generatedHairUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : (activeItem?.category === 'beard' && generatedBeardUrl) ? (
                            <img src={generatedBeardUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : (activeItem?.category === 'fashion' && generatedFashionUrl) ? (
                            <img src={generatedFashionUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : null}
                       </div>
                     )}
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE: HUD CONTROLS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Recommendations Card (MAIN CONTROL) */}
            <div className="glass-card fade-in" style={{ padding: '1.5rem', animationDelay: '0.1s', pointerEvents: 'auto' }}>
              <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--primary)', marginBottom: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={16} /> Recommended by Aura
              </div>
              
              {recommendedHair.length > 0 || recommendedBeards.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    Click a style to generate it using AI.
                  </p>
                  
                  {recommendedHair.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <h4 style={{ color: '#a5b4fc', fontSize: '0.9rem', marginBottom: '0.25rem', marginTop: 0 }}>💇‍♂️ Hair Styles</h4>
                      {recommendedHair.map((styleName, idx) => (
                        <button 
                          key={`hair-${idx}`} 
                          onClick={() => handleStyleChange("hair", idx, styleName)}
                          disabled={!capturedPhoto}
                          className="btn-primary"
                          style={{ padding: '0.75rem 1rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: activeItem?.category === "hair" && activeItem?.index === idx ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--primary)', opacity: capturedPhoto ? 1 : 0.5, cursor: capturedPhoto ? 'pointer' : 'not-allowed' }}
                        >
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', textTransform: 'capitalize' }}>{styleName.replace(/_/g, " ")}</span>
                          <Wand2 size={14} style={{ color: 'var(--primary)' }} />
                        </button>
                      ))}
                    </div>
                  )}

                  {recommendedBeards.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <h4 style={{ color: '#a5b4fc', fontSize: '0.9rem', marginBottom: '0.25rem', marginTop: '0.5rem' }}>🧔 Beard Styles</h4>
                      {recommendedBeards.map((styleName, idx) => (
                        <button 
                          key={`beard-${idx}`} 
                          onClick={() => handleStyleChange("beard", idx, styleName)}
                          disabled={!capturedPhoto}
                          className="btn-primary"
                          style={{ padding: '0.75rem 1rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: activeItem?.category === "beard" && activeItem?.index === idx ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', opacity: capturedPhoto ? 1 : 0.5, cursor: capturedPhoto ? 'pointer' : 'not-allowed' }}
                        >
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', textTransform: 'capitalize' }}>{styleName.replace(/_/g, " ")}</span>
                          <Wand2 size={14} style={{ color: '#10b981' }} />
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {recommendedFashion.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <h4 style={{ color: '#a5b4fc', fontSize: '0.9rem', marginBottom: '0.25rem', marginTop: '0.5rem' }}>👔 Fashion Styles</h4>
                      {recommendedFashion.map((styleName, idx) => (
                        <button 
                          key={`fashion-${idx}`} 
                          onClick={() => handleStyleChange("fashion", idx, styleName)}
                          disabled={!capturedPhoto}
                          className="btn-primary"
                          style={{ padding: '0.75rem 1rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: activeItem?.category === "fashion" && activeItem?.index === idx ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', opacity: capturedPhoto ? 1 : 0.5, cursor: capturedPhoto ? 'pointer' : 'not-allowed' }}
                        >
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', textTransform: 'capitalize' }}>{styleName.replace(/_/g, " ")}</span>
                          <Wand2 size={14} style={{ color: '#f59e0b' }} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ maxHeight: '150px', overflowY: 'auto', paddingRight: '10px', fontSize: '0.8rem', lineHeight: 1.6, marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                  <div style={{ whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.7)' }}>
                    {recommendation}
                  </div>
                </div>
              )}
            </div>

            {/* Hugging Face Scanner Info */}
            <div className="glass-card fade-in" style={{ padding: '1.5rem', animationDelay: '0.3s', pointerEvents: 'auto' }}>
              <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '2px', color: '#10b981', marginBottom: '0.75rem', fontWeight: 600 }}>
                🧠 Hugging Face AI Scanner
              </div>
              {!isAvatarMode && (
                <button 
                  onClick={handleCapturePhoto}
                  className="btn-primary" 
                  style={{ width: '100%', padding: '1rem', textAlign: 'center', fontWeight: 600, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                >
                  📸 Capture Photo & Apply AI Hair
                </button>
              )}
              {scanResult && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '0.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                  {scanResult.replace(/RECOMMENDED_STYLES=\[.*\]/, '').trim()}
                </div>
              )}
              
              {isAvatarMode && capturedPhoto && (
                <button 
                  onClick={handleDownloadPDF}
                  className="btn-primary" 
                  style={{ width: '100%', marginTop: '1rem', padding: '1rem', textAlign: 'center', fontWeight: 600, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Download size={18} /> Download Style Report (PDF)
                </button>
              )}
            </div>

            {/* Removed the AR Adjustment Slider entirely since we don't have 3D scale anymore */}

          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes progress {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @keyframes scanPulse {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        .active {
          background: rgba(99, 102, 241, 0.2) !important;
          border-color: var(--primary) !important;
        }
        @media (max-width: 900px) {
          .mirror-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}} />
    </div>
  );
}
