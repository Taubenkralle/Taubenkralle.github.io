#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT_FILE = path.join(ROOT, "search-index.json");
const INCLUDE_EXT = ".html";
const EXCLUDE_DIRS = new Set([".git", "node_modules"]);

function walk(dir, list = []){
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries){
    if (entry.name.startsWith(".")) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()){
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(full, list);
    }else if (entry.isFile() && entry.name.endsWith(INCLUDE_EXT)){
      list.push(full);
    }
  }
  return list;
}

function stripTags(html){
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(text){
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function extractTitle(html){
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!match) return "";
  return decodeEntities(stripTags(match[1]));
}

function extractHeadings(html){
  const headings = [];
  const re = /<h([1-4])([^>]*)>([\s\S]*?)<\/h\1>/gi;
  let match;
  while ((match = re.exec(html)) !== null){
    const attrs = match[2] || "";
    const text = decodeEntities(stripTags(match[3] || ""));
    const idMatch = attrs.match(/\sid=["']([^"']+)["']/i);
    if (!idMatch) continue;
    headings.push({ id: idMatch[1], text });
  }
  return headings;
}

function toRelative(file){
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function buildIndex(){
  const files = walk(ROOT).filter((f) => !f.endsWith("search-index.json"));
  const items = [];

  for (const file of files){
    const html = fs.readFileSync(file, "utf8");
    const rel = toRelative(file);
    const title = extractTitle(html) || rel;
    items.push({
      title,
      url: rel,
      meta: "Page",
      keywords: title.toLowerCase()
    });

    const headings = extractHeadings(html);
    headings.forEach((h) => {
      if (!h.text) return;
      items.push({
        title: h.text,
        url: `${rel}#${h.id}`,
        meta: title,
        keywords: h.text.toLowerCase()
      });
    });
  }

  items.sort((a, b) => a.url.localeCompare(b.url));
  fs.writeFileSync(OUT_FILE, JSON.stringify(items, null, 2) + "\n");
  return items.length;
}

const count = buildIndex();
console.log(`search-index.json updated (${count} items).`);
