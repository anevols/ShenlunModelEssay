/**
 * 文章直访引导脚本
 *
 * 作用：当用户直接访问 articles/xxx.html（例如分享链接、刷新、搜索引擎）时，
 * 自动跳转到 index.html#xxx，由主页文档站框架统一渲染，保证导航栏/侧边栏/大纲一致。
 *
 * 注意：本脚本只在浏览器真正打开文章页时执行；
 * 主页通过 fetch() 抓取文章内容时不会执行脚本，因此不影响内容读取。
 */
(function () {
  // 只在顶层窗口（非 iframe）且 URL 路径包含 /articles/ 时处理
  if (window.top !== window.self) return;
  var path = window.location.pathname;
  var match = path.match(/\/articles\/([^\/]+?)\.html$/);
  if (!match) return;

  var slug = match[1];
  var target = window.location.origin + path.replace(/\/articles\/[^\/]*\.html$/, "/index.html");
  // 保留 query（理论上无），拼接 hash
  target += "#" + slug;
  // 避免重复跳转：若已是目标地址则不再跳
  if (window.location.href === target) return;
  window.location.replace(target);
})();
