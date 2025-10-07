import { marked } from "marked";
import * as fs from "fs";

function genIndex() {
  const markdownFilePath = "README.md";
  const outputFilePath = "docs/index.html";
  const templatePath = "docs/templ.html";

  const markdown = fs.readFileSync(markdownFilePath, "utf8");
  const template = fs.readFileSync(templatePath, "utf8");
  const htmlContent = marked.parse(markdown);
  const fullHtml = template
    .replace("$body$", htmlContent)
    .replace("docs/logo.svg", "logo.svg");
  fs.writeFileSync(outputFilePath, fullHtml, "utf8");
  console.log(`Output html to ${outputFilePath}`);
}

function genVersion() {
  const body = {
    commit_sha: process.env.WORKERS_CI_COMMIT_SHA,
    branch: process.env.WORKERS_CI_BRANCH,
    build_id: process.env.WORKERS_CI_BUILD_UUID,
    build_date: new Date().toISOString(),
  };
  fs.writeFileSync("docs/version.json", JSON.stringify(body, null, 2), "utf8");
  console.log("Wrote version.json");
}

genIndex();
genVersion();
