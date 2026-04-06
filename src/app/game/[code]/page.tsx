"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/pusher-client";
import type { ClientGameState, Card, HandState } from "@/lib/types";
import { CHIP_VALUES, CHIP_COLORS } from "@/lib/types";

// ─── Web Audio API Sound Effects ────────────────────────────────────────────

const audioContext = typeof window !== "undefined" ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playSound(type: "deal" | "chip" | "win" | "lose" | "blackjack") {
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.connect(gain);
  gain.connect(audioContext.destination);

  switch (type) {
    case "deal":
      osc.frequency.value = 523; // C5
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case "chip":
      osc.frequency.value = 698; // F5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    case "win":
      const osc2 = audioContext.createOscillator();
      osc2.connect(gain);
      osc.frequency.value = 659; // E5
      osc2.frequency.value = 784; // G5
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc2.start(now);
      osc.stop(now + 0.4);
      osc2.stop(now + 0.4);
      break;
    case "lose":
      osc.frequency.setValueAtTime(392, now); // G4
      osc.frequency.exponentialRampToValueAtTime(196, now + 0.3); // G3
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case "blackjack":
      const notes = [523, 659, 784]; // C5, E5, G5
      notes.forEach((freq, idx) => {
        const o = audioContext.createOscillator();
        o.frequency.value = freq;
        o.connect(gain);
        o.start(now + idx * 0.1);
        o.stop(now + idx * 0.1 + 0.2);
      });
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      break;
  }
}

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

function getHandDisplay(hand: Card[]): { value: number; isSoft: boolean } {
  const visible = hand.filter((c) => !c.faceDown);
  let total = 0;
  let aces = 0;
  for (const card of visible) {
    if (card.rank === "A") { total += 11; aces++; }
    else if (["K", "Q", "J"].includes(card.rank)) total += 10;
    else total += parseInt(card.rank);
  }
  const softCount = aces;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { value: total, isSoft: aces > 0 };
}

function isRed(suit: string): boolean {
  return suit === "♥" || suit === "♦";
}

function canSplitHand(hand: Card[]): boolean {
  if (hand.length !== 2) return false;
  const r1 = hand[0].rank;
  const r2 = hand[1].rank;
  if (r1 === r2) return true;
  const tenValues = ["10", "J", "Q", "K"];
  return tenValues.includes(r1) && tenValues.includes(r2);
}

// ─── Card Component with Flip Animation ─────────────────────────────────────

function CardDisplay({ card, index, small, flip }: { card: Card; index: number; small?: boolean; flip?: boolean }) {
  const w = small ? 60 : 80;
  const h = small ? 84 : 112;
  const [isFlipped, setIsFlipped] = useState(card.faceDown);

  useEffect(() => {
    if (!card.faceDown && isFlipped) {
      setIsFlipped(false);
    }
  }, [card.faceDown]);

  if (card.faceDown) {
    return (
      <div
        className="card-enter"
        style={{
          width: w, height: h, borderRadius: 8,
          background: "repeating-linear-gradient(135deg, #1a3a5c, #1a3a5c 10px, #1e4d7a 10px, #1e4d7a 20px)",
          border: "2px solid #d4a843",
          boxShadow: "2px 3px 8px rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animationDelay: `${index * 0.15}s`, animationFillMode: "backwards",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: small ? "1.1rem" : "1.5rem", color: "#d4a843" }}>♠</span>
      </div>
    );
  }

  const color = isRed(card.suit) ? "#c0392b" : "#2c3e50";
  return (
    <div
      className={`card-enter ${isFlipped ? "card-flip" : ""}`}
      style={{
        width: w, height: h, borderRadius: 8,
        background: "#f5f5f0", border: "1px solid #ccc",
        boxShadow: "2px 3px 8px rgba(0,0,0,0.4)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", color, fontWeight: "bold", fontFamily: "Georgia, serif",
        animationDelay: `${index * 0.15}s`, animationFillMode: "backwards",
        flexShrink: 0,
        transformStyle: "preserve-3d",
        animation: flip ? "cardFlip 0.6s ease-in-out forwards" : undefined,
      }}
    >
      <span style={{ position: "absolute", top: 4, left: 6, fontSize: small ? "0.6rem" : "0.75rem" }}>{card.suit}</span>
      <span style={{ position: "absolute", top: small ? 14 : 18, left: 6, fontSize: small ? "0.55rem" : "0.7rem" }}>{card.rank}</span>
      <span style={{ fontSize: small ? "1.4rem" : "2rem" }}>{card.suit}</span>
      <span style={{ position: "absolute", bottom: 4, right: 6, fontSize: small ? "0.6rem" : "0.75rem", transform: "rotate(180deg)" }}>{card.suit}</span>
      <span style={{ position: "absolute", bottom: small ? 14 : 18, right: 6, fontSize: small ? "0.55rem" : "0.7rem", transform: "rotate(180deg)" }}>{card.rank}</span>
    </div>
  );
}

// ─── Chip Component with 3D Stack Effect ───────────────────────────────────

function Chip({ value, onClick, disabled }: { value: number; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={() => { if (!disabled) { playSound("chip"); onClick(); } }}
      disabled={disabled}
      style={{
        width: 48, height: 48, borderRadius: "50%",
        background: CHIP_COLORS[value], color: "white",
        fontWeight: "bold", fontSize: "0.7rem",
        border: "3px dashed rgba(255,255,255,0.6)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        fontFamily: "Georgia, serif",
        boxShadow: `0 4px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)`,
      }}
      onMouseDown={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "scale(0.95)";
        }
      }}
      onMouseUp={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "scale(1)";
        }
      }}
    >
      ${value}
    </button>
  );
}

