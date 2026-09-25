import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { api, authToken, Room, roomSocketUrl } from '@/api';
import { space } from '@/theme';
import { Button, Card, Screen, T } from '@/ui';

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
    return () => socket.current?.close();
  }, []);

  async function join(room: string) {
    socket.current?.close();
    const ws = new WebSocket(roomSocketUrl(room, (await authToken()) ?? ''));
    socket.current = ws;
    ws.onmessage = (event) => setPresence(JSON.parse(event.data as string));
    ws.onopen = () => { setJoined(room); setNote(null); };
    ws.onerror = () => setNote('Couldn’t reach the room.');
    ws.onclose = () => { setJoined(null); setPresence(null); load(); };
  }

  if (joined) {
    const others = (presence?.people ?? []).length - 1;
    return (
      <Screen>
        <T kind="muted">{rooms.find((r) => r.id === joined)?.theme}</T>
        <T kind="title">{others > 0 ? `Working alongside ${others} other${others > 1 ? 's' : ''}` : 'You’re first in here'}</T>
        <T kind="muted">Silent by design: no camera, no microphone, no chat. Just other people working at the same time.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {(presence?.people ?? []).map((person) => (
            <T key={person.id}>{person.name}</T>
          ))}
        </View>
        <Button kind="quiet" label="Leave the room" onPress={() => socket.current?.close()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <T kind="title">Focus rooms</T>
      <T kind="muted">Body doubling: work while others work. Presence only — nobody can see or hear you.</T>
      {note && <T kind="muted">{note}</T>}
      {rooms.map((room) => (
        <Card key={room.id}>
          <T kind="h2">{room.theme}</T>
          <T kind="muted">{room.count === 0 ? 'Nobody here right now' : `${room.count} here now`}</T>
          <Button label="Join" onPress={() => join(room.id)} />
        </Card>
      ))}
      <Button kind="quiet" label="Back to your tasks" onPress={() => router.back()} />
    </Screen>
  );
}
