import { CustomError } from "./utils.js";
/* global HTMLRewriter:readonly */

class TitleExtractor {
  constructor() {
    this.title = null;
  }

  text(text) {
    if (text.text.trim().length > 0) {
      this.title = text.text;
    }
  }
}

class MetaExtractor {
  constructor() {
    this.metaTags = {};
  }

  element(element) {
    const name =
      element.getAttribute("name") || element.getAttribute("property");
    const content = element.getAttribute("content");

    if (name && content) {
      this.metaTags[name] = content;
    }
  }
}

export async function handlePageMeta(req, searchParams) {
  const url = searchParams.get("url");
  if (!url) {
    throw new CustomError("No url param found", 400);
  }
  const reqHeaders = new Headers(req.headers);
  const response = await fetch(url, {
    redirect: "follow",
    headers: reqHeaders,
  });
  if (!response.ok) {
    throw new CustomError(
      `Failed to fetch the URL: ${response.status} ${response.statusText}`,
      400,
    );
  }

  const titleExtractor = new TitleExtractor();
  const metaExtractor = new MetaExtractor();
  await new HTMLRewriter()
    .on("title", titleExtractor)
    .on("meta", metaExtractor)
    .transform(response)
    .arrayBuffer(); // Consume the response to ensure HTMLRewriter completes processing

  return new Response(
    JSON.stringify(
      {
        title: titleExtractor.title,
        url: response.url, // final URL obtained after any redirects.
        ...metaExtractor.metaTags,
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}
