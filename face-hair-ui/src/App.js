import React, { useState } from "react";
import Login from "./components/Login";
import Signup from "./components/Signup";
import Welcome from "./components/Welcome";

export default function App() {
  // Always start at welcome. Welcome will show Login/Signup buttons if not logged in.
  const [page, setPage] = useState("welcome");

  return (
    <>
      {page === "welcome" && (
        <Welcome
          goLogin={() => setPage("login")}
          goSignup={() => setPage("signup")}
          onLogout={() => setPage("welcome")}
        />
      )}

      {page === "login" && (
        <Login
          onLogin={() => setPage("welcome")}
          goSignup={() => setPage("signup")}
        />
      )}

      {page === "signup" && (
        <Signup
          onSignup={() => setPage("welcome")}
          goLogin={() => setPage("login")}
        />
      )}
    </>
  );
}