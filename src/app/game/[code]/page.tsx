"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/pusher-client";
import type { ClientGameState, Card } from "@/lib/types";
import { CHIP_VALUES, CHIP_COLORS } from "@/lib/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function handValue(hand: Card[]): number {
  const visible = hand.filter((c) => !c.faceDown);
  let total = 0;
  let aces = 0;
  for (const card of visible) {
    if (card.rank === "A") { total += 11; aces++; }
    else if (["K", "Q", "J"].includes(card.rank)) total += 10;
    else total += parseInt(card.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isRed(suit: string): boolean {
  return suit === "♥" || suit === "♦";
}

// ─── Card Component ─────────────────────────────────────────────────────────

function CardDisplay({ card, index }: { card: Card; index: number }) {
  if (card.faceDown) {
    return (
      <div
        className="card-enter"
        style={{
          width: 80, height: 112, borderRadius: 8,
          background: "repeating-linear-gradient(135deg, #1a3a5c, #1a3a5c 10px, #1e4d7a 10px, #1e4d7a 20px)",
          border: "2px solid #d4a843",
          boxShadow: "2px 3px 8px rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animationDelay: `${index * 0.15}s`, animationFillMode: "backwards",
        }}
      >
        <span style={{ fontSize: "1.5rem", color: "#d4a843" }}>♠</span>
      </div>
    );
  }

  const color = isRed(card.suit) ? "#c0392b" : "#2c3e50";
  return (
    <div
      className="card-enter"
      style={{
        width: 80, height: 112, borderRadius: 8,
        background: "#f5f5f0", border: "1px solid #ccc",
        boxShadow: "2px 3px 8px rgba(0,0,0,0.4)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", color, fontWeight: "bold", fontFamily: "Georgia, serif",
        animationDelay: `${index * 0.15}s`, animationFillMode: "backwards",
      }}
    >
      <span style={{ position: "absolute", top: 6, left: 8, fontSize: "0.75rem" }}>{card.suit}</span>
      <span style={{ position: "absolute", top: 18, left: 8, fontSize: "0.7rem" }}>{card.rank}</span>
      <span style={{ fontSize: "2rem" }}>{card.suit}</span>
      <span style={{ position: "absolute", bottom: 6, right: 8, fontSize: "0.75rem", transform: "rotate(180deg)" }}>{card.suit}</span>
      <span style={{ position: "absolute", bottom: 18, right: 8, fontSize: "0.7rem", transform: "rotate(180deg)" }}>{card.rank}</span>
    </div>
  );
}

// ─── Chip Component ─────────────────────────────────────────────────────────

function Chip({ value, onClick, disabled }: { value: number; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 52, height: 52, borderRadius: "50%",
        background: CHIP_COLORS[value], color: "white",
        fontWeight: "bold", fontSize: "0.75rem",
        border: "3px dashed rgba(255,255,255,0.6)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "transform 0.15s ease", fontFamily: "Georgia, serif",
      }}
    >
      ${value}
    </button>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const code = (params.code as string || "").toUpperCase();

  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [playerIndex, setPlayerIndex] = useState(-1);
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const channelRef = useRef<ReturnType<ReturnType<typeof getPusherClient>["subscribe"]> | null>(null);

  // ── Fetch & Subscribe ───────────────────────────────────────────────────
  useEffect(() => {
    const name = sessionStorage.getItem("playerName") || "Player";
    const idx = parseInt(sessionStorage.getItem("playerIndex") || "-1");
    setPlayerName(name);
    setPlayerIndex(idx);

    // Fetch initial state
    fetch(`/api/game/${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setGameState(data.state);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to connect");
        setLoading(false);
      });

    // Subscribe to Pusher
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`game-${code}`);
    channel.bind("state-update", (state: ClientGameState) => {
      setGameState(state);
    });
    channelRef.current = channel;

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`game-${code}`);
    };
  }, [code]);

  // ── Send Action ─────────────────────────────────────────────────────────
  const sendAction = useCallback(
    async (action: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/game/${code}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Action failed");
        }
      } catch {
        setError("Connection error");
      }
    },
    [code]
  );

  // ── Loading / Error ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at center, #1a7a3a 0%, #0d5c2e 50%, #062a14 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", color: "white", fontSize: "1.3rem" }}>
        Connecting to table...
      </div>
    );
  }

  if (error && !gameState) {
    return (
      <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at center, #1a7a3a 0%, #0d5c2e 50%, #062a14 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", color: "white", gap: 20 }}>
        <p style={{ fontSize: "1.3rem", color: "#e74c3c" }}>{error}</p>
        <button onClick={() => router.push("/")} style={{ padding: "12px 32px", background: "#d4a843", color: "#1a1a1a", border: "none", borderRadius: 8, fontSize: "1rem", fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif" }}>
          Back to Home
        </button>
      </div>
    );
  }

  if (!gameState) return null;

  const { phase, players, dealerHand, currentPlayer, message, roundNumber, deckCount, cardsRemaining } = gameState;

  // ── Waiting Phase ───────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at center, #1a7a3a 0%, #0d5c2e 50%, #062a14 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", color: "white", padding: 20 }}>
        <h1 style={{ fontSize: "3rem", color: "#d4a843", textShadow: "2px 3px 6px rgba(0,0,0,0.5)", marginBottom: 8, letterSpacing: 4 }}>
          ♠ BLACKJACK ♠
        </h1>
        <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 40, fontSize: "1.1rem" }}>
          Waiting for Player 2...
        </p>
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 16, padding: "32px 48px", textAlign: "center", border: "2px solid rgba(212,168,67,0.4)" }}>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            Share this room code
          </p>
          <p style={{ fontSize: "3.5rem", color: "#d4a843", letterSpacing: 12, fontWeight: "bold", textShadow: "0 0 20px rgba(212,168,67,0.3)" }}>
            {code}
          </p>
        </div>
        <button onClick={() => router.push("/")} style={{ marginTop: 30, background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: "0.9rem" }}>
          ← Leave
        </button>

        <style>{`
          @keyframes cardEnter { from { opacity:0; transform:translateY(-40px) rotate(-10deg) scale(0.8); } to { opacity:1; transform:translateY(0) rotate(0deg) scale(1); } }
          .card-enter { animation: cardEnter 0.4s ease-out forwards; }
          @keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.05); } }
        `}</style>
      </div>
    );
  }

  // ── Game Table Layout (betting, playing, dealer-turn, results) ──────────
  const showDealerFull = phase === "dealer-turn" || phase === "results";

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at center, #1a7a3a 0%, #0d5c2e 50%, #062a14 100%)", display: "flex", flexDirection: "column", fontFamily: "Georgia, serif", color: "white" }}>

      {/* Top Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", background: "rgba(0,0,0,0.3)", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>
          Round {roundNumber} · {cardsRemaining} cards · {deckCount}-deck shoe · Code: <strong style={{ color: "#d4a843" }}>{code}</strong>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {error && (
            <span style={{ color: "#e74c3c", fontSize: "0.8rem" }}>{error}</span>
          )}
          {message && (
            <span style={{ background: "rgba(212,168,67,0.2)", color: "#d4a843", padding: "6px 16px", borderRadius: 20, fontSize: "0.9rem", fontWeight: "bold" }}>
              {message}
            </span>
          )}
          <button onClick={() => router.push("/")} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem", fontFamily: "Georgia, serif" }}>
            Leave Table
          </button>
        </div>
      </div>

      {/* Dealer Area */}
      <div style={{ textAlign: "center", padding: "24px 20px 16px" }}>
        <h2 style={{ color: "#d4a843", fontSize: "1.1rem", marginBottom: 12 }}>DEALER</h2>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", minHeight: 112, alignItems: "center", flexWrap: "wrap" }}>
          {dealerHand.map((card, i) => (
            <CardDisplay key={i} card={card} index={i} />
          ))}
        </div>
        {dealerHand.length > 0 && (
          <div style={{
            display: "inline-block",
            background: showDealerFull && handValue(dealerHand) > 21 ? "rgba(192,57,43,0.7)" : "rgba(0,0,0,0.5)",
            padding: "4px 14px", borderRadius: 20, fontSize: "0.9rem", marginTop: 10,
          }}>
            {showDealerFull
              ? handValue(dealerHand) > 21
                ? `Bust! (${handValue(dealerHand)})`
                : handValue(dealerHand)
              : handValue(dealerHand.filter((c) => !c.faceDown))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid rgba(212,168,67,0.2)", margin: "0 40px" }} />

      {/* Players Area */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: 30, padding: "24px 20px", flexWrap: "wrap", alignItems: "flex-start" }}>
        {players.map((player, pi) => {
          const isMe = pi === playerIndex;
          const isActive = phase === "playing" && currentPlayer === pi && player.status === "playing";

          return (
            <div
              key={pi}
              style={{
                flex: "0 1 420px",
                background: "rgba(0,0,0,0.15)",
                borderRadius: 16, padding: 24,
                border: `2px solid ${isActive ? "#d4a843" : "rgba(255,255,255,0.1)"}`,
                boxShadow: isActive ? "0 0 20px rgba(212,168,67,0.2)" : "none",
                transition: "border-color 0.3s, box-shadow 0.3s",
              }}
            >
              {/* Player Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: "1.15rem", color: isMe ? "#d4a843" : "rgba(255,255,255,0.8)" }}>
                  {player.name} {isMe && "(You)"}
                </h3>
                <span style={{ background: "rgba(0,0,0,0.4)", padding: "4px 12px", borderRadius: 20, fontSize: "0.85rem" }}>
                  💰 ${player.chips}
                </span>
              </div>

              {/* Betting Phase */}
              {phase === "betting" && player.status === "betting" && isMe && (
                <div style={{ textAlign: "center" }}>
                  <p style={{ marginBottom: 12, fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>
                    Current bet: <strong style={{ color: "#d4a843" }}>${player.bet}</strong>
                  </p>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" }}>
                    {CHIP_VALUES.map((val) => (
                      <Chip key={val} value={val} onClick={() => sendAction({ type: "place_bet", playerIndex: pi, amount: val })} disabled={val > player.chips} />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <button onClick={() => sendAction({ type: "clear_bet", playerIndex: pi })} style={{ padding: "8px 20px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white", borderRadius: 8, cursor: "pointer", fontSize: "0.85rem", fontFamily: "Georgia, serif" }}>
                      Clear
                    </button>
                    <button
                      onClick={() => sendAction({ type: "confirm_bet", playerIndex: pi })}
                      disabled={player.bet === 0}
                      style={{
                        padding: "8px 24px",
                        background: player.bet > 0 ? "#d4a843" : "rgba(212,168,67,0.3)",
                        color: player.bet > 0 ? "#1a1a1a" : "rgba(255,255,255,0.4)",
                        border: "none", borderRadius: 8, fontWeight: "bold",
                        cursor: player.bet > 0 ? "pointer" : "not-allowed",
                        fontSize: "0.85rem", fontFamily: "Georgia, serif", textTransform: "uppercase",
                      }}
                    >
                      Confirm Bet
                    </button>
                  </div>
                </div>
              )}

              {/* Betting — other player or already confirmed */}
              {phase === "betting" && player.status === "betting" && !isMe && (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>
                  Placing bet...
                </div>
              )}
              {phase === "betting" && player.status === "done" && (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
                  <p>Bet: <strong style={{ color: "#d4a843" }}>${player.bet}</strong></p>
                  <p style={{ fontSize: "0.85rem", marginTop: 4 }}>✓ Ready</p>
                </div>
              )}

              {/* Cards */}
              {player.hand.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", minHeight: 112, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                    {player.hand.map((card, i) => (
                      <CardDisplay key={i} card={card} index={i} />
                    ))}
                  </div>
                  <div style={{ textAlign: "center", marginTop: 10 }}>
                    <span style={{
                      display: "inline-block",
                      background:
                        player.status === "bust" ? "rgba(192,57,43,0.7)" :
                        player.status === "blackjack" ? "rgba(212,168,67,0.7)" :
                        "rgba(0,0,0,0.5)",
                      color: player.status === "blackjack" ? "#1a1a1a" : "white",
                      padding: "4px 14px", borderRadius: 20, fontSize: "0.9rem",
                    }}>
                      {player.status === "bust" ? `Bust! (${handValue(player.hand)})` :
                       player.status === "blackjack" ? "BLACKJACK!" :
                       handValue(player.hand)}
                    </span>
                    {player.bet > 0 && phase !== "betting" && (
                      <span style={{ display: "inline-block", marginLeft: 8, background: "rgba(0,0,0,0.3)", padding: "4px 12px", borderRadius: 20, fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>
                        Bet: ${player.bet}
                      </span>
                    )}
                  </div>
                </>
              )}

              {/* Hit / Stand Buttons */}
              {isActive && isMe && (
                <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
                  <button
                    onClick={() => sendAction({ type: "hit", playerIndex: pi })}
                    style={{ padding: "12px 32px", background: "#27ae60", color: "white", border: "none", borderRadius: 8, fontSize: "1rem", fontWeight: "bold", cursor: "pointer", textTransform: "uppercase", letterSpacing: 1, fontFamily: "Georgia, serif" }}
                  >
                    Hit
                  </button>
                  <button
                    onClick={() => sendAction({ type: "stand", playerIndex: pi })}
                    style={{ padding: "12px 32px", background: "#c0392b", color: "white", border: "none", borderRadius: 8, fontSize: "1rem", fontWeight: "bold", cursor: "pointer", textTransform: "uppercase", letterSpacing: 1, fontFamily: "Georgia, serif" }}
                  >
                    Stand
                  </button>
                </div>
              )}

              {/* Waiting for turn */}
              {phase === "playing" && !isActive && player.status === "playing" && (
                <p style={{ textAlign: "center", marginTop: 12, color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>
                  Waiting for turn...
                </p>
              )}

              {/* Results */}
              {phase === "results" && player.result && (
                <div style={{
                  textAlign: "center", marginTop: 16, padding: 12, borderRadius: 8,
                  background:
                    player.result === "win" || player.result === "blackjack" ? "rgba(39,174,96,0.2)" :
                    player.result === "push" ? "rgba(255,255,255,0.1)" :
                    "rgba(192,57,43,0.2)",
                  border: `1px solid ${
                    player.result === "win" || player.result === "blackjack" ? "rgba(39,174,96,0.4)" :
                    player.result === "push" ? "rgba(255,255,255,0.2)" :
                    "rgba(192,57,43,0.4)"
                  }`,
                }}>
                  <p style={{
                    fontSize: "1.2rem", fontWeight: "bold",
                    color:
                      player.result === "win" ? "#27ae60" :
                      player.result === "blackjack" ? "#d4a843" :
                      player.result === "push" ? "rgba(255,255,255,0.7)" :
                      "#e74c3c",
                  }}>
                    {player.result === "blackjack" ? `BLACKJACK! +$${Math.floor(player.bet * 1.5)}` :
                     player.result === "win" ? `WIN! +$${player.bet}` :
                     player.result === "push" ? "PUSH — Bet returned" :
                     `LOSE — -$${player.bet}`}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Results — New Round Button */}
      {phase === "results" && (
        <div style={{ textAlign: "center", padding: "0 20px 30px" }}>
          {players.some((p) => p.chips <= 0) ? (
            <div>
              <p style={{ marginBottom: 16, fontSize: "1.1rem" }}>
                {players.find((p) => p.chips <= 0)?.name} is out of chips!
              </p>
              <button
                onClick={() => sendAction({ type: "back_to_lobby" })}
                style={{ padding: "14px 40px", background: "#d4a843", color: "#1a1a1a", border: "none", borderRadius: 8, fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif", textTransform: "uppercase", letterSpacing: 1 }}
              >
                New Game
              </button>
            </div>
          ) : (
            <button
              onClick={() => sendAction({ type: "new_round" })}
              style={{ padding: "14px 40px", background: "#d4a843", color: "#1a1a1a", border: "none", borderRadius: 8, fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif", textTransform: "uppercase", letterSpacing: 1 }}
            >
              Next Round
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes cardEnter {
          from { opacity: 0; transform: translateY(-40px) rotate(-10deg) scale(0.8); }
          to { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
        }
        .card-enter { animation: cardEnter 0.4s ease-out forwards; }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
