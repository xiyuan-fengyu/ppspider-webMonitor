
export const config = {
    // 起始地址
    startUrls: ["http://www.bilibili.com"],
    // 网页超链接漫游最大深度
    maxDepth: 6,
    // 从网页中筛选网页超链接的正则
    urlRegex: "^https?:\\/\\/([^./]+\\.)?(bilibili)\\.com.*"
};
