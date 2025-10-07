import { CustomError } from "./utils.js";

export async function handleWebhook(searchParams, req) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from !== "github" || to !== "telegram") {
    throw new CustomError("Only support (github, telegram) for now", 400);
  }

  const ua = req.headers.get("user-agent") || "";
  if (!ua.includes("GitHub-Hookshot")) {
    throw new CustomError("Not a GitHub webhook", 400);
  }

  const payload = await req.json();
  // const login = payload["sender"]["login"];
  const event = req.headers.get("x-github-event");
  const chat_id = searchParams.get("tg_chat_id");
  const token = searchParams.get("tg_token");
  switch (event) {
    case "issues": {
      // https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#issues
      return await issueHandler(chat_id, payload, token);
    }
    case "discussion": {
      // https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#discussion
      return await discussionHandler(chat_id, payload, token);
    }
    case "pull_request": {
      // https://docs.github.com/en/webhooks/webhook-events-and-payloads?actionType=opened#pull_request
      return await pullHandler(chat_id, payload, token);
    }
    default: {
      return new Response("pong");
    }
  }
}

async function issueHandler(chat_id, payload, token) {
  const action = payload["action"];
  if (action !== "opened") {
    return new Response(
      `issueHandler only cares about opened action, current:${action}`,
    );
  }
  const issue = payload["issue"];
  const html_url = issue["html_url"];
  const title = issue["title"];
  // const body = issue["body"];
  const msg = `[${normalize(title)}](${html_url})`;
  return await sendTelegram(chat_id, msg, html_url, token);
}

async function discussionHandler(chat_id, payload, token) {
  const action = payload["action"];
  if (action !== "created") {
    return new Response(
      `discussionHandler only cares about created action, current:${action}`,
    );
  }
  const discussion = payload["discussion"];
  const html_url = discussion["html_url"];
  const title = discussion["title"];
  // const body = discussion["body"];
  const category_name = discussion["category"]["name"];
  const msg = `[${normalize(title)}](${html_url}) in ${category_name}`;
  return await sendTelegram(chat_id, msg, html_url, token);
}

async function pullHandler(chat_id, payload, token) {
  const action = payload["action"];
  if (action !== "opened") {
    return new Response(
      `pullHandler only cares about opened action, current:${action}`,
    );
  }
  const title = payload["pull_request"]["title"];
  const html_url = payload["pull_request"]["html_url"];
  // const body = payload["pull_request"]["body"];
  const msg = `[${normalize(title)}](${html_url})`;
  return await sendTelegram(chat_id, msg, html_url, token);
}

// Escape those chars according to https://core.telegram.org/bots/api#sendmessage
function normalize(title) {
  return title.replace(/([-_*[\]()~`>#+=|{}.!])/g, "\\$1");
}

// https://core.telegram.org/bots/api#sendmessage
async function sendTelegram(chat_id, message, url, token) {
  const api = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    text: message,
    chat_id,
    parse_mode: "MarkdownV2",
    link_preview_options: { url: url },
  };
  console.log(`sendTelegram: msg:${message}, chat:${chat_id}`);
  return await fetch(api, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