// ─── Chip Stack Display ──────────────────────────────────────────────────────

function ChipStack({ amount }: { amount: number }) {
  const chips = [];
  const chipVals = [100, 50, 25, 10, 5, 1].filter(v => CHIP_COLORS[v]);
  let remaining = amount;

  for (const val of chipVals) {
    while (remaining >= val) {
      chips.push(val);
      remaining -= val;
    }
  }

  return (
    <div style={{ position: "relative", width: 60, height: 60 }}>
      {chips.slice(0, 3).map((chip, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 48, height: 48, borderRadius: "50%",
            background: CHIP_COLORS[chip],
            border: "3px dashed rgba(255,255,255,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.6rem", fontWeight: "bold", color: "white",
            transform: `translateY(${i * 8}px) rotate(${i * 15}deg)`,
            boxShadow: `0 ${4 + i * 2}px ${8 + i * 2}px rgba(0,0,0,0.4)`,
          }}
        >
          {chip < 10 ? "$" + chip : chip >= 50 ? "$" + chip : null}
        </div>
      ))}
      {chips.length > 3 && (
        <div style={{
          position: "absolute", bottom: 0, right: 0,
          background: "rgba(0,0,0,0.6)", color: "#d4a843",
          borderRadius: 12, padding: "2px 6px", fontSize: "0.7rem",
          fontWeight: "bold", border: "1px solid #d4a843",
        }}>
          +{chips.length - 3}
        </div>
      )}
    </div>
  );
}

// ─── Action Button ──────────────────────────────────────────────────────────

function ActionBtn({ label, onClick, color, disabled }: { label: string; onClick: () => void; color: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 20px",
        background: disabled ? "rgba(255,255,255,0.1)" : color,
        color: "white", border: "none", borderRadius: 8,
        fontSize: "0.85rem", fontWeight: "bold", cursor: disabled ? "not-allowed" : "pointer",
        textTransform: "uppercase", letterSpacing: 1, fontFamily: "Georgia, serif",
        opacity: disabled ? 0.4 : 1, transition: "all 0.2s",
        whiteSpace: "nowrap",
        boxShadow: disabled ? "none" : `0 0 15px ${color}80`,
      }}
    >
      {label}
    </button>
  );
}

// ─── Results Summary Component ───────────────────────────────────────────────

