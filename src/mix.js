import { sleep, stringToNumber } from "./utils.js";

// Like https://httpbun.org/help/mixer
export async function handleMix(searchParams, req) {
  let status = searchParams.has("s")
    ? stringToNumber(searchParams.get("s"))
    : 200;
  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) {
    headers.set("content-type", ct);
  }
  if (searchParams.has("d")) {
    await sleep(stringToNumber(searchParams.get("d")));
  }

  searchParams.getAll("h").forEach((h) => {
    const idx = h.indexOf(":");
    if (idx > 0) {
      const [key, value] = [h.slice(0, idx), h.slice(idx + 1)];
      headers.append(key.trim(), value.trim());
    }
  });
  return new Response(await req.text(), {
    headers,
    status,
  });
}
