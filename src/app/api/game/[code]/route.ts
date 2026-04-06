import { NextRequest, NextResponse } from "next/server";
import { processAction, sanitizeState } from "@/lib/game";
import { getGameState, setGameState } from "@/lib/redis";
import { broadcastState } from "@/lib/pusher-server";
import { GameAction } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const state = await getGameState(code.toUpperCase());

    if (!state) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json({ state: sanitizeState(state) });
  } catch (error) {
    console.error("Get state error:", error);
    return NextResponse.json(
      { error: "Failed to get game state" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const roomCode = code.toUpperCase();
    const action: GameAction = await request.json();

    const state = await getGameState(roomCode);
    if (!state) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const result = processAction(state, action);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await setGameState(roomCode, result.state);

    const clientState = sanitizeState(result.state);
    await broadcastState(roomCode, clientState);

    // For join actions, return the new player's index
    const response: Record<string, unknown> = { state: clientState };
    if (action.type === "join") {
      response.playerIndex = result.state.players.length - 1;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Action error:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}
