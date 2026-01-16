#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT_FILE = path.join(ROOT, "search-index.json");
const INCLUDE_EXT = ".html";
const EXCLUDE_DIRS = new Set([".git", "node_modules"]);
const HEADING_RE = /<h([1-4])([^>]*)>([\s\S]*?)<\/h\1>/gi;
const ID_TAG_RE = /<(p|li|dt|dd|h[1-6])([^>]*)>([\s\S]*?)<\/\1>/gi;

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

function normalize(text){
  return (text || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function slugify(text){
  return normalize(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  let match;
  while ((match = HEADING_RE.exec(html)) !== null){
    const attrs = match[2] || "";
    const text = decodeEntities(stripTags(match[3] || ""));
    const idMatch = attrs.match(/\sid=["']([^"']+)["']/i);
    const id = idMatch ? idMatch[1] : slugify(text);
    if (!id || !text) continue;
    headings.push({ id, text });
  }
  return headings;
}

function extractIdTags(html){
  const items = [];
  let match;
  while ((match = ID_TAG_RE.exec(html)) !== null){
    const tag = match[1].toLowerCase();
    const attrs = match[2] || "";
    const text = decodeEntities(stripTags(match[3] || ""));
    const idMatch = attrs.match(/\sid=["']([^"']+)["']/i);
    if (!idMatch || !text) continue;
    if (tag.startsWith("h")) continue;
    items.push({ id: idMatch[1], text });
  }
  return items;
}

function toRelative(file){
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function buildIndex(){
  const files = walk(ROOT).filter((f) => !f.endsWith("search-index.json"));
  const items = [];
  const seen = new Set();

  for (const file of files){
    const html = fs.readFileSync(file, "utf8");
    const rel = toRelative(file);
    const urlBase = `/${rel}`;
    const title = extractTitle(html) || rel;
    items.push({
      title,
      url: urlBase,
      meta: "Page",
      keywords: normalize(title)
    });

    const headings = extractHeadings(html);
    headings.forEach((h) => {
      if (!h.text) return;
      const key = `${urlBase}#${h.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({
        title: h.text,
        url: `${urlBase}#${h.id}`,
        meta: title,
        keywords: normalize(h.text)
      });
    });

    const idTags = extractIdTags(html);
    idTags.forEach((t) => {
      const key = `${urlBase}#${t.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({
        title: t.text,
        url: `${urlBase}#${t.id}`,
        meta: title,
        keywords: normalize(t.text)
      });
    });
  }

  items.sort((a, b) => a.url.localeCompare(b.url));
  fs.writeFileSync(OUT_FILE, JSON.stringify(items, null, 2) + "\n");
  return items.length;
}

const count = buildIndex();
console.log(`search-index.json updated (${count} items).`);
