import {
  Card, Suit, Rank, GameState, GameAction, ClientGameState,
  PlayerState, HandState, SUITS, RANKS, STARTING_CHIPS,
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

/** Check if two cards can be split (same rank, or both are 10-value) */
function canSplit(hand: Card[]): boolean {
  if (hand.length !== 2) return false;
  const r1 = hand[0].rank;
  const r2 = hand[1].rank;
  // Same rank
  if (r1 === r2) return true;
  // Both 10-value (10, J, Q, K)
  const tenValues = ["10", "J", "Q", "K"];
  if (tenValues.includes(r1) && tenValues.includes(r2)) return true;
  return false;
}

/** Card numeric value for split check (10-value cards all return 10) */
function cardNumericValue(rank: string): number {
  if (rank === "A") return 11;
  if (["K", "Q", "J"].includes(rank)) return 10;
  return parseInt(rank);
}

function drawCard(shoe: Card[], faceDown = false): Card {
  if (shoe.length === 0) {
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

function createEmptyPlayer(name: string): PlayerState {
  return {
    name,
    hands: [],
    currentHandIndex: 0,
    chips: STARTING_CHIPS,
    insuranceBet: 0,
    status: "waiting",
    bet: 0,
  };
}

export function createGameState(code: string, playerName: string): GameState {
  const shoe = createShoe();
  return {
    code,
    phase: "waiting",
    players: [createEmptyPlayer(playerName)],
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
  const maskCard = (c: Card) =>
    c.faceDown ? { suit: "♠" as Suit, rank: "A" as Rank, faceDown: true } : c;

  return {
    code: state.code,
    phase: state.phase,
    players: state.players.map((p) => ({
      ...p,
      hands: p.hands.map((h) => ({
        ...h,
        cards: h.cards.map(maskCard),
      })),
    })),
    dealerHand: state.dealerHand.map(maskCard),
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

  // Check if all player hands busted or surrendered
  const allBustOrSurrender = state.players.every((p) =>
    p.hands.every((h) => h.status === "bust" || h.status === "surrendered")
  );
  if (allBustOrSurrender) return;

  // Dealer draws to 17+ (hits on soft 17)
  while (handValue(state.dealerHand) < 17) {
    state.dealerHand.push(drawCard(state.shoe));
  }
}

function resolveRound(state: GameState): void {
  const dealerVal = handValue(state.dealerHand);
  const dealerBust = dealerVal > 21;
  const dealerBJ = isBlackjack(state.dealerHand);

  state.players = state.players.map((p) => {
    // Resolve insurance
    let insuranceResult: PlayerState["insuranceResult"];
    if (p.insuranceBet > 0) {
      if (dealerBJ) {
        insuranceResult = "win";
        p.chips += p.insuranceBet * 3; // pays 2:1 + original back
      } else {
        insuranceResult = "lose";
        // insurance bet already deducted
      }
    }

    // Resolve each hand
    const resolvedHands = p.hands.map((h) => {
      const pVal = handValue(h.cards);
      const pBJ = isBlackjack(h.cards) && p.hands.length === 1; // no BJ on split hands
      let result: HandState["result"];
      let payout = 0;

      if (h.status === "surrendered") {
        result = "surrender";
        // half bet already returned when surrendering
      } else if (h.status === "bust") {
        result = "lose";
      } else if (pBJ && dealerBJ) {
        result = "push";
        payout = h.bet;
      } else if (pBJ) {
        result = "blackjack";
        payout = h.bet + Math.floor(h.bet * 1.5);
      } else if (dealerBust) {
        result = "win";
        payout = h.bet * 2;
      } else if (pVal > dealerVal) {
        result = "win";
        payout = h.bet * 2;
      } else if (pVal === dealerVal) {
        result = "push";
        payout = h.bet;
      } else {
        result = "lose";
      }

      return { ...h, result, status: h.status as HandState["status"] } as HandState & { _payout: number };
    });

    // Calculate total payout
    let totalPayout = 0;
    const finalHands = resolvedHands.map((h) => {
      const pVal = handValue(h.cards);
      const pBJ = isBlackjack(h.cards) && p.hands.length === 1;
      let payout = 0;

      if (h.result === "surrender") {
        payout = 0; // already handled
      } else if (h.result === "lose") {
        payout = 0;
      } else if (h.result === "push") {
        payout = h.bet;
      } else if (h.result === "blackjack") {
        payout = h.bet + Math.floor(h.bet * 1.5);
      } else if (h.result === "win") {
        payout = h.bet * 2;
      }

      totalPayout += payout;
      return { cards: h.cards, bet: h.bet, status: h.status, result: h.result } as HandState;
    });

    return {
      ...p,
      hands: finalHands,
      chips: p.chips + totalPayout,
      insuranceResult,
      status: "done" as const,
    };
  });

  state.phase = "results";
  state.message = "Round complete!";
}

// ─── Advance Hand / Player / Trigger Dealer ───────────────────────────────

function isHandDone(h: HandState): boolean {
  return h.status === "bust" || h.status === "standing" || h.status === "blackjack" || h.status === "doubled" || h.status === "surrendered";
}

function advanceAfterHandDone(state: GameState): void {
  const p = state.players[state.currentPlayer];

  // Check if there's another hand for this player (split)
  const nextHand = p.currentHandIndex + 1;
  if (nextHand < p.hands.length) {
    p.currentHandIndex = nextHand;
    const hand = p.hands[nextHand];

    // Deal a second card to the split hand if it only has one
    if (hand.cards.length === 1) {
      reshuffleIfNeeded(state);
      hand.cards.push(drawCard(state.shoe));
    }

    // Check for auto-21
    if (handValue(hand.cards) === 21) {
      hand.status = "standing";
      state.message = `${p.name}'s Hand ${nextHand + 1} has 21!`;
      advanceAfterHandDone(state);
    } else {
      state.message = `${p.name}'s Hand ${nextHand + 1}`;
    }
    return;
  }

  // All hands for this player are done, advance to next player
  p.status = "done";
  advanceToNextPlayer(state);
}

function advanceToNextPlayer(state: GameState): void {
  const next = state.currentPlayer + 1;
  if (next < state.players.length) {
    const nextPlayer = state.players[next];
    state.currentPlayer = next;

    // Check if all hands are already done (blackjack, etc.)
    const allHandsDone = nextPlayer.hands.every(isHandDone);
    if (allHandsDone) {
      nextPlayer.status = "done";
      advanceToNextPlayer(state);
    } else {
      nextPlayer.status = "playing";
      nextPlayer.currentHandIndex = 0;

      // Find first playable hand
      while (nextPlayer.currentHandIndex < nextPlayer.hands.length && isHandDone(nextPlayer.hands[nextPlayer.currentHandIndex])) {
        nextPlayer.currentHandIndex++;
      }

      if (nextPlayer.currentHandIndex >= nextPlayer.hands.length) {
        nextPlayer.status = "done";
        advanceToNextPlayer(state);
      } else {
        const handLabel = nextPlayer.hands.length > 1 ? ` Hand ${nextPlayer.currentHandIndex + 1}` : "";
        state.message = `${nextPlayer.name}'s${handLabel} turn`;
      }
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
  const s: GameState = JSON.parse(JSON.stringify(state));
  s.version++;

  switch (action.type) {
    // ── Join ──────────────────────────────────────────────────────────────
    case "join": {
      if (s.phase !== "waiting") {
        return { state: s, error: "Game already started" };
      }
      if (s.players.length >= 6) {
        return { state: s, error: "Room is full (max 6 players)" };
      }
      const newPlayer = createEmptyPlayer(action.playerName);
      newPlayer.status = "waiting";
      s.players.push(newPlayer);
      s.message = `${s.players.length}/6 players — Waiting for host to start...`;
      return { state: s };
    }

    // ── Start Game (host only) ──────────────────────────────────────────
    case "start_game": {
      if (s.phase !== "waiting") return { state: s, error: "Game already started" };
      if (s.players.length < 2) return { state: s, error: "Need at least 2 players" };
      for (const player of s.players) {
        player.status = "betting";
      }
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
        reshuffleIfNeeded(s);

        // Deal initial hands
        for (const player of s.players) {
          const cards = [drawCard(s.shoe), drawCard(s.shoe)];
          player.hands = [{
            cards,
            bet: player.bet,
            status: isBlackjack(cards) ? "blackjack" : "playing",
          }];
          player.currentHandIndex = 0;
          player.insuranceBet = 0;
          player.insuranceResult = undefined;
        }

        const dHand = [drawCard(s.shoe), drawCard(s.shoe, true)];
        s.dealerHand = dHand;

        // Check if dealer's up card is an Ace → insurance phase
        const dealerUpCard = dHand[0];
        if (dealerUpCard.rank === "A") {
          s.phase = "insurance";
          s.message = "Dealer shows Ace — Insurance?";
          // Mark players as needing to decide
          for (const player of s.players) {
            player.status = "betting"; // reuse for insurance decision
          }
          return { state: s };
        }

        // No insurance needed, go to playing
        s.phase = "playing";
        s.currentPlayer = 0;

        // Skip players with blackjack
        const p0 = s.players[0];
        if (p0.hands[0].status === "blackjack") {
          p0.status = "done";
          s.message = `${p0.name} has Blackjack!`;
          advanceToNextPlayer(s);
        } else {
          p0.status = "playing";
          s.message = `${p0.name}'s turn`;
        }
      } else {
        s.message = `${p.name} is ready. Waiting for other player...`;
      }
      return { state: s };
    }

    // ── Insurance ─────────────────────────────────────────────────────────
    case "insurance": {
      if (s.phase !== "insurance") return { state: s, error: "Not insurance phase" };
      const p = s.players[action.playerIndex];
      if (!p || p.status !== "betting") return { state: s, error: "Already decided" };

      if (action.accept) {
        const insuranceCost = Math.floor(p.hands[0].bet / 2);
        if (insuranceCost > p.chips) {
          return { state: s, error: "Not enough chips for insurance" };
        }
        p.insuranceBet = insuranceCost;
        p.chips -= insuranceCost;
      }
      p.status = "done";

      // Check if all players have decided
      const allDecided = s.players.every((pl) => pl.status === "done");
      if (allDecided) {
        // Check if dealer has blackjack
        const dealerBJ = isBlackjack(s.dealerHand.map(c => ({ ...c, faceDown: false })));

        if (dealerBJ) {
          // Reveal dealer cards and resolve
          s.dealerHand = s.dealerHand.map(c => ({ ...c, faceDown: false }));
          s.phase = "dealer-turn";
          s.message = "Dealer has Blackjack!";
          resolveRound(s);
        } else {
          // No dealer blackjack, proceed to play
          s.phase = "playing";
          s.currentPlayer = 0;

          const p0 = s.players[0];
          if (p0.hands[0].status === "blackjack") {
            p0.status = "done";
            s.message = `${p0.name} has Blackjack!`;
            advanceToNextPlayer(s);
          } else {
            p0.status = "playing";
            s.message = `${p0.name}'s turn`;
          }
        }
      } else {
        s.message = "Waiting for insurance decisions...";
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

      const hand = p.hands[p.currentHandIndex];
      if (!hand || isHandDone(hand)) return { state: s, error: "Hand is done" };

      reshuffleIfNeeded(s);
      hand.cards.push(drawCard(s.shoe));
      const val = handValue(hand.cards);

      if (val > 21) {
        hand.status = "bust";
        const handLabel = p.hands.length > 1 ? ` Hand ${p.currentHandIndex + 1}` : "";
        s.message = `${p.name}${handLabel} busts! (${val})`;
        advanceAfterHandDone(s);
      } else if (val === 21) {
        hand.status = "standing";
        const handLabel = p.hands.length > 1 ? ` Hand ${p.currentHandIndex + 1}` : "";
        s.message = `${p.name}${handLabel} has 21!`;
        advanceAfterHandDone(s);
      }
      return { state: s };
    }

    case "stand": {
      if (s.phase !== "playing") return { state: s, error: "Not playing phase" };
      const pi = action.playerIndex;
      if (pi !== s.currentPlayer) return { state: s, error: "Not your turn" };
      const p = s.players[pi];
      if (p.status !== "playing") return { state: s, error: "Cannot stand" };

      const hand = p.hands[p.currentHandIndex];
      if (!hand || isHandDone(hand)) return { state: s, error: "Hand is done" };

      hand.status = "standing";
      const handLabel = p.hands.length > 1 ? ` Hand ${p.currentHandIndex + 1}` : "";
      s.message = `${p.name}${handLabel} stands.`;
      advanceAfterHandDone(s);
      return { state: s };
    }

    // ── Double Down ──────────────────────────────────────────────────────
    case "double_down": {
      if (s.phase !== "playing") return { state: s, error: "Not playing phase" };
      const pi = action.playerIndex;
      if (pi !== s.currentPlayer) return { state: s, error: "Not your turn" };
      const p = s.players[pi];
      if (p.status !== "playing") return { state: s, error: "Cannot double down" };

      const hand = p.hands[p.currentHandIndex];
      if (!hand || hand.cards.length !== 2) {
        return { state: s, error: "Can only double down on first two cards" };
      }
      if (hand.bet > p.chips) {
        return { state: s, error: "Not enough chips to double down" };
      }

      // Double the bet
      p.chips -= hand.bet;
      hand.bet *= 2;

      // Draw exactly one card
      reshuffleIfNeeded(s);
      hand.cards.push(drawCard(s.shoe));
      const val = handValue(hand.cards);

      if (val > 21) {
        hand.status = "bust";
        const handLabel = p.hands.length > 1 ? ` Hand ${p.currentHandIndex + 1}` : "";
        s.message = `${p.name}${handLabel} doubles down and busts! (${val})`;
      } else {
        hand.status = "doubled";
        const handLabel = p.hands.length > 1 ? ` Hand ${p.currentHandIndex + 1}` : "";
        s.message = `${p.name}${handLabel} doubles down. (${val})`;
      }

      advanceAfterHandDone(s);
      return { state: s };
    }

    // ── Split ────────────────────────────────────────────────────────────
    case "split": {
      if (s.phase !== "playing") return { state: s, error: "Not playing phase" };
      const pi = action.playerIndex;
      if (pi !== s.currentPlayer) return { state: s, error: "Not your turn" };
      const p = s.players[pi];
      if (p.status !== "playing") return { state: s, error: "Cannot split" };

      const hand = p.hands[p.currentHandIndex];
      if (!hand || !canSplit(hand.cards)) {
        return { state: s, error: "Cannot split this hand" };
      }
      if (p.hands.length >= 2) {
        return { state: s, error: "Can only split once" };
      }
      if (hand.bet > p.chips) {
        return { state: s, error: "Not enough chips to split" };
      }

      // Create two hands from the split
      const card1 = hand.cards[0];
      const card2 = hand.cards[1];

      // Deduct chips for the second hand
      p.chips -= hand.bet;

      // First hand: first card + new card
      reshuffleIfNeeded(s);
      const newCard1 = drawCard(s.shoe);
      p.hands[p.currentHandIndex] = {
        cards: [card1, newCard1],
        bet: hand.bet,
        status: "playing",
      };

      // Second hand: second card (will get dealt a card when it becomes active)
      p.hands.push({
        cards: [card2],
        bet: hand.bet,
        status: "playing",
      });

      const firstHand = p.hands[p.currentHandIndex];
      // Check if first split hand hits 21
      if (handValue(firstHand.cards) === 21) {
        firstHand.status = "standing";
        s.message = `${p.name}'s Hand 1 has 21!`;
        advanceAfterHandDone(s);
      } else {
        s.message = `${p.name}'s Hand 1`;
      }

      return { state: s };
    }

    // ── Surrender ────────────────────────────────────────────────────────
    case "surrender": {
      if (s.phase !== "playing") return { state: s, error: "Not playing phase" };
      const pi = action.playerIndex;
      if (pi !== s.currentPlayer) return { state: s, error: "Not your turn" };
      const p = s.players[pi];
      if (p.status !== "playing") return { state: s, error: "Cannot surrender" };

      const hand = p.hands[p.currentHandIndex];
      if (!hand || hand.cards.length !== 2) {
        return { state: s, error: "Can only surrender on first two cards" };
      }
      if (p.hands.length > 1) {
        return { state: s, error: "Cannot surrender a split hand" };
      }

      // Return half the bet
      const halfBet = Math.floor(hand.bet / 2);
      p.chips += halfBet;
      hand.bet = hand.bet - halfBet; // remaining lost bet
      hand.status = "surrendered";

      s.message = `${p.name} surrenders.`;
      advanceAfterHandDone(s);
      return { state: s };
    }

    // ── New Round ─────────────────────────────────────────────────────────
    case "new_round": {
      if (s.phase !== "results") return { state: s, error: "Not results phase" };
      reshuffleIfNeeded(s);
      s.players = s.players.map((p) => ({
        ...p,
        hands: [],
        currentHandIndex: 0,
        bet: 0,
        insuranceBet: 0,
        insuranceResult: undefined,
        status: "betting" as const,
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
        hands: [],
        currentHandIndex: 0,
        bet: 0,
        chips: STARTING_CHIPS,
        insuranceBet: 0,
        insuranceResult: undefined,
        status: "betting" as const,
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
