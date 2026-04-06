"use client";

import { useState, useCallback, useEffect, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

interface Card {
  suit: Suit;
  rank: Rank;
  faceDown?: boolean;
}

interface PlayerState {
  name: string;
  hand: Card[];
  bet: number;
  chips: number;
  status: "betting" | "playing" | "standing" | "bust" | "blackjack" | "done";
  result?: "win" | "lose" | "push" | "blackjack";
}

type GamePhase = "lobby" | "betting" | "dealing" | "playing" | "dealer-turn" | "results";

// ─── Constants ───────────────────────────────────────────────────────────────

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const CHIP_VALUES = [5, 10, 25, 50, 100];
const CHIP_COLORS: Record<number, string> = {
  5: "#e74c3c",
  10: "#3498db",
  25: "#27ae60",
  50: "#e67e22",
  100: "#2c3e50",
};
const STARTING_CHIPS = 500;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createShoe(): Card[] {
  // Random number of decks between 4 and 8 to prevent card counting
  const numDecks = Math.floor(Math.random() * 5) + 4;
  const shoe: Card[] = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ suit, rank });
      }
    }
  }
  // Fisher-Yates shuffle
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

function cardValue(card: Card): number[] {
  if (card.rank === "A") return [1, 11];
  if (["K", "Q", "J"].includes(card.rank)) return [10];
  return [parseInt(card.rank)];
}

function handValue(hand: Card[]): number {
  const visibleCards = hand.filter((c) => !c.faceDown);
  let total = 0;
  let aces = 0;
  for (const card of visibleCards) {
    const vals = cardValue(card);
    if (vals.length === 2) {
      total += 11;
      aces++;
    } else {
      total += vals[0];
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand) === 21;
}

function isRed(suit: Suit): boolean {
  return suit === "♥" || suit === "♦";
}

// ─── Card Component ──────────────────────────────────────────────────────────

function CardDisplay({ card, index }: { card: Card; index: number }) {
  if (card.faceDown) {
    return (
      <div
        className="card-enter"
        style={{
          width: 80,
          height: 112,
          borderRadius: 8,
          background:
            "repeating-linear-gradient(135deg, #1a3a5c, #1a3a5c 10px, #1e4d7a 10px, #1e4d7a 20px)",
          border: "2px solid #d4a843",
          boxShadow: "2px 3px 8px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animationDelay: `${index * 0.15}s`,
          animationFillMode: "backwards",
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
        width: 80,
        height: 112,
        borderRadius: 8,
        background: "#f5f5f0",
        border: "1px solid #ccc",
        boxShadow: "2px 3px 8px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        color,
        fontWeight: "bold",
        fontFamily: "Georgia, serif",
        animationDelay: `${index * 0.15}s`,
        animationFillMode: "backwards",
      }}
    >
      <span style={{ position: "absolute", top: 6, left: 8, fontSize: "0.75rem" }}>
        {card.suit}
      </span>
      <span style={{ position: "absolute", top: 18, left: 8, fontSize: "0.7rem" }}>
        {card.rank}
      </span>
      <span style={{ fontSize: "2rem" }}>{card.suit}</span>
      <span style={{ position: "absolute", bottom: 6, right: 8, fontSize: "0.75rem", transform: "rotate(180deg)" }}>
        {card.suit}
      </span>
      <span style={{ position: "absolute", bottom: 18, right: 8, fontSize: "0.7rem", transform: "rotate(180deg)" }}>
        {card.rank}
      </span>
    </div>
  );
}

// ─── Chip Component ──────────────────────────────────────────────────────────

function Chip({
  value,
  onClick,
  disabled,
}: {
  value: number;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: CHIP_COLORS[value],
        color: "white",
        fontWeight: "bold",
        fontSize: "0.75rem",
        border: "3px dashed rgba(255,255,255,0.6)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "transform 0.15s ease",
        fontFamily: "Georgia, serif",
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.target as HTMLElement).style.transform = "scale(1.15)";
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.transform = "scale(1)";
      }}
    >
      ${value}
    </button>
  );
}

// ─── Lobby Screen ────────────────────────────────────────────────────────────

