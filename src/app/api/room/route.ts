import { NextRequest, NextResponse } from "next/server";
import { createGameState, sanitizeState } from "@/lib/game";
import { setGameState } from "@/lib/redis";
import { broadcastState } from "@/lib/pusher-server";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const { playerName } = await request.json();

    if (!playerName || typeof playerName !== "string" || !playerName.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const code = generateCode();
    const state = createGameState(code, playerName.trim());

    await setGameState(code, state);

    const clientState = sanitizeState(state);
    await broadcastState(code, clientState);

    return NextResponse.json({ code, state: clientState });
  } catch (error) {
    console.error("Create room error:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}
