type PlaybackCursorListener = (cursorPs: string) => void;

const listeners = new Set<PlaybackCursorListener>();

/** High-rate cursor for the topology bead. It does not trigger a Vue render. */
export function publishPlaybackCursor(cursorPs: string) {
  for (const listener of listeners) listener(cursorPs);
}

export function subscribePlaybackCursor(listener: PlaybackCursorListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
