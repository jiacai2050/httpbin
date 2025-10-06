import { marked } from "marked";
import * as fs from "fs";
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
