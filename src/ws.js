import { CustomError, getDateString } from "./utils.js";

function handleSession(server, timeZone) {
  server.accept();
  server.addEventListener("message", ({ data }) => {
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

  server.addEventListener("close", (evt) => {
    console.log(evt);
  });
  server.addEventListener("error", (evt) => {
    console.log(evt);
  });
}

export const websocketHandler = async (request) => {
  const upgradeHeader = request.headers.get("Upgrade");
  const cf = request.cf || {};
  const timezone = cf.timezone;
  if (upgradeHeader !== "websocket") {
    throw new CustomError("Expected websocket", 400);
  }

  const [client, server] = Object.values(new WebSocketPair());
  handleSession(server, timezone);

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
};
