import { Redis } from "@upstash/redis";
import { GameState } from "./types";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ROOM_TTL = 3600; // 1 hour

export async function getGameState(code: string): Promise<GameState | null> {
  const data = await redis.get<GameState>(`game:${code}`);
  return data;
}

export async function setGameState(
  code: string,
  state: GameState
): Promise<void> {
  await redis.set(`game:${code}`, state, { ex: ROOM_TTL });
}

export async function deleteGameState(code: string): Promise<void> {
  await redis.del(`game:${code}`);
}
