import React, { useEffect, useState } from "react";

const API_BASE = "http://localhost:8000";

export default function Welcome({ goLogin, goSignup, onLogout }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      // Not logged in
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/profile`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 401) {
          // Token invalid/expired
          localStorage.removeItem("token");
          setUser(null);
          setLoading(false);
          return;
        }

        if (!res.ok) {
          const text = await res.text();
          setUser(null);
          setError(`Failed to load profile (${res.status}): ${text}`);
          setLoading(false);
          return;
        }

        const data = await res.json();
        setUser(data);
        setLoading(false);
      } catch (e) {
        setUser(null);
        setError("Could not connect to backend. Is FastAPI running on http://localhost:8000 ?");
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    setUser(null);
    if (onLogout) onLogout(); // optional: App can switch page
  }

  // If loading and there might be a token, show loading
  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;

  // If not logged in (no user), show Login/Signup buttons
  if (!user) {
    return (
      <div style={{ maxWidth: 520, margin: "24px auto", padding: 16 }}>
        <h2>Welcome</h2>
        <p>Please login or create an account to continue.</p>

        {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={goLogin}>Login</button>
          <button onClick={goSignup}>Sign Up</button>
        </div>
      </div>
    );
  }

  // Build image URL (if backend returns "uploads/xxx.jpg")
  const photoUrl =
    user?.profile_photo
      ? user.profile_photo.startsWith("http")
        ? user.profile_photo
        : `${API_BASE}/${user.profile_photo.replace(/^\/+/, "")}`
      : null;

  return (
    <div style={{ maxWidth: 520, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Welcome, {user.name}!</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <div style={{ marginTop: 16 }}>
        {photoUrl && (
          <img
            src={photoUrl}
            alt="profile"
            width={110}
            height={110}
            style={{ objectFit: "cover", borderRadius: "50%", border: "1px solid #ccc" }}
          />
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <div><b>Email:</b> {user.email}</div>
        <div><b>Mobile:</b> {user.mobile}</div>
        <div><b>DOB:</b> {user.date_of_birth}</div>
        <div><b>Age:</b> {user.age}</div>
        <div><b>Gender:</b> {user.gender}</div>

        <hr style={{ margin: "16px 0" }} />

        <div><b>Face type:</b> {user.face_type ?? "Not scanned yet"}</div>
        <div><b>Skin colour:</b> {user.skin_colour ?? "Not scanned yet"}</div>
        <div><b>Hair type:</b> {user.hair_type ?? "Not scanned yet"}</div>
      </div>
    </div>
  );
}