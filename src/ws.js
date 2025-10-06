import { CustomError, getDateString } from "./utils";

async function handleSession(server, timeZone) {
  server.accept();
  server.addEventListener("message", async ({ data }) => {
    switch (data) {
      case "close":
        return server.close(1000, "Normal Closure");
      case "date":
        return server.send(getDateString({ timeZone }));
      case "ping":
        return server.send("pong");
      default:
        return server.send(data);
    }
  });

  server.addEventListener("close", async (evt) => {
    console.log(evt);
  });
  server.addEventListener("error", async (evt) => {
    console.log(evt);
  });
}

export const websocketHandler = async (request) => {
  const upgradeHeader = request.headers.get("Upgrade");
  const cf = request.cf || {};
  const timezone = cf.timezone || "Asia/Shanghai";
  if (upgradeHeader !== "websocket") {
    throw new CustomError("Expected websocket", 400);
  }

  const [client, server] = Object.values(new WebSocketPair());
  await handleSession(server, timezone);

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
};
