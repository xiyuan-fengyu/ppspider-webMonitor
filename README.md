# ppspider-webMonitor
监控网站的网页工作情况  
这里以 bilibili.com 为例，可以修改 src/config.ts 来监控自己的网站  

其中 timeline-viewer 是从 https://chromedevtools.github.io/timeline-viewer/ 提取出来的  
由于网页中需要连接国外网站进行用户认证，下载js文件，国内用户如果不翻墙，将无法正常工作  
于是我从中提取出核心的功能代码，移除了google用户认证(用于关联google driver)，将需要用到的js都放到了项目中，
另外修复了一些bug  

![1.png](https://i.loli.net/2019/05/21/5ce3ade2ce09e55677.png)  

点击柱形图和环形图查看相关的网页  
![2.png](https://i.loli.net/2019/05/21/5ce3ade3972c091439.png)  

点击“查看”按钮查看该网页的请求详情  
![3.png](https://i.loli.net/2019/05/21/5ce3ade4f358574358.png)  

安装依赖
```
set PUPPETEER_DOWNLOAD_HOST=https://npm.taobao.org/mirrors/
npm install 
# 或则用yarn安装依赖（需要通过npm提前全局安装yarn：npm install yarn -g）
# yarn install
```


