import Pusher from "pusher";
import { ClientGameState } from "./types";

let pusherInstance: Pusher | null = null;

function getPusher(): Pusher {
  if (!pusherInstance) {
    pusherInstance = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      useTLS: true,
    });
  }
  return pusherInstance;
}

export async function broadcastState(
  roomCode: string,
  state: ClientGameState
): Promise<void> {
  const pusher = getPusher();
  await pusher.trigger(`game-${roomCode}`, "state-update", state);
}
