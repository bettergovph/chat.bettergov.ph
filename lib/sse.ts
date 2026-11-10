// Shared SSE framing for provider and browser streams, including split UTF-8 and
// CRLF frames. Bound total bytes and release/cancel the reader on every exit.
export async function* readSseData(body: ReadableStream<Uint8Array>, signal?: AbortSignal, maxBytes = 2_000_000) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", data: string[] = [], bytes = 0, ended = false;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) {
      signal?.throwIfAborted();
      const chunk = await reader.read();
      signal?.throwIfAborted();
      if (chunk.done) { ended = true; buffer += decoder.decode(); }
      else {
        bytes += chunk.value.byteLength;
        if (bytes > maxBytes) throw new Error("The response stream exceeded its size limit.");
        buffer += decoder.decode(chunk.value, { stream: true });
      }
      let newline;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (!line) {
          if (data.length) yield data.join("\n");
          data = [];
        } else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (ended) {
        if (buffer.startsWith("data:")) data.push(buffer.slice(5).replace(/^ /, "").replace(/\r$/, ""));
        if (data.length) yield data.join("\n");
        return;
      }
    }
  } finally {
    signal?.removeEventListener("abort", cancel);
    if (!ended) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
