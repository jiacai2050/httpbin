import { marked } from "marked";
import * as fs from "fs";

const commit_sha = process.env.WORKERS_CI_COMMIT_SHA || "main";
const buildInfo = {
  commit_sha,
  branch: process.env.WORKERS_CI_BRANCH,
  build_id: process.env.WORKERS_CI_BUILD_UUID,
  build_date: new Date().toISOString(),
  tree: `https://github.com/jiacai2050/edgebin/tree/${commit_sha}`,
};

function genIndex() {
  const markdownFilePath = "README.md";
  const outputFilePath = "docs/index.html";
  const templatePath = "docs/templ.html";

  const markdown = fs.readFileSync(markdownFilePath, "utf8");
  const template = fs.readFileSync(templatePath, "utf8");
  const htmlContent = marked.parse(markdown);
  const fullHtml = template
    .replace("$body$", htmlContent)
    .replace(
      "$build_date$",
      `<a href="https://github.com/jiacai2050/edgebin/commit/${commit_sha}">${buildInfo.build_date}</a>`,
    )
    .replace("docs/logo.svg", "logo.svg");
  fs.writeFileSync(outputFilePath, fullHtml, "utf8");
  console.log(`Output html to ${outputFilePath}`);
}

function genVersion() {
  fs.writeFileSync(
    "docs/version.json",
    JSON.stringify(buildInfo, null, 2),
    "utf8",
  );
  console.log("Wrote version.json");
}

genIndex();
genVersion();
