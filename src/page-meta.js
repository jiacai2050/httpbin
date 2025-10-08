import { CustomError } from "./utils.js";

class TitleExtractor {
  constructor() {
    this.title = null;
    this._buffer = "";
  }

  // https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/#text-chunks
  text(text) {
    this._buffer += text.text;
    if (text.lastInTextNode) {
      const trimmed = this._buffer.trim();
      if (trimmed) {
        this.title = trimmed;
      }
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
  if (!response.headers.get("Content-Type")?.includes("text/html")) {
    return response;
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
