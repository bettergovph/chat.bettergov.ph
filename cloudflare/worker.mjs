import nextWorker from "../.open-next/worker.js";
export * from "../.open-next/worker.js";

const worker = {
  async fetch(request, env, context) {
    if (request.method === "POST" && new URL(request.url).pathname === "/api/chat") {
      // Share the existing capacity budget across isolates at each edge location.
      // No client-controlled IP headers or persistent personal identifiers.
      const { success } = await env.CHAT_RATE_LIMITER.limit({ key: "kuya-j:chat" });
      if (!success) return Response.json({ error: "Kuya J is busy. Please try again in a minute." }, {
        status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" },
      });
    }
    return nextWorker.fetch(request, env, context);
  },
};

export default worker;
