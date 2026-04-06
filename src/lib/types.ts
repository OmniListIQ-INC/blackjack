// ─── Card Types ─────────────────────────────────────────────────────────────

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  suit: Suit;
  rank: Rank;
  faceDown?: boolean;
}

// ─── Hand (supports split) ────────────────────────────────────────────────

export interface HandState {
  cards: Card[];
  bet: number;
  status: "playing" | "standing" | "bust" | "blackjack" | "doubled" | "surrendered";
  result?: "win" | "lose" | "push" | "blackjack" | "surrender";
}

// ─── Player ─────────────────────────────────────────────────────────────────

export interface PlayerState {
  name: string;
  hands: HandState[];        // supports split — usually 1 hand, 2 after split
  currentHandIndex: number;  // which hand the player is currently playing
  chips: number;
  insuranceBet: number;      // 0 if no insurance
  insuranceResult?: "win" | "lose";
  status:
    | "waiting"
    | "betting"
    | "playing"
    | "done";
  // Legacy fields for betting phase (before cards are dealt)
  bet: number;
}

// ─── Game ───────────────────────────────────────────────────────────────────

export type GamePhase =
  | "waiting"      // waiting for player 2
  | "betting"
  | "insurance"    // dealer shows Ace, players can buy insurance
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
  version: number;
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
  | { type: "start_game" }
  | { type: "place_bet"; playerIndex: number; amount: number }
  | { type: "clear_bet"; playerIndex: number }
  | { type: "confirm_bet"; playerIndex: number }
  | { type: "hit"; playerIndex: number }
  | { type: "stand"; playerIndex: number }
  | { type: "double_down"; playerIndex: number }
  | { type: "split"; playerIndex: number }
  | { type: "insurance"; playerIndex: number; accept: boolean }
  | { type: "surrender"; playerIndex: number }
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
