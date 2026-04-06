"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create room");
      // Store player info in sessionStorage
      sessionStorage.setItem("playerName", name.trim());
      sessionStorage.setItem("playerIndex", "0");
      router.push(`/game/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim() || !joinCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      const code = joinCode.trim().toUpperCase();
      const res = await fetch(`/api/game/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "join", playerName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join room");
      sessionStorage.setItem("playerName", name.trim());
      sessionStorage.setItem("playerIndex", "1");
      router.push(`/game/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at center, #1a7a3a 0%, #0d5c2e 50%, #062a14 100%)",
        padding: 20,
        fontFamily: "Georgia, serif",
        color: "white",
      }}
    >
      <h1
        style={{
          fontSize: "3.5rem",
          color: "#d4a843",
          textShadow: "2px 3px 6px rgba(0,0,0,0.5)",
          marginBottom: 8,
          letterSpacing: 4,
        }}
      >
        ♠ BLACKJACK ♠
      </h1>
      <p
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: "1.1rem",
          marginBottom: 40,
        }}
      >
        2 Players vs. Dealer — Real-Time Multiplayer
      </p>

      {error && (
        <div
          style={{
            background: "rgba(231,76,60,0.3)",
            border: "1px solid rgba(231,76,60,0.6)",
            padding: "10px 20px",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          background: "rgba(0,0,0,0.25)",
          border: "2px solid rgba(212,168,67,0.3)",
          borderRadius: 16,
          padding: 32,
          width: 380,
          maxWidth: "90vw",
          textAlign: "center",
        }}
      >
        {/* Name Input — always visible */}
        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: "block",
              color: "#d4a843",
              fontSize: "0.9rem",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Your Name
          </label>
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={15}
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "2px solid rgba(212,168,67,0.4)",
              borderRadius: 8,
              padding: "12px 16px",
              color: "white",
              fontSize: "1rem",
              width: "100%",
              textAlign: "center",
              fontFamily: "Georgia, serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {mode === "menu" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={() => setMode("create")}
              disabled={!name.trim()}
              style={{
                padding: "14px 24px",
                background: name.trim() ? "#d4a843" : "rgba(212,168,67,0.3)",
                color: name.trim() ? "#1a1a1a" : "rgba(255,255,255,0.4)",
                border: "none",
                borderRadius: 8,
                fontSize: "1.1rem",
                fontWeight: "bold",
                cursor: name.trim() ? "pointer" : "not-allowed",
                fontFamily: "Georgia, serif",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Create Room
            </button>
            <button
              onClick={() => setMode("join")}
              disabled={!name.trim()}
              style={{
                padding: "14px 24px",
                background: name.trim()
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(255,255,255,0.05)",
                color: name.trim() ? "white" : "rgba(255,255,255,0.3)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                fontSize: "1.1rem",
                fontWeight: "bold",
                cursor: name.trim() ? "pointer" : "not-allowed",
                fontFamily: "Georgia, serif",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Join Room
            </button>
          </div>
        )}

        {mode === "create" && (
          <div>
            <button
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              style={{
                padding: "14px 40px",
                background: "#d4a843",
                color: "#1a1a1a",
                border: "none",
                borderRadius: 8,
                fontSize: "1.1rem",
                fontWeight: "bold",
                cursor: loading ? "wait" : "pointer",
                fontFamily: "Georgia, serif",
                textTransform: "uppercase",
                letterSpacing: 1,
                opacity: loading ? 0.7 : 1,
                marginBottom: 12,
              }}
            >
              {loading ? "Creating..." : "Create & Wait for Player 2"}
            </button>
            <br />
            <button
              onClick={() => setMode("menu")}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontFamily: "Georgia, serif",
              }}
            >
              ← Back
            </button>
          </div>
        )}

        {mode === "join" && (
          <div>
            <label
              style={{
                display: "block",
                color: "#d4a843",
                fontSize: "0.9rem",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Room Code
            </label>
            <input
              type="text"
              placeholder="e.g. ABCD"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              maxLength={4}
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "2px solid rgba(212,168,67,0.4)",
                borderRadius: 8,
                padding: "12px 16px",
                color: "white",
                fontSize: "1.5rem",
                width: "100%",
                textAlign: "center",
                fontFamily: "Georgia, serif",
                outline: "none",
                letterSpacing: 8,
                marginBottom: 16,
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={handleJoin}
              disabled={loading || !name.trim() || joinCode.length < 4}
              style={{
                padding: "14px 40px",
                background:
                  name.trim() && joinCode.length === 4
                    ? "#d4a843"
                    : "rgba(212,168,67,0.3)",
                color:
                  name.trim() && joinCode.length === 4
                    ? "#1a1a1a"
                    : "rgba(255,255,255,0.4)",
                border: "none",
                borderRadius: 8,
                fontSize: "1.1rem",
                fontWeight: "bold",
                cursor:
                  loading || !name.trim() || joinCode.length < 4
                    ? "not-allowed"
                    : "pointer",
                fontFamily: "Georgia, serif",
                textTransform: "uppercase",
                letterSpacing: 1,
                opacity: loading ? 0.7 : 1,
                marginBottom: 12,
              }}
            >
              {loading ? "Joining..." : "Join Game"}
            </button>
            <br />
            <button
              onClick={() => setMode("menu")}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontFamily: "Georgia, serif",
              }}
            >
              ← Back
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
