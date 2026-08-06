#!/usr/bin/env node
/**
 * 生成文章清单 manifest.json
 *
 * 遍历 articles/ 下所有 .html 文件（跳过 _ 开头的模板），提取 <meta> 中的
 * 标题/分类/序号/日期/作者/摘要，生成 articles/manifest.json。
 *
 * 用途：前端首屏直接 fetch manifest.json 拿到全部文章 meta，
 * 无需调用 GitHub Contents API、无需目录浏览、无需逐篇 fetch 提取 meta。
 *
 * 运行方式：
 *   node scripts/generate-manifest.js
 *
 * GitHub Actions 会在 articles/ 有变动时自动运行此脚本并提交 manifest.json；
 * 本地预览时，添加/修改文章后手动运行一次即可。
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ARTICLES_DIR = path.join(ROOT, "articles");
const OUTPUT = path.join(ARTICLES_DIR, "manifest.json");

// 简易 HTML meta 提取（无依赖，兼容中文）
function extractMeta(html, name) {
  // 匹配 <meta name="article-xxx" content="...">
  const re = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const m = html.match(re);
  return m ? m[1].trim() : "";
}

function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : "";
}

function main() {
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.error(`[manifest] 目录不存在: ${ARTICLES_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(ARTICLES_DIR)
    .filter((name) => name.endsWith(".html") && !name.startsWith("_"))
    .sort((a, b) => a.localeCompare(b, "zh"));

  const manifest = files.map((name) => {
    const filePath = path.join(ARTICLES_DIR, name);
    let html = "";
    try {
      html = fs.readFileSync(filePath, "utf8");
    } catch (e) {
      console.error(`[manifest] 读取失败 ${name}: ${e.message}`);
      return null;
    }

    const slug = name.replace(/\.html$/, "");
    const title =
      extractMeta(html, "article-title") || extractTitle(html) || slug;
    const category = extractMeta(html, "article-category") || "申论";
    const order = parseInt(extractMeta(html, "article-order") || "999", 10);
    const date = extractMeta(html, "article-date");
    const author = extractMeta(html, "article-author");
    const description = extractMeta(html, "article-description");

    return { slug, file: name, title, category, order, date, author, description };
  }).filter(Boolean);

  // 按 category → order 排序，与前端展示顺序一致
  manifest.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category, "zh");
    return a.order - b.order;
  });

  fs.writeFileSync(OUTPUT, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`[manifest] 生成完成: ${path.relative(ROOT, OUTPUT)}（${manifest.length} 篇）`);
}

main();
