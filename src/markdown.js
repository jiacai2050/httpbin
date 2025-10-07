import { getTextInput } from "./utils.js";

export async function handleMarkdownToHtml(req, searchParams) {
  const markdown = await getTextInput(req, searchParams);
  const module = await import("marked");
  return new Response(module.marked.parse(markdown), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function handleHtmlToMarkdown(req, searchParams) {
  const html = await getTextInput(req, searchParams);
  // static import causes issues when running tests
  // TypeError: Cannot read properties of undefined (reading 'SelectorType')
  // node_modules/css-select/lib/sort.js:6:17
  const module = await import("node-html-markdown");
  return new Response(module.NodeHtmlMarkdown.translate(html), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
