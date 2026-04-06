// ─── Card Types ─────────────────────────────────────────────────────────────

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  suit: Suit;
  rank: Rank;
  faceDown?: boolean;
}

// ─── Player ─────────────────────────────────────────────────────────────────

export interface PlayerState {
  name: string;
  hand: Card[];
  bet: number;
  chips: number;
  status:
    | "waiting"
    | "betting"
    | "playing"
    | "standing"
    | "bust"
    | "blackjack"
    | "done";
  result?: "win" | "lose" | "push" | "blackjack";
}

// ─── Game ───────────────────────────────────────────────────────────────────

export type GamePhase =
  | "waiting"   // waiting for player 2
  | "betting"
  | "dealing"
  | "playing"
  | "dealer-turn"
  | "results";

export interface GameState {
  code: string;
  phase: GamePhase;
  players: PlayerState[];
  dealerHand: Card[];
  shoe: Card[];
  currentPlayer: number;
  message: string;
  roundNumber: number;
  deckCount: number;
  version: number; // incremented on each state change
}

/** State sent to clients — shoe hidden, face-down cards stripped */
export interface ClientGameState {
  code: string;
  phase: GamePhase;
  players: PlayerState[];
  dealerHand: Card[];
  currentPlayer: number;
  message: string;
  roundNumber: number;
  deckCount: number;
  cardsRemaining: number;
  version: number;
}

// ─── Actions ────────────────────────────────────────────────────────────────

export type GameAction =
  | { type: "join"; playerName: string }
  | { type: "place_bet"; playerIndex: number; amount: number }
  | { type: "clear_bet"; playerIndex: number }
  | { type: "confirm_bet"; playerIndex: number }
  | { type: "hit"; playerIndex: number }
  | { type: "stand"; playerIndex: number }
  | { type: "new_round" }
  | { type: "back_to_lobby" };

// ─── Constants ──────────────────────────────────────────────────────────────

export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
export const RANKS: Rank[] = [
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
];
export const CHIP_VALUES = [5, 10, 25, 50, 100];
export const CHIP_COLORS: Record<number, string> = {
  5: "#e74c3c",
  10: "#3498db",
  25: "#27ae60",
  50: "#e67e22",
  100: "#2c3e50",
};
export const STARTING_CHIPS = 500;
