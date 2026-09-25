"use client";

import { getToken } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { api, type Room } from "@/lib/api";

type Presence = { room: string; count: number; people: { id: string; name: string }[] };

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [joined, setJoined] = useState<string | null>(null);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const socket = useRef<WebSocket | null>(null);

  const load = () => api.focusRooms().then(setRooms).catch(() => {});
  useEffect(() => {
    load();
    const poll = setInterval(load, 20_000); // for rooms you are not in
    return () => {
      clearInterval(poll);
      socket.current?.close();
    };
  }, []);

  async function join(room: string) {
    socket.current?.close();
    const token = await getToken().catch(() => null);
    // Straight to the API: the /api/v1 proxy handles HTTP only, and WebSockets can't go through it.
    const url = new URL(`/ws/focus-room/${room}`, process.env.NEXT_PUBLIC_API_WS_URL ?? "ws://localhost:8000");
    url.searchParams.set("token", token ?? "");

    const ws = new WebSocket(url);
    socket.current = ws;
    ws.onmessage = (event) => setPresence(JSON.parse(event.data));
    ws.onopen = () => { setJoined(room); setNote(null); };
    ws.onerror = () => setNote("Couldn’t reach the room. Is the API running?");
    ws.onclose = () => { setJoined(null); setPresence(null); load(); };
  }

  function leave() {
    socket.current?.close();
  }

  if (joined) {
    const others = (presence?.people ?? []).length - 1;
    return (
      <main className="mx-auto flex max-w-lg flex-col items-center gap-4 p-6 text-center">
        <p className="text-sm text-muted">{rooms.find((r) => r.id === joined)?.theme}</p>
        <h1 className="text-2xl font-bold">
          {others > 0 ? `Working alongside ${others} other${others > 1 ? "s" : ""}` : "You’re first in here"}
        </h1>
        <p className="text-sm text-muted">
          Silent by design: no camera, no microphone, no chat. Just other people working at the same time.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {(presence?.people ?? []).map((person) => (
            <span key={person.id} className="rounded-full bg-soft px-4 py-2 text-sm">{person.name}</span>
          ))}
        </div>
        <button onClick={leave} className="min-h-12 w-full rounded-xl bg-soft font-medium">Leave the room</button>
        <Link href="/" className="text-sm text-muted underline">Back to your tasks</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 md:p-8">
      <Link href="/" className="text-sm text-muted underline">← Back</Link>
      <h1 className="text-2xl font-bold">Focus rooms</h1>
      <p className="text-sm text-muted">
        Body doubling: work while others work. Presence only — nobody can see or hear you.
      </p>
      {note && <p className="text-sm text-muted">{note}</p>}
      {rooms.map((room) => (
        <div key={room.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
          <div>
            <h2 className="font-semibold">{room.theme}</h2>
            <p className="text-sm text-muted">
              {room.count === 0 ? "Nobody here right now" : `${room.count} here now`}
            </p>
          </div>
          <button onClick={() => join(room.id)} className="min-h-11 rounded-xl bg-accent px-5 font-semibold text-accent-text">
            Join
          </button>
        </div>
      ))}
    </main>
  );
}