function ResultsSummary({ player }: { player?: any }) {
  const [animateCount, setAnimateCount] = useState(false);

  useEffect(() => {
    setAnimateCount(true);
  }, []);

  if (!player) return null;

  const totalWinnings = player.hands.reduce((sum: number, hand: HandState) => {
    if (!hand.result) return sum;
    if (hand.result === "blackjack") return sum + Math.floor(hand.bet * 1.5);
    if (hand.result === "win") return sum + hand.bet;
    if (hand.result === "push") return sum;
    if (hand.result === "surrender") return sum - Math.floor(hand.bet);
    return sum - hand.bet;
  }, 0);

  const wins = player.hands.filter((h: HandState) => h.result === "win" || h.result === "blackjack").length;
  const losses = player.hands.filter((h: HandState) => h.result === "lose").length;
  const pushes = player.hands.filter((h: HandState) => h.result === "push").length;

  return (
    <div style={{
      background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 16, marginBottom: 16,
      border: totalWinnings > 0 ? "2px solid #27ae60" : "2px solid #e74c3c",
    }}>
      <h3 style={{ color: "#d4a843", fontSize: "1rem", marginBottom: 12 }}>ROUND SUMMARY</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
        <div style={{ background: "rgba(39,174,96,0.1)", padding: 8, borderRadius: 8 }}>
          <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", margin: "0 0 4px" }}>Wins</p>
          <p style={{ fontSize: "1.2rem", color: "#27ae60", margin: 0, fontWeight: "bold" }}>{wins}</p>
        </div>
        <div style={{ background: "rgba(192,57,43,0.1)", padding: 8, borderRadius: 8 }}>
          <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", margin: "0 0 4px" }}>Losses</p>
          <p style={{ fontSize: "1.2rem", color: "#e74c3c", margin: 0, fontWeight: "bold" }}>{losses}</p>
        </div>
        <div style={{ background: "rgba(255,255,255,0.05)", padding: 8, borderRadius: 8 }}>
          <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", margin: "0 0 4px" }}>Pushes</p>
          <p style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.7)", margin: 0, fontWeight: "bold" }}>{pushes}</p>
        </div>
      </div>
      <div style={{
        textAlign: "center", padding: 12, background: "rgba(0,0,0,0.5)", borderRadius: 8,
        animation: animateCount ? "slideUp 0.6s ease-out" : undefined,
      }}>
        <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", margin: "0 0 6px" }}>Net Result</p>
        <p style={{
          fontSize: "2rem", fontWeight: "bold", margin: 0,
          color: totalWinnings > 0 ? "#27ae60" : totalWinnings < 0 ? "#e74c3c" : "rgba(255,255,255,0.7)",
        }}>
          {totalWinnings > 0 ? "+" : ""}{totalWinnings}
        </p>
      </div>
    </div>
  );
}

// ─── Hand Display with Soft/Hard Display ────────────────────────────────────

