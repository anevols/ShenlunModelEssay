/**
 * 通用工具函数
 */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function getMeta(doc, name) {
  return doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content")?.trim() || "";
}

function detectRepo() {
  const host = window.location.hostname;
  const path = window.location.pathname.replace(/^\/+/, "");
  const firstSeg = path.split("/")[0];
  if (host.endsWith("github.io") && firstSeg) {
    return { owner: host.split(".")[0], repo: firstSeg };
  }
  if (host.endsWith("github.io")) {
    const owner = host.split(".")[0];
    return { owner, repo: `${owner}.github.io` };
  }
  return { owner: null, repo: null };
}
