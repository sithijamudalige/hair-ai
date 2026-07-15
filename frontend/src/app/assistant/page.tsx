"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Send, Sparkles, User, Camera } from "lucide-react";
import { loadProfile } from "@/lib/profile";
import type { ChatMessage, UserProfile } from "@/lib/types";

const API_BASE = "http://localhost:8000";

export default function AssistantPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const sendToAssistant = async (history: ChatMessage[], currentProfile: UserProfile) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/chat/hair-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: currentProfile, messages: history }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to get recommendations.");
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      
      // Save the latest recommendation for the Smart Mirror
      localStorage.setItem("latestRecommendation", data.reply);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = loadProfile();
    if (!stored) {
      router.replace("/");
      return;
    }
    setProfile(stored);
    sendToAssistant([], stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || !profile || loading) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput("");
    await sendToAssistant(nextHistory, profile);
  };

  if (!profile) {
    return (
      <div className="container fade-in">
        <p style={{ color: "var(--text-secondary)" }}>Loading hair assistant...</p>
      </div>
    );
  }

  return (
    <div className="container fade-in assistant-layout">
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/review" className="btn-secondary" style={{ padding: "0.5rem 1rem", marginBottom: "1rem", display: "inline-flex", width: "auto" }}>
          <ChevronLeft size={18} /> Edit Details
        </Link>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 700 }}>
          <Sparkles size={28} style={{ display: "inline", verticalAlign: "middle", marginRight: "0.5rem" }} />
          Hair <span className="text-gradient">Assistant</span>
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Powered by Groq AI — personalized haircut, beard, and grooming recommendations.
        </p>
      </div>

      <div className="assistant-grid">
        <aside className="glass-card profile-summary">
          <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Your Profile</h2>
          <div className="result-item"><span>Face</span><span>{profile.faceType}</span></div>
          <div className="result-item"><span>Skin</span><span>{profile.skinTone}</span></div>
          <div className="result-item"><span>Hair</span><span>{profile.hairType}</span></div>
          <div className="result-item"><span>Beard</span><span>{profile.beardStyle}</span></div>
          <div className="result-item"><span>Length</span><span>{profile.hairLength}</span></div>
          {profile.stylePreference && (
            <div className="result-item"><span>Preference</span><span>{profile.stylePreference}</span></div>
          )}
        </aside>

        <section className="glass-card chat-panel">
          <div className="chat-messages">
            {messages.length === 0 && loading && (
              <div className="chat-bubble assistant">
                <Loader2 size={18} className="spin" /> Analyzing your profile and preparing recommendations...
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble ${msg.role}`}>
                {msg.role === "assistant" ? (
                  <Sparkles size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <User size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                )}
                <div style={{ whiteSpace: "pre-wrap", width: "100%" }}>
                  {msg.content}
                  {msg.role === "assistant" && idx === messages.length - 1 && (
                    <div style={{ marginTop: "1rem" }}>
                      <Link href="/smart-mirror" className="btn-primary" style={{ display: "inline-block", padding: "0.5rem 1rem", fontSize: "0.9rem" }}>
                        <Camera size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: "0.5rem" }} />
                        Try This in Smart Mirror
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && messages.length > 0 && (
              <div className="chat-bubble assistant">
                <Loader2 size={18} className="spin" /> Thinking...
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {error && (
            <div className="chat-error">{error}</div>
          )}

          <div className="chat-input-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Ask about haircuts, beard styles, products..."
              disabled={loading}
            />
            <button onClick={handleSend} disabled={loading || !input.trim()} className="btn-primary">
              <Send size={18} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