function HandDisplay({ hand, handIndex, totalHands, isActive }: {
  hand: HandState; handIndex: number; totalHands: number; isActive: boolean;
}) {
  const val = handValue(hand.cards);
  const { isSoft } = getHandDisplay(hand.cards);
  const showLabel = totalHands > 1;
  const hasBlackjack = hand.status === "blackjack";

  return (
    <div style={{
      border: isActive ? "2px solid #d4a843" : "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12, padding: 12, background: isActive ? "rgba(212,168,67,0.08)" : "transparent",
      transition: "all 0.3s",
      animation: hasBlackjack ? "confettiPop 0.6s ease-out" : undefined,
    }}>
      {showLabel && (
        <p style={{ fontSize: "0.75rem", color: "#d4a843", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
          Hand {handIndex + 1} · ${hand.bet}
        </p>
      )}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", minHeight: 84, alignItems: "center", flexWrap: "wrap" }}>
        {hand.cards.map((card, i) => (
          <CardDisplay key={i} card={card} index={i} small={totalHands > 1} flip={false} />
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <span style={{
          display: "inline-block",
          background:
            hand.status === "bust" ? "rgba(192,57,43,0.7)" :
            hand.status === "blackjack" ? "rgba(212,168,67,0.7)" :
            hand.status === "surrendered" ? "rgba(255,255,255,0.15)" :
            hand.status === "doubled" ? "rgba(52,152,219,0.5)" :
            "rgba(0,0,0,0.5)",
          color: hand.status === "blackjack" ? "#1a1a1a" : "white",
          padding: "3px 12px", borderRadius: 20, fontSize: "0.8rem",
          animation: hand.status === "blackjack" ? "pulseGlow 0.6s ease-out" : undefined,
        }}>
          {hand.status === "bust" ? `Bust! (${val})` :
           hand.status === "blackjack" ? "🎉 BLACKJACK!" :
           hand.status === "surrendered" ? "Surrendered" :
           hand.status === "doubled" ? `Doubled (${val})` :
           `${val}${isSoft && val < 21 ? " (Soft)" : ""}`}
        </span>
      </div>
      {/* Result */}
      {hand.result && (
        <div style={{
          textAlign: "center", marginTop: 8, padding: "6px 10px", borderRadius: 8,
          background:
            hand.result === "win" || hand.result === "blackjack" ? "rgba(39,174,96,0.2)" :
            hand.result === "push" ? "rgba(255,255,255,0.1)" :
            hand.result === "surrender" ? "rgba(255,255,255,0.08)" :
            "rgba(192,57,43,0.2)",
          fontSize: "0.85rem", fontWeight: "bold",
          color:
            hand.result === "win" ? "#27ae60" :
            hand.result === "blackjack" ? "#d4a843" :
            hand.result === "push" ? "rgba(255,255,255,0.7)" :
            hand.result === "surrender" ? "rgba(255,255,255,0.5)" :
            "#e74c3c",
          animation: (hand.result === "win" || hand.result === "blackjack") ? "slideUp 0.4s ease-out" : undefined,
        }}>
          {hand.result === "blackjack" ? `BLACKJACK! +$${Math.floor(hand.bet * 1.5)}` :
           hand.result === "win" ? `WIN! +$${hand.bet}` :
           hand.result === "push" ? "PUSH" :
           hand.result === "surrender" ? `SURRENDER −$${Math.floor(hand.bet)}` :
           `LOSE −$${hand.bet}`}
        </div>
      )}
    </div>
  );
}

// ─── Turn Timer Component ────────────────────────────────────────────────────

function TurnTimer({ duration = 30 }: { duration?: number }) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(t => t > 0 ? t - 1 : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        width: "100%", height: 4, background: "rgba(255,255,255,0.1)",
        borderRadius: 2, overflow: "hidden", marginBottom: 4,
      }}>
        <div style={{
          width: `${(timeLeft / duration) * 100}%`,
          height: "100%",
          background: timeLeft > 10 ? "#27ae60" : timeLeft > 5 ? "#f39c12" : "#e74c3c",
          transition: "width 0.3s linear, background-color 0.3s ease",
        }} />
      </div>
      <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", margin: 0 }}>
        {timeLeft}s left
      </p>
    </div>
  );
}

// ─── Shoe Penetration Indicator ──────────────────────────────────────────────

function ShoeIndicator({ cardsRemaining, deckCount }: { cardsRemaining: number; deckCount: number }) {
  const totalCards = deckCount * 52;
  const used = totalCards - cardsRemaining;
  const penetration = (used / totalCards) * 100;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem",
      color: "rgba(255,255,255,0.6)",
    }}>
      <span>Shoe</span>
      <div style={{
        width: 100, height: 6, background: "rgba(255,255,255,0.1)",
        borderRadius: 3, overflow: "hidden",
      }}>
        <div style={{
          width: `${penetration}%`,
          height: "100%",
          background: penetration > 75 ? "#e74c3c" : penetration > 50 ? "#f39c12" : "#27ae60",
          transition: "width 0.3s ease, background-color 0.3s ease",
        }} />
      </div>
      <span>{Math.round(penetration)}%</span>
    </div>
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

  // ── Fetch & Subscribe ───────────────────────────────────────────────────
  useEffect(() => {
    const name = sessionStorage.getItem("playerName") || "Player";
    const idx = parseInt(sessionStorage.getItem("playerIndex") || "-1");
    setPlayerName(name);
    setPlayerIndex(idx);

    fetch(`/api/game/${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setGameState(data.state);
        setLoading(false);
      })
      .catch(() => { setError("Failed to connect"); setLoading(false); });

    const pusher = getPusherClient();
    const channel = pusher.subscribe(`game-${code}`);
    channel.bind("state-update", (state: ClientGameState) => setGameState(state));

    return () => { channel.unbind_all(); pusher.unsubscribe(`game-${code}`); };
  }, [code]);

  // ── Send Action ─────────────────────────────────────────────────────────
  const sendAction = useCallback(
    async (action: Record<string, unknown>) => {
      try {
        if (action.type === "confirm_bet") {
          const me = gameState?.players[playerIndex];
          if (me && me.bet > 0 && me.bet < 5) {
            setError("Minimum bet is $5");
            return;
          }
          playSound("chip");
        } else if (action.type === "hit" || action.type === "deal") {
          playSound("deal");
        }

        const res = await fetch(`/api/game/${code}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const data = await res.json();
        if (!res.ok) setError(data.error || "Action failed");
      } catch {
        setError("Connection error");
      }
    },
    [code, gameState, playerIndex]
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
    const isHost = playerIndex === 0;
    return (
      <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at center, #1a7a3a 0%, #0d5c2e 50%, #062a14 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", color: "white", padding: 20 }}>
        <h1 style={{ fontSize: "3rem", color: "#d4a843", textShadow: "2px 3px 6px rgba(0,0,0,0.5)", marginBottom: 8, letterSpacing: 4 }}>
          ♠ BLACKJACK ♠
        </h1>

        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 16, padding: "32px 48px", textAlign: "center", border: "2px solid rgba(212,168,67,0.4)", marginBottom: 24, minWidth: 320 }}>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            Share this room code
          </p>
          <p style={{ fontSize: "3.5rem", color: "#d4a843", letterSpacing: 12, fontWeight: "bold", textShadow: "0 0 20px rgba(212,168,67,0.3)" }}>
            {code}
          </p>
        </div>

        {/* Player List */}
        <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "16px 32px", marginBottom: 24, minWidth: 280 }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Players ({players.length}/6)
          </p>
          {players.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < players.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: i === 0 ? "#d4a843" : "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: "bold", color: i === 0 ? "#1a1a1a" : "white" }}>
                {i + 1}
              </span>
              <span style={{ color: i === playerIndex ? "#d4a843" : "white", fontWeight: i === playerIndex ? "bold" : "normal" }}>
                {p.name} {i === playerIndex && "(You)"} {i === 0 && "★"}
              </span>
            </div>
          ))}
        </div>

        {/* Start / Leave buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          {isHost && players.length >= 2 && (
            <button
              onClick={() => sendAction({ type: "start_game" })}
              style={{
                padding: "14px 40px", background: "#d4a843", color: "#1a1a1a", border: "none", borderRadius: 8,
                fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif",
                textTransform: "uppercase", letterSpacing: 1,
                animation: "pulse 2s ease-in-out infinite",
              }}
            >
              Start Game
            </button>
          )}
          {isHost && players.length < 2 && (
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>
              Waiting for at least 1 more player...
            </p>
          )}
          {!isHost && (
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>
              Waiting for host to start the game...
            </p>
          )}
        </div>

        <button onClick={() => router.push("/")} style={{ marginTop: 20, background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: "0.9rem" }}>
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

  // ── Insurance Phase ────────────────────────────────────────────────────
  if (phase === "insurance") {
    const me = players[playerIndex];
    const needsDecision = me && me.status === "betting";
    const insuranceCost = me ? Math.floor((me.hands[0]?.bet || 0) / 2) : 0;

    return (
      <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at center, #1a7a3a 0%, #0d5c2e 50%, #062a14 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", color: "white", padding: 20 }}>
        <h1 style={{ fontSize: "2.5rem", color: "#d4a843", marginBottom: 8, letterSpacing: 4 }}>♠ BLACKJACK ♠</h1>

        {/* Dealer showing Ace */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ color: "#d4a843", fontSize: "1rem", marginBottom: 12 }}>DEALER</h2>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {dealerHand.map((card, i) => <CardDisplay key={i} card={card} index={i} />)}
          </div>
        </div>

        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 16, padding: "32px 48px", textAlign: "center", border: "2px solid rgba(212,168,67,0.4)", maxWidth: 400 }}>
          <h2 style={{ color: "#d4a843", fontSize: "1.3rem", marginBottom: 16 }}>INSURANCE?</h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", marginBottom: 20 }}>
            Dealer shows an Ace. Buy insurance for <strong style={{ color: "#d4a843" }}>${insuranceCost}</strong>?
            <br />
            <span style={{ fontSize: "0.8rem" }}>Pays 2:1 if dealer has Blackjack</span>
          </p>

          {needsDecision ? (
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <ActionBtn label={`Yes ($${insuranceCost})`} onClick={() => sendAction({ type: "insurance", playerIndex, accept: true })} color="#27ae60" disabled={insuranceCost > me.chips} />
              <ActionBtn label="No Thanks" onClick={() => sendAction({ type: "insurance", playerIndex, accept: false })} color="#c0392b" />
            </div>
          ) : (
            <p style={{ color: "rgba(255,255,255,0.5)" }}>Waiting for other players...</p>
          )}
        </div>

        <style>{`
          @keyframes cardEnter { from { opacity:0; transform:translateY(-40px) rotate(-10deg) scale(0.8); } to { opacity:1; transform:translateY(0) rotate(0deg) scale(1); } }
          .card-enter { animation: cardEnter 0.4s ease-out forwards; }
        `}</style>
      </div>
    );
  }

  // ── Game Table Layout (betting, playing, dealer-turn, results) ──────────
  const showDealerFull = phase === "dealer-turn" || phase === "results";
  const manyPlayers = players.length > 3;

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at center, #1a7a3a 0%, #0d5c2e 50%, #062a14 100%)", display: "flex", flexDirection: "column", fontFamily: "Georgia, serif", color: "white" }}>

      {/* Top Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", background: "rgba(0,0,0,0.3)", flexWrap: "wrap", gap: 6 }}>
        <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>
          Round {roundNumber} · {cardsRemaining} cards · {deckCount}-deck shoe · Room: <strong style={{ color: "#d4a843" }}>{code}</strong> · {players.length} players
        </div>
        <ShoeIndicator cardsRemaining={cardsRemaining} deckCount={deckCount} />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {error && <span style={{ color: "#e74c3c", fontSize: "0.75rem" }}>{error}</span>}
          {message && (
            <span style={{ background: "rgba(212,168,67,0.2)", color: "#d4a843", padding: "4px 14px", borderRadius: 20, fontSize: "0.8rem", fontWeight: "bold" }}>
              {message}
            </span>
          )}
          <button onClick={() => router.push("/")} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.75rem", fontFamily: "Georgia, serif" }}>
            Leave
          </button>
        </div>
      </div>

      {/* Dealer Area */}
      <div style={{ textAlign: "center", padding: "20px 20px 12px" }}>
        <h2 style={{ color: "#d4a843", fontSize: "1rem", marginBottom: 10 }}>DEALER</h2>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", minHeight: 112, alignItems: "center", flexWrap: "wrap" }}>
          {dealerHand.map((card, i) => <CardDisplay key={i} card={card} index={i} />)}
        </div>
        {dealerHand.length > 0 && (
          <div style={{
            display: "inline-block",
            background: showDealerFull && handValue(dealerHand) > 21 ? "rgba(192,57,43,0.7)" : "rgba(0,0,0,0.5)",
            padding: "3px 12px", borderRadius: 20, fontSize: "0.85rem", marginTop: 8,
          }}>
            {showDealerFull
              ? handValue(dealerHand) > 21
                ? `Bust! (${handValue(dealerHand)})`
                : handValue(dealerHand)
              : handValue(dealerHand.filter((c) => !c.faceDown))}
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid rgba(212,168,67,0.2)", margin: "0 30px" }} />

      {/* Players Area */}
      <div style={{
        flex: 1, display: "flex", justifyContent: "center", gap: manyPlayers ? 12 : 20,
        padding: "16px 12px", flexWrap: "wrap", alignItems: "flex-start",
      }}>
        {players.map((player, pi) => {
          const isMe = pi === playerIndex;
          const isActivePlayer = phase === "playing" && currentPlayer === pi && player.status === "playing";
          const currentHand = player.hands[player.currentHandIndex];
          const canAct = isMe && isActivePlayer && currentHand && currentHand.status === "playing";

          // Can double: first 2 cards only, enough chips
          const canDouble = canAct && currentHand.cards.length === 2 && currentHand.bet <= player.chips;
          // Can split: pair, only 1 hand, enough chips
          const canSplitNow = canAct && player.hands.length === 1 && canSplitHand(currentHand.cards) && currentHand.bet <= player.chips;
          // Can surrender: first 2 cards, no split
          const canSurrenderNow = canAct && currentHand.cards.length === 2 && player.hands.length === 1;

          return (
            <div
              key={pi}
              style={{
                flex: manyPlayers ? "0 1 280px" : "0 1 380px",
                background: "rgba(0,0,0,0.15)",
                borderRadius: 14, padding: manyPlayers ? 14 : 20,
                border: `2px solid ${isActivePlayer ? "#d4a843" : isMe ? "rgba(212,168,67,0.25)" : "rgba(255,255,255,0.08)"}`,
                boxShadow: isActivePlayer ? "0 0 20px rgba(212,168,67,0.2)" : "none",
                transition: "border-color 0.3s, box-shadow 0.3s",
              }}
            >
              {/* Player Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{
                  fontSize: manyPlayers ? "0.9rem" : "1rem",
                  color: isMe ? "#d4a843" : "rgba(255,255,255,0.8)",
                  margin: 0,
                  animation: isActivePlayer ? "pulseGlow 1.5s ease-in-out infinite" : undefined,
                }}>
                  {player.name} {isMe && "(You)"}
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ChipStack amount={player.chips} />
                  <span style={{ background: "rgba(0,0,0,0.4)", padding: "3px 10px", borderRadius: 20, fontSize: "0.8rem" }}>
                    ${player.chips}
                  </span>
                </div>
              </div>

              {/* Insurance result */}
              {player.insuranceBet > 0 && player.insuranceResult && (
                <div style={{
                  textAlign: "center", marginBottom: 8, padding: "3px 8px", borderRadius: 6,
                  fontSize: "0.75rem", fontWeight: "bold",
                  background: player.insuranceResult === "win" ? "rgba(39,174,96,0.2)" : "rgba(192,57,43,0.15)",
                  color: player.insuranceResult === "win" ? "#27ae60" : "#e74c3c",
                }}>
                  Insurance: {player.insuranceResult === "win" ? `+$${player.insuranceBet * 2}` : `-$${player.insuranceBet}`}
                </div>
              )}

              {/* Betting Phase */}
              {phase === "betting" && player.status === "betting" && isMe && (
                <div style={{ textAlign: "center" }}>
                  <p style={{ marginBottom: 10, fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>
                    Bet: <strong style={{ color: "#d4a843" }}>${player.bet}</strong> {player.bet > 0 && player.bet < 5 && <span style={{ color: "#e74c3c" }}>(min $5)</span>}
                  </p>
                  <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" }}>
                    {CHIP_VALUES.map((val) => (
                      <Chip key={val} value={val} onClick={() => sendAction({ type: "place_bet", playerIndex: pi, amount: val })} disabled={val > player.chips} />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button onClick={() => sendAction({ type: "clear_bet", playerIndex: pi })} style={{ padding: "7px 16px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white", borderRadius: 8, cursor: "pointer", fontSize: "0.8rem", fontFamily: "Georgia, serif" }}>
                      Clear
                    </button>
                    <button
                      onClick={() => sendAction({ type: "confirm_bet", playerIndex: pi })}
                      disabled={player.bet === 0 || player.bet < 5}
                      style={{
                        padding: "7px 20px",
                        background: (player.bet > 0 && player.bet >= 5) ? "#d4a843" : "rgba(212,168,67,0.3)",
                        color: (player.bet > 0 && player.bet >= 5) ? "#1a1a1a" : "rgba(255,255,255,0.4)",
                        border: "none", borderRadius: 8, fontWeight: "bold",
                        cursor: (player.bet > 0 && player.bet >= 5) ? "pointer" : "not-allowed",
                        fontSize: "0.8rem", fontFamily: "Georgia, serif", textTransform: "uppercase",
                      }}
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}

              {phase === "betting" && player.status === "betting" && !isMe && (
                <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>Placing bet...</p>
              )}
              {phase === "betting" && player.status === "done" && (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
                  <p>Bet: <strong style={{ color: "#d4a843" }}>${player.bet}</strong></p>
                  <p style={{ fontSize: "0.8rem", marginTop: 4 }}>✓ Ready</p>
                </div>
              )}

              {/* Hands (playing/results) */}
              {player.hands.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {player.hands.map((hand, hi) => (
                    <HandDisplay
                      key={hi}
                      hand={hand}
                      handIndex={hi}
                      totalHands={player.hands.length}
                      isActive={isActivePlayer && hi === player.currentHandIndex}
                    />
                  ))}
                </div>
              )}

              {/* Bet display when only 1 hand */}
              {player.hands.length === 1 && player.hands[0].bet > 0 && phase !== "betting" && !player.hands[0].result && (
                <p style={{ textAlign: "center", fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                  Bet: ${player.hands[0].bet}
                </p>
              )}

              {/* Action Buttons */}
              {canAct && (
                <div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
                    <ActionBtn label="Hit" onClick={() => sendAction({ type: "hit", playerIndex: pi })} color="#27ae60" />
                    <ActionBtn label="Stand" onClick={() => sendAction({ type: "stand", playerIndex: pi })} color="#c0392b" />
                    {canDouble && (
                      <ActionBtn label={`Double`} onClick={() => sendAction({ type: "double_down", playerIndex: pi })} color="#2980b9" />
                    )}
                    {canSplitNow && (
                      <ActionBtn label="Split" onClick={() => sendAction({ type: "split", playerIndex: pi })} color="#8e44ad" />
                    )}
                    {canSurrenderNow && (
                      <ActionBtn label="Surrender" onClick={() => sendAction({ type: "surrender", playerIndex: pi })} color="#7f8c8d" />
                    )}
                  </div>
                  <TurnTimer duration={30} />
                </div>
              )}

              {/* Waiting for turn */}
              {phase === "playing" && !isActivePlayer && player.status === "playing" && (
                <p style={{ textAlign: "center", marginTop: 10, color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>
                  Waiting...
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Results — New Round Button with Summary */}
      {phase === "results" && (
        <div style={{ textAlign: "center", padding: "0 20px 24px" }}>
          {playerIndex >= 0 && (
            <ResultsSummary player={players[playerIndex]} />
          )}
          {players.some((p) => p.chips <= 0) ? (
            <div>
              <p style={{ marginBottom: 12, fontSize: "1rem" }}>
                {players.filter((p) => p.chips <= 0).map(p => p.name).join(", ")} out of chips!
              </p>
              <button
                onClick={() => sendAction({ type: "back_to_lobby" })}
                style={{ padding: "12px 36px", background: "#d4a843", color: "#1a1a1a", border: "none", borderRadius: 8, fontSize: "1rem", fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif", textTransform: "uppercase", letterSpacing: 1 }}
              >
                New Game
              </button>
            </div>
          ) : (
            <button
              onClick={() => sendAction({ type: "new_round" })}
              style={{ padding: "12px 36px", background: "#d4a843", color: "#1a1a1a", border: "none", borderRadius: 8, fontSize: "1rem", fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif", textTransform: "uppercase", letterSpacing: 1 }}
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

        @keyframes cardFlip {
          0% { transform: rotateY(0deg); }
          50% { transform: rotateY(90deg); }
          100% { transform: rotateY(0deg); }
        }
        .card-flip { animation: cardFlip 0.6s ease-in-out; }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @keyframes pulseGlow {
          0%, 100% { text-shadow: 0 0 0 rgba(212, 168, 67, 0), 0 0 10px rgba(212, 168, 67, 0.5); }
          50% { text-shadow: 0 0 10px rgba(212, 168, 67, 0.8), 0 0 20px rgba(212, 168, 67, 0.4); }
        }

        @keyframes confettiPop {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100px) rotate(720deg); opacity: 0; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .confetti-particle {
          position: fixed;
          pointer-events: none;
          animation: confetti 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
