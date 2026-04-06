import {
  Card, Suit, Rank, GameState, GameAction, ClientGameState,
  PlayerState, SUITS, RANKS, STARTING_CHIPS,
} from "./types";

// ─── Helpers ────────────────────────────────────────────────────────────────

export function createShoe(): Card[] {
  const numDecks = Math.floor(Math.random() * 5) + 4; // 4-8 decks
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

export function cardValue(card: Card): number[] {
  if (card.rank === "A") return [1, 11];
  if (["K", "Q", "J"].includes(card.rank)) return [10];
  return [parseInt(card.rank)];
}

export function handValue(hand: Card[]): number {
  const visible = hand.filter((c) => !c.faceDown);
  let total = 0;
  let aces = 0;
  for (const card of visible) {
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

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand) === 21;
}

function drawCard(shoe: Card[], faceDown = false): Card {
  if (shoe.length === 0) {
    // Emergency reshuffle (shouldn't happen normally)
    const newShoe = createShoe();
    shoe.push(...newShoe);
  }
  return { ...shoe.pop()!, faceDown };
}

function reshuffleIfNeeded(state: GameState): void {
  if (state.shoe.length < 20) {
    const newShoe = createShoe();
    state.shoe = newShoe;
    state.deckCount = Math.floor(newShoe.length / 52);
  }
}

// ─── State Creation ─────────────────────────────────────────────────────────

export function createGameState(code: string, playerName: string): GameState {
  const shoe = createShoe();
  return {
    code,
    phase: "waiting",
    players: [
      {
        name: playerName,
        hand: [],
        bet: 0,
        chips: STARTING_CHIPS,
        status: "waiting",
      },
    ],
    dealerHand: [],
    shoe,
    currentPlayer: 0,
    message: "Waiting for Player 2...",
    roundNumber: 0,
    deckCount: Math.floor(shoe.length / 52),
    version: 1,
  };
}

// ─── Sanitize for Client ────────────────────────────────────────────────────

export function sanitizeState(state: GameState): ClientGameState {
  return {
    code: state.code,
    phase: state.phase,
    players: state.players.map((p) => ({
      ...p,
      hand: p.hand.map((c) =>
        c.faceDown ? { suit: "♠" as Suit, rank: "A" as Rank, faceDown: true } : c
      ),
    })),
    dealerHand: state.dealerHand.map((c) =>
      c.faceDown ? { suit: "♠" as Suit, rank: "A" as Rank, faceDown: true } : c
    ),
    currentPlayer: state.currentPlayer,
    message: state.message,
    roundNumber: state.roundNumber,
    deckCount: state.deckCount,
    cardsRemaining: state.shoe.length,
    version: state.version,
  };
}

// ─── Dealer Turn ────────────────────────────────────────────────────────────

function playDealerTurn(state: GameState): void {
  // Flip face-down card
  state.dealerHand = state.dealerHand.map((c) => ({ ...c, faceDown: false }));

  // Check if all players busted
  const allBust = state.players.every((p) => p.status === "bust");
  if (allBust) return;

  // Dealer draws to 17+
  while (handValue(state.dealerHand) < 17) {
    state.dealerHand.push(drawCard(state.shoe));
  }
}

function resolveRound(state: GameState): void {
  const dealerVal = handValue(state.dealerHand);
  const dealerBust = dealerVal > 21;
  const dealerBJ = isBlackjack(state.dealerHand);

  state.players = state.players.map((p) => {
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

    return { ...p, result, chips: p.chips + payout, status: "done" as const };
  });

  state.phase = "results";
  state.message = "Round complete!";
}

// ─── Advance Player / Trigger Dealer ────────────────────────────────────────

function advanceAfterPlayerDone(state: GameState): void {
  const next = state.currentPlayer + 1;
  if (next < state.players.length) {
    const nextPlayer = state.players[next];
    if (
      nextPlayer.status === "blackjack" ||
      nextPlayer.status === "bust" ||
      nextPlayer.status === "standing"
    ) {
      state.currentPlayer = next;
      // Recursively check if this player is also done
      advanceAfterPlayerDone(state);
    } else {
      state.currentPlayer = next;
      state.message = `${nextPlayer.name}'s turn`;
    }
  } else {
    // All players done → dealer turn
    state.phase = "dealer-turn";
    state.message = "Dealer's turn...";
    playDealerTurn(state);
    resolveRound(state);
  }
}

// ─── Process Action ─────────────────────────────────────────────────────────

export function processAction(
  state: GameState,
  action: GameAction
): { state: GameState; error?: string } {
  // Deep clone so we don't mutate the original
  const s: GameState = JSON.parse(JSON.stringify(state));
  s.version++;

  switch (action.type) {
    // ── Join ──────────────────────────────────────────────────────────────
    case "join": {
      if (s.phase !== "waiting") {
        return { state: s, error: "Game already started" };
      }
      if (s.players.length >= 2) {
        return { state: s, error: "Room is full" };
      }
      s.players.push({
        name: action.playerName,
        hand: [],
        bet: 0,
        chips: STARTING_CHIPS,
        status: "betting",
      });
      s.players[0].status = "betting";
      s.phase = "betting";
      s.message = "Place your bets!";
      s.roundNumber = 1;
      return { state: s };
    }

    // ── Betting ───────────────────────────────────────────────────────────
    case "place_bet": {
      if (s.phase !== "betting") return { state: s, error: "Not betting phase" };
      const p = s.players[action.playerIndex];
      if (!p || p.status !== "betting") return { state: s, error: "Cannot bet" };
      if (action.amount > p.chips) return { state: s, error: "Not enough chips" };
      p.bet += action.amount;
      p.chips -= action.amount;
      return { state: s };
    }

    case "clear_bet": {
      if (s.phase !== "betting") return { state: s, error: "Not betting phase" };
      const p = s.players[action.playerIndex];
      if (!p || p.status !== "betting") return { state: s, error: "Cannot clear" };
      p.chips += p.bet;
      p.bet = 0;
      return { state: s };
    }

    case "confirm_bet": {
      if (s.phase !== "betting") return { state: s, error: "Not betting phase" };
      const p = s.players[action.playerIndex];
      if (!p || p.bet === 0) return { state: s, error: "No bet placed" };
      p.status = "done";

      // Check if all players have confirmed bets
      const allDone = s.players.every((pl) => pl.status === "done" && pl.bet > 0);
      if (allDone) {
        // Deal initial cards
        reshuffleIfNeeded(s);
        const p1Hand = [drawCard(s.shoe), drawCard(s.shoe)];
        const p2Hand = [drawCard(s.shoe), drawCard(s.shoe)];
        const dHand = [drawCard(s.shoe), drawCard(s.shoe, true)];

        s.players[0].hand = p1Hand;
        s.players[0].status = isBlackjack(p1Hand) ? "blackjack" : "playing";
        s.players[1].hand = p2Hand;
        s.players[1].status = isBlackjack(p2Hand) ? "blackjack" : "playing";
        s.dealerHand = dHand;
        s.phase = "playing";
        s.currentPlayer = 0;

        // Skip players with blackjack
        if (s.players[0].status === "blackjack") {
          s.message = `${s.players[0].name} has Blackjack!`;
          advanceAfterPlayerDone(s);
        } else {
          s.message = `${s.players[0].name}'s turn`;
        }
      } else {
        s.message = `${p.name} is ready. Waiting for other player...`;
      }
      return { state: s };
    }

    // ── Playing ───────────────────────────────────────────────────────────
    case "hit": {
      if (s.phase !== "playing") return { state: s, error: "Not playing phase" };
      const pi = action.playerIndex;
      if (pi !== s.currentPlayer) return { state: s, error: "Not your turn" };
      const p = s.players[pi];
      if (p.status !== "playing") return { state: s, error: "Cannot hit" };

      reshuffleIfNeeded(s);
      p.hand.push(drawCard(s.shoe));
      const val = handValue(p.hand);

      if (val > 21) {
        p.status = "bust";
        s.message = `${p.name} busts! (${val})`;
        advanceAfterPlayerDone(s);
      } else if (val === 21) {
        p.status = "standing";
        s.message = `${p.name} has 21!`;
        advanceAfterPlayerDone(s);
      }
      return { state: s };
    }

    case "stand": {
      if (s.phase !== "playing") return { state: s, error: "Not playing phase" };
      const pi = action.playerIndex;
      if (pi !== s.currentPlayer) return { state: s, error: "Not your turn" };
      const p = s.players[pi];
      if (p.status !== "playing") return { state: s, error: "Cannot stand" };

      p.status = "standing";
      s.message = `${p.name} stands.`;
      advanceAfterPlayerDone(s);
      return { state: s };
    }

    // ── New Round ─────────────────────────────────────────────────────────
    case "new_round": {
      if (s.phase !== "results") return { state: s, error: "Not results phase" };
      reshuffleIfNeeded(s);
      s.players = s.players.map((p) => ({
        ...p,
        hand: [],
        bet: 0,
        status: "betting" as const,
        result: undefined,
      }));
      s.dealerHand = [];
      s.phase = "betting";
      s.message = "Place your bets!";
      s.roundNumber++;
      return { state: s };
    }

    // ── Back to Lobby ─────────────────────────────────────────────────────
    case "back_to_lobby": {
      s.players = s.players.map((p) => ({
        ...p,
        hand: [],
        bet: 0,
        chips: STARTING_CHIPS,
        status: "betting" as const,
        result: undefined,
      }));
      s.dealerHand = [];
      s.shoe = createShoe();
      s.deckCount = Math.floor(s.shoe.length / 52);
      s.phase = "betting";
      s.message = "Place your bets!";
      s.roundNumber = 1;
      return { state: s };
    }

    default:
      return { state: s, error: "Unknown action" };
  }
}
