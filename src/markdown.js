import { marked } from "marked";

export async function handleMarkdown(req, searchParams) {
  const contentType = req.headers.get("content-type") || "text/plain";
  if (
    contentType.includes("text/markdown") ||
    contentType.includes("text/plain")
  ) {
    const markdown =
      (await req.text()) || searchParams.get("text") || "# Hello, Edgebin!";
    return new Response(marked.parse(markdown), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } else if (contentType.includes("application/json")) {
    const j = await req.json();
    const text = j["text"] || "# Hello, Edgebin!";
    return new Response(marked.parse(text), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response(`Unsupported Content-Type: ${contentType}`, {
    status: 415,
  });
}
