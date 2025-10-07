import { CustomError } from "./utils.js";

export async function handleMarkdownToHtml(req, searchParams) {
  const markdown = (await getInput(req, searchParams)) || "# Hello, Edgebin!";
  const module = await import("marked");

  return new Response(module.marked.parse(markdown), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function handleHtmlToMarkdown(req, searchParams) {
  const html =
    (await getInput(req, searchParams)) || "<h1>Hello, Edgebin!</h1>";
  // static import causes issues when running tests
  // TypeError: Cannot read properties of undefined (reading 'SelectorType')
  // node_modules/css-select/lib/sort.js:6:17
  const module = await import("node-html-markdown");
  return new Response(module.NodeHtmlMarkdown.translate(html), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

async function getInput(req, searchParams) {
  const url = searchParams.get("url");
  if (url) {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new CustomError(`Failed to fetch URL: ${url}`, resp.status);
    }
    return await resp.text();
  }
  return (await req.text()) || searchParams.get("text");
}
