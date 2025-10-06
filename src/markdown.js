import { marked } from "marked";

export async function handleMarkdown(req, searchParams) {
  const contentType = req.headers.get("content-type") || "text/plain";
  let markdownSource;
  if (
    contentType.includes("text/markdown") ||
    contentType.includes("text/plain")
  ) {
    markdownSource = (await req.text()) || searchParams.get("text");
  } else if (contentType.includes("application/json")) {
    const j = await req.json();
    markdownSource = j["text"];
  } else {
    return new Response(`Unsupported Content-Type: ${contentType}`, {
      status: 415,
    });
  }

  const markdown = markdownSource || "# Hello, Edgebin!";
  return new Response(marked.parse(markdown), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
