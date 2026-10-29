/**
 * Server-sent event framing, shared by every stream the Bridge publishes.
 *
 * The Bridge writes one event per blank-line-separated block (`id:`, `event:`, one or more `data:`
 * lines), so both the run status stream and the assistant answer stream are read the same way here
 * instead of each keeping its own copy of the framing rules.
 */
export interface SseFrame {
  id: string;
  event: string;
  data: string;
}

/** Parses one event block; returns null for a block that carries neither an id nor data. */
export function parseSseFrame(block: string): SseFrame | null {
  let id = "";
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator >= 0 ? line.slice(0, separator) : line;
    const value = separator >= 0 ? line.slice(separator + 1).replace(/^ /, "") : "";
    if (field === "id") id = value;
    else if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  return data.length || id ? { id, event, data: data.join("\n") } : null;
}

/**
 * Yields the frames of one open stream until it ends.
 *
 * Breaking out of the loop cancels the underlying reader, so a caller that has seen everything it
 * needs - or that wants to stop early - does not leave the response body open.
 */
export async function* readSseFrames(response: Response): AsyncGenerator<SseFrame> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = parseSseFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (frame) yield frame;
        boundary = buffer.indexOf("\n\n");
      }
      if (done) {
        // SSE dispatches an event only after the terminating blank line.  A
        // response that ends with a partial field block is a truncated stream,
        // not a clean EOF; callers must fall back to their durable polling or
        // surface the protocol failure instead of silently treating it as a
        // complete observation.
        if (buffer.trim()) throw new Error("incomplete_sse_frame");
        return;
      }
    }
  } finally {
    void reader.cancel().catch(() => undefined);
  }
}