function Lobby({
  onStart,
}: {
  onStart: (p1: string, p2: string) => void;
}) {
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [p1Joined, setP1Joined] = useState(false);
  const [p2Joined, setP2Joined] = useState(false);

  const handleJoin1 = () => {
    if (name1.trim()) setP1Joined(true);
  };
  const handleJoin2 = () => {
    if (name2.trim()) setP2Joined(true);
  };

  const canStart = p1Joined && p2Joined;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at center, #1a7a3a 0%, #0d5c2e 50%, #062a14 100%)",
        padding: 20,
      }}
    >
      <h1
        style={{
          fontSize: "3.5rem",
          color: "#d4a843",
          textShadow: "2px 3px 6px rgba(0,0,0,0.5)",
          marginBottom: 8,
          letterSpacing: 4,
          fontFamily: "Georgia, serif",
        }}
      >
        ♠ BLACKJACK ♠
      </h1>
      <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "1.1rem", marginBottom: 40 }}>
        2 Players vs. Dealer
      </p>

      <div style={{ display: "flex", gap: 30, flexWrap: "wrap", justifyContent: "center", marginBottom: 40 }}>
        {/* Player 1 Slot */}
        <div
          style={{
            background: p1Joined ? "rgba(212,168,67,0.1)" : "rgba(0,0,0,0.25)",
            border: `2px solid ${p1Joined ? "#d4a843" : "rgba(212,168,67,0.3)"}`,
            borderRadius: 12,
            padding: 24,
            width: 300,
            textAlign: "center",
          }}
        >
          <h3 style={{ color: "#d4a843", fontSize: "1.2rem", marginBottom: 16 }}>Player 1</h3>
          {!p1Joined ? (
            <>
              <input
                type="text"
                placeholder="Enter your name"
                value={name1}
                onChange={(e) => setName1(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin1()}
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
                  marginBottom: 12,
                  outline: "none",
                }}
              />
              <button
                onClick={handleJoin1}
                disabled={!name1.trim()}
                style={{
                  padding: "10px 28px",
                  background: name1.trim() ? "#d4a843" : "rgba(212,168,67,0.3)",
                  color: name1.trim() ? "#1a1a1a" : "rgba(255,255,255,0.4)",
                  border: "none",
                  borderRadius: 8,
                  fontSize: "1rem",
                  fontWeight: "bold",
                  cursor: name1.trim() ? "pointer" : "not-allowed",
                  fontFamily: "Georgia, serif",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Join
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: "1.3rem", fontWeight: "bold" }}>{name1}</p>
              <p style={{ color: "#27ae60", fontSize: "0.9rem", marginTop: 8 }}>✓ Ready</p>
            </>
          )}
        </div>

        {/* Player 2 Slot */}
        <div
          style={{
            background: p2Joined ? "rgba(212,168,67,0.1)" : "rgba(0,0,0,0.25)",
            border: `2px solid ${p2Joined ? "#d4a843" : "rgba(212,168,67,0.3)"}`,
            borderRadius: 12,
            padding: 24,
            width: 300,
            textAlign: "center",
          }}
        >
          <h3 style={{ color: "#d4a843", fontSize: "1.2rem", marginBottom: 16 }}>Player 2</h3>
          {!p2Joined ? (
            <>
              <input
                type="text"
                placeholder="Enter your name"
                value={name2}
                onChange={(e) => setName2(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin2()}
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
                  marginBottom: 12,
                  outline: "none",
                }}
              />
              <button
                onClick={handleJoin2}
                disabled={!name2.trim()}
                style={{
                  padding: "10px 28px",
                  background: name2.trim() ? "#d4a843" : "rgba(212,168,67,0.3)",
                  color: name2.trim() ? "#1a1a1a" : "rgba(255,255,255,0.4)",
                  border: "none",
                  borderRadius: 8,
                  fontSize: "1rem",
                  fontWeight: "bold",
                  cursor: name2.trim() ? "pointer" : "not-allowed",
                  fontFamily: "Georgia, serif",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Join
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: "1.3rem", fontWeight: "bold" }}>{name2}</p>
              <p style={{ color: "#27ae60", fontSize: "0.9rem", marginTop: 8 }}>✓ Ready</p>
            </>
          )}
        </div>
      </div>

      {canStart && (
        <button
          onClick={() => onStart(name1.trim(), name2.trim())}
          style={{
            padding: "16px 48px",
            background: "#d4a843",
            color: "#1a1a1a",
            border: "none",
            borderRadius: 12,
            fontSize: "1.3rem",
            fontWeight: "bold",
            cursor: "pointer",
            fontFamily: "Georgia, serif",
            textTransform: "uppercase",
            letterSpacing: 2,
            boxShadow: "0 4px 20px rgba(212,168,67,0.4)",
            animation: "pulse 1.5s infinite",
          }}
        >
          Deal Me In!
        </button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes cardEnter {
          from { opacity: 0; transform: translateY(-40px) rotate(-10deg) scale(0.8); }
          to { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
        }
        .card-enter { animation: cardEnter 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
}

// ─── Main Game Component ─────────────────────────────────────────────────────

export default function BlackjackGame() {
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [shoe, setShoe] = useState<Card[]>([]);
  const [deckCount, setDeckCount] = useState(0);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [message, setMessage] = useState("");
  const [roundNumber, setRoundNumber] = useState(0);
  const shoeRef = useRef<Card[]>([]);

  // Draw a card from the shoe
  const drawCard = useCallback(
    (faceDown = false): Card => {
      const current = shoeRef.current;
      if (current.length < 20) {
        // Reshuffle
        const newShoe = createShoe();
        shoeRef.current = newShoe;
        setShoe(newShoe);
        setDeckCount(Math.floor(newShoe.length / 52));
      }
      const card = { ...current.pop()!, faceDown };
      setShoe([...shoeRef.current]);
      return card;
    },
    []
  );

  // Start from lobby
  const handleLobbyStart = (p1Name: string, p2Name: string) => {
    const newShoe = createShoe();
    shoeRef.current = newShoe;
    setShoe(newShoe);
    setDeckCount(Math.floor(newShoe.length / 52));
    setPlayers([
      { name: p1Name, hand: [], bet: 0, chips: STARTING_CHIPS, status: "betting" },
      { name: p2Name, hand: [], bet: 0, chips: STARTING_CHIPS, status: "betting" },
    ]);
    setPhase("betting");
    setMessage("Place your bets!");
    setRoundNumber(1);
  };

  // Betting
  const placeBet = (playerIndex: number, amount: number) => {
    setPlayers((prev) => {
      const next = [...prev];
      const p = { ...next[playerIndex] };
      if (p.status !== "betting" || amount > p.chips) return prev;
      p.bet += amount;
      p.chips -= amount;
      next[playerIndex] = p;
      return next;
    });
  };

  const clearBet = (playerIndex: number) => {
    setPlayers((prev) => {
      const next = [...prev];
      const p = { ...next[playerIndex] };
      if (p.status !== "betting") return prev;
      p.chips += p.bet;
      p.bet = 0;
      next[playerIndex] = p;
      return next;
    });
  };

  const confirmBet = (playerIndex: number) => {
    setPlayers((prev) => {
      const next = [...prev];
      const p = { ...next[playerIndex] };
      if (p.bet === 0) return prev;
      p.status = "done";
      next[playerIndex] = p;
      return next;
    });
  };

  // Check if all bets placed, then deal
  useEffect(() => {
    if (phase !== "betting") return;
    if (players.length === 0) return;
    if (players.every((p) => p.status === "done" && p.bet > 0)) {
      dealInitialCards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, phase]);

  const dealInitialCards = () => {
    setPhase("dealing");
    const p1Hand = [drawCard(), drawCard()];
    const p2Hand = [drawCard(), drawCard()];
    const dHand = [drawCard(), drawCard(true)]; // dealer second card face down

    setPlayers((prev) => {
      const next = [...prev];
      next[0] = { ...next[0], hand: p1Hand, status: isBlackjack(p1Hand) ? "blackjack" : "playing" };
      next[1] = { ...next[1], hand: p2Hand, status: isBlackjack(p2Hand) ? "blackjack" : "playing" };
      return next;
    });
    setDealerHand(dHand);

    setTimeout(() => {
      setPhase("playing");
      setCurrentPlayer(0);
      setMessage("");
    }, 800);
  };

  // Determine who actually plays next
  useEffect(() => {
    if (phase !== "playing") return;

    // Skip players who have blackjack or are done
    if (currentPlayer < players.length) {
      const p = players[currentPlayer];
      if (p.status === "blackjack" || p.status === "bust" || p.status === "standing") {
        if (currentPlayer + 1 < players.length) {
          setCurrentPlayer(currentPlayer + 1);
        } else {
          // All players done, dealer's turn
          startDealerTurn();
        }
      } else {
        setMessage(`${p.name}'s turn`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayer, phase, players]);

  // Hit
  const hit = () => {
    if (phase !== "playing") return;
    const pi = currentPlayer;
    const newCard = drawCard();

    setPlayers((prev) => {
      const next = [...prev];
      const p = { ...next[pi] };
      p.hand = [...p.hand, newCard];
      const val = handValue(p.hand);
      if (val > 21) {
        p.status = "bust";
      } else if (val === 21) {
        p.status = "standing";
      }
      next[pi] = p;
      return next;
    });
  };

  // Check if bust/standing → advance player
  useEffect(() => {
    if (phase !== "playing") return;
    const p = players[currentPlayer];
    if (!p) return;

    if (p.status === "bust" || (p.status === "standing" && p.hand.length > 2)) {
      const timer = setTimeout(() => {
        if (currentPlayer + 1 < players.length) {
          setCurrentPlayer(currentPlayer + 1);
        } else {
          startDealerTurn();
        }
      }, 800);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, currentPlayer, phase]);

  // Stand
  const stand = () => {
    if (phase !== "playing") return;
    const pi = currentPlayer;
    setPlayers((prev) => {
      const next = [...prev];
      next[pi] = { ...next[pi], status: "standing" };
      return next;
    });

    setTimeout(() => {
      if (pi + 1 < players.length) {
        setCurrentPlayer(pi + 1);
      } else {
        startDealerTurn();
      }
    }, 300);
  };

  // Dealer turn
  const startDealerTurn = () => {
    setPhase("dealer-turn");
    setMessage("Dealer's turn...");

    // Flip face-down card
    setDealerHand((prev) => prev.map((c) => ({ ...c, faceDown: false })));
  };

  // Dealer draw loop
  useEffect(() => {
    if (phase !== "dealer-turn") return;

    // Check if all players busted
    const allBust = players.every((p) => p.status === "bust");
    if (allBust) {
      setTimeout(() => resolveRound(), 600);
      return;
    }

    const dealerVal = handValue(dealerHand);
    if (dealerVal < 17) {
      const timer = setTimeout(() => {
        const newCard = drawCard();
        setDealerHand((prev) => [...prev, newCard]);
      }, 700);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => resolveRound(), 600);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, dealerHand]);

  // Resolve
  const resolveRound = () => {
    const dealerVal = handValue(dealerHand);
    const dealerBust = dealerVal > 21;
    const dealerBJ = isBlackjack(dealerHand);

    setPlayers((prev) =>
      prev.map((p) => {
        const pVal = handValue(p.hand);
        const pBJ = isBlackjack(p.hand);
        let result: PlayerState["result"];
        let payout = 0;

        if (p.status === "bust") {
          result = "lose";
        } else if (pBJ && dealerBJ) {
          result = "push";
          payout = p.bet;
        } else if (pBJ) {
          result = "blackjack";
          payout = p.bet + Math.floor(p.bet * 1.5);
        } else if (dealerBust) {
          result = "win";
          payout = p.bet * 2;
        } else if (pVal > dealerVal) {
          result = "win";
          payout = p.bet * 2;
        } else if (pVal === dealerVal) {
          result = "push";
          payout = p.bet;
        } else {
          result = "lose";
        }

        return {
          ...p,
          result,
          chips: p.chips + payout,
          status: "done" as const,
        };
      })
    );

    setPhase("results");
    setMessage("Round complete!");
  };

  // New round
  const newRound = () => {
    // Check if shoe needs reshuffling
    if (shoeRef.current.length < 40) {
      const newShoe = createShoe();
      shoeRef.current = newShoe;
      setShoe(newShoe);
      setDeckCount(Math.floor(newShoe.length / 52));
    }

    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        hand: [],
        bet: 0,
        status: "betting" as const,
        result: undefined,
      }))
    );
    setDealerHand([]);
    setPhase("betting");
    setMessage("Place your bets!");
    setRoundNumber((r) => r + 1);
  };

  // Back to lobby
  const backToLobby = () => {
    setPhase("lobby");
    setPlayers([]);
    setDealerHand([]);
    setShoe([]);
    shoeRef.current = [];
    setMessage("");
    setRoundNumber(0);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (phase === "lobby") {
    return <Lobby onStart={handleLobbyStart} />;
  }

  const dealerVal = handValue(dealerHand);
  const showDealerFull = phase === "dealer-turn" || phase === "results";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at center, #1a7a3a 0%, #0d5c2e 50%, #062a14 100%)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Georgia, serif",
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 24px",
          background: "rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>
          Round {roundNumber} · {shoe.length} cards remaining · {deckCount} deck shoe
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {message && (
            <span
              style={{
                background: "rgba(212,168,67,0.2)",
                color: "#d4a843",
                padding: "6px 16px",
                borderRadius: 20,
                fontSize: "0.9rem",
                fontWeight: "bold",
              }}
            >
              {message}
            </span>
          )}
          <button
            onClick={backToLobby}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "rgba(255,255,255,0.7)",
              padding: "6px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.8rem",
              fontFamily: "Georgia, serif",
            }}
          >
            Leave Table
          </button>
        </div>
      </div>

      {/* Dealer Area */}
      <div style={{ textAlign: "center", padding: "24px 20px 16px" }}>
        <h2 style={{ color: "#d4a843", fontSize: "1.1rem", marginBottom: 12 }}>DEALER</h2>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", minHeight: 112, alignItems: "center" }}>
          {dealerHand.map((card, i) => (
            <CardDisplay key={i} card={card} index={i} />
          ))}
        </div>
        {dealerHand.length > 0 && (
          <div
            style={{
              display: "inline-block",
              background: dealerVal > 21 ? "rgba(192,57,43,0.7)" : "rgba(0,0,0,0.5)",
              padding: "4px 14px",
              borderRadius: 20,
              fontSize: "0.9rem",
              marginTop: 10,
            }}
          >
            {showDealerFull
              ? dealerVal > 21
                ? `Bust! (${dealerVal})`
                : dealerVal
              : handValue(dealerHand.filter((c) => !c.faceDown))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid rgba(212,168,67,0.2)", margin: "0 40px" }} />

      {/* Players Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          gap: 30,
          padding: "24px 20px",
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        {players.map((player, pi) => (
          <div
            key={pi}
            style={{
              flex: "0 1 420px",
              background: "rgba(0,0,0,0.15)",
              borderRadius: 16,
              padding: 24,
              border: `2px solid ${
                phase === "playing" && currentPlayer === pi && player.status === "playing"
                  ? "#d4a843"
                  : "rgba(255,255,255,0.1)"
              }`,
              boxShadow:
                phase === "playing" && currentPlayer === pi && player.status === "playing"
                  ? "0 0 20px rgba(212,168,67,0.2)"
                  : "none",
              transition: "border-color 0.3s, box-shadow 0.3s",
            }}
          >
            {/* Player Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3 style={{ fontSize: "1.15rem", color: "#d4a843" }}>{player.name}</h3>
              <span
                style={{
                  background: "rgba(0,0,0,0.4)",
                  padding: "4px 12px",
                  borderRadius: 20,
                  fontSize: "0.85rem",
                }}
              >
                💰 ${player.chips}
              </span>
            </div>

            {/* Betting Phase */}
            {phase === "betting" && player.status === "betting" && (
              <div style={{ textAlign: "center" }}>
                <p style={{ marginBottom: 12, fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>
                  Current bet: <strong style={{ color: "#d4a843" }}>${player.bet}</strong>
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" }}>
                  {CHIP_VALUES.map((val) => (
                    <Chip
                      key={val}
                      value={val}
                      onClick={() => placeBet(pi, val)}
                      disabled={val > player.chips}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <button
                    onClick={() => clearBet(pi)}
                    style={{
                      padding: "8px 20px",
                      background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "white",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontFamily: "Georgia, serif",
                    }}
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => confirmBet(pi)}
                    disabled={player.bet === 0}
                    style={{
                      padding: "8px 24px",
                      background: player.bet > 0 ? "#d4a843" : "rgba(212,168,67,0.3)",
                      color: player.bet > 0 ? "#1a1a1a" : "rgba(255,255,255,0.4)",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: "bold",
                      cursor: player.bet > 0 ? "pointer" : "not-allowed",
                      fontSize: "0.85rem",
                      fontFamily: "Georgia, serif",
                      textTransform: "uppercase",
                    }}
                  >
                    Confirm Bet
                  </button>
                </div>
              </div>
            )}

            {/* Waiting for other player */}
            {phase === "betting" && player.status === "done" && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
                <p>Bet: <strong style={{ color: "#d4a843" }}>${player.bet}</strong></p>
                <p style={{ fontSize: "0.85rem", marginTop: 4 }}>Waiting for other player...</p>
              </div>
            )}

            {/* Cards */}
            {player.hand.length > 0 && (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    minHeight: 112,
                    alignItems: "center",
                    marginTop: phase === "betting" ? 0 : 8,
                    flexWrap: "wrap",
                  }}
                >
                  {player.hand.map((card, i) => (
                    <CardDisplay key={i} card={card} index={i} />
                  ))}
                </div>

                {/* Score */}
                <div style={{ textAlign: "center", marginTop: 10 }}>
                  <span
                    style={{
                      display: "inline-block",
                      background:
                        player.status === "bust"
                          ? "rgba(192,57,43,0.7)"
                          : player.status === "blackjack"
                          ? "rgba(212,168,67,0.7)"
                          : "rgba(0,0,0,0.5)",
                      color: player.status === "blackjack" ? "#1a1a1a" : "white",
                      padding: "4px 14px",
                      borderRadius: 20,
                      fontSize: "0.9rem",
                    }}
                  >
                    {player.status === "bust"
                      ? `Bust! (${handValue(player.hand)})`
                      : player.status === "blackjack"
                      ? "BLACKJACK!"
                      : handValue(player.hand)}
                  </span>
                  {player.bet > 0 && phase !== "betting" && (
                    <span
                      style={{
                        display: "inline-block",
                        marginLeft: 8,
                        background: "rgba(0,0,0,0.3)",
                        padding: "4px 12px",
                        borderRadius: 20,
                        fontSize: "0.8rem",
                        color: "rgba(255,255,255,0.6)",
                      }}
                    >
                      Bet: ${player.bet}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Actions */}
            {phase === "playing" && currentPlayer === pi && player.status === "playing" && (
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
                <button
                  onClick={hit}
                  style={{
                    padding: "12px 32px",
                    background: "#27ae60",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: "1rem",
                    fontWeight: "bold",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    fontFamily: "Georgia, serif",
                  }}
                >
                  Hit
                </button>
                <button
                  onClick={stand}
                  style={{
                    padding: "12px 32px",
                    background: "#c0392b",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: "1rem",
                    fontWeight: "bold",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    fontFamily: "Georgia, serif",
                  }}
                >
                  Stand
                </button>
              </div>
            )}

            {/* Result */}
            {phase === "results" && player.result && (
              <div
                style={{
                  textAlign: "center",
                  marginTop: 16,
                  padding: "12px",
                  borderRadius: 8,
                  background:
                    player.result === "win" || player.result === "blackjack"
                      ? "rgba(39,174,96,0.2)"
                      : player.result === "push"
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(192,57,43,0.2)",
                  border: `1px solid ${
                    player.result === "win" || player.result === "blackjack"
                      ? "rgba(39,174,96,0.4)"
                      : player.result === "push"
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(192,57,43,0.4)"
                  }`,
                }}
              >
                <p
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: "bold",
                    color:
                      player.result === "win"
                        ? "#27ae60"
                        : player.result === "blackjack"
                        ? "#d4a843"
                        : player.result === "push"
                        ? "rgba(255,255,255,0.7)"
                        : "#e74c3c",
                  }}
                >
                  {player.result === "blackjack"
                    ? "BLACKJACK! +$" + Math.floor(player.bet * 1.5)
                    : player.result === "win"
                    ? "WIN! +$" + player.bet
                    : player.result === "push"
                    ? "PUSH — Bet returned"
                    : "LOSE — -$" + player.bet}
                </p>
              </div>
            )}
          </div>
        ))}
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
                onClick={backToLobby}
                style={{
                  padding: "14px 40px",
                  background: "#d4a843",
                  color: "#1a1a1a",
                  border: "none",
                  borderRadius: 8,
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontFamily: "Georgia, serif",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                New Game
              </button>
            </div>
          ) : (
            <button
              onClick={newRound}
              style={{
                padding: "14px 40px",
                background: "#d4a843",
                color: "#1a1a1a",
                border: "none",
                borderRadius: 8,
                fontSize: "1.1rem",
                fontWeight: "bold",
                cursor: "pointer",
                fontFamily: "Georgia, serif",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
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
