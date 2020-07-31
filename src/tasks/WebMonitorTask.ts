import {
    AddToQueue, appInfo,
    Autowired,
    DataUiRequest,
    FromQueue,
    Job,
    NetworkTracing,
    OnTime, Page,
    PuppeteerUtil,
    RequestMapping,
    Transient
} from "ppspider";
import {DelayExecutor} from "../util/DelayExecutor";
import {DataViewer} from "../ui/DataViewer";
import {Request, Response} from "express";
import {timelineViewerPort} from "../App";
import {config} from "../config";

export type LoadPageInfo = {
    id: string,
    url: string,
    status: number,
    htmlCost: number,
    allCost: number,
    tracingUrl?: string
}

export class WebMonitorTask {

    // 保存打开网页的基本信息
    private readonly loadPageInfos: LoadPageInfo[] = [];

    // dataViewer 这个 Bean 的引用，用于调用方法推送数据
    @Autowired(DataViewer)
    private dataViewer: DataViewer;

    // 缓存增量信息
    @Transient()
    private delayToPushInfos: LoadPageInfo[] = [];

    // 延迟推送增量信息
    @Transient()
    private delayToPushAction = new DelayExecutor(() => {
        this.dataViewer.receiveLoadPageInfos(this.delayToPushInfos);
        this.delayToPushInfos = [];
    }, 500, 1000);

    // 为 dataViewer 提供获取数据的接口
    @DataUiRequest(DataViewer.prototype.getInitInfo)
    getLoadPageInfos() {
        return {
            loadPageInfos: this.loadPageInfos,
            timelineViewerPort: timelineViewerPort
        };
    }

    private addLoadPageInfo(info: LoadPageInfo) {
        this.loadPageInfos.push(info);
        this.delayToPushInfos.push(info);
        this.delayToPushAction.delayExecute();
    }

    // 周期爬取首页
    @OnTime({
        urls: config.startUrls,
        cron: "* * * * * *",
        exeInterval: 600 * 1000,
        // running: false
    })
    // 从 urls 队列中获取url，执行任务
    @FromQueue({
        name: "urls",
        parallel: 3,
        exeInterval: 250,
        // running: false
    })
    // 将方法返回的结果作为子任务添加到 urls 队列中
    @AddToQueue({
        name: "urls"
    })
    async index(page: Page, job: Job) {
        // 网页打开和资源加载的超时时间
        page.setDefaultTimeout(55000);
        page.setDefaultNavigationTimeout(55000);
        await PuppeteerUtil.defaultViewPort(page);

        const loadPageInfo: any = {
            status: -1,
            htmlCost: 0,
            allCost: 0
        };

        let err = null;
        // 开始记录请求
        const networkTracing = new NetworkTracing(page);
        try {
            // 打开网页，直到资源全部加载完成
            await page.goto(job.url, { waitUntil: 'networkidle0' });
        }
        catch (e) {
            err = e;
        }

        // 保存数据
        const now = new Date().getTime();
        const pageRequests = networkTracing.requests();
        loadPageInfo.allCost = this.toSeconds(now - pageRequests.time);
        const htmlReq = pageRequests.requests[0];
        if (htmlReq.response) {
            loadPageInfo.status = htmlReq.response.status;
            loadPageInfo.htmlCost = this.toSeconds(htmlReq.endTime - htmlReq.time);
        }
        else {
            loadPageInfo.htmlCost =  loadPageInfo.allCost;
        }
        pageRequests["_id"] = job._id;
        await appInfo.db.save("networkTracing", pageRequests);
        Object.assign(job.datas, loadPageInfo);

        loadPageInfo.id = job._id;
        loadPageInfo.url = job.url;
        this.addLoadPageInfo(loadPageInfo);

        if (err) {
            throw err;
        }

        // 如果当前深度大于等于6，则不再对该页面的url进行漫游
        if (job.depth < config.maxDepth) {
            return await PuppeteerUtil.links(page, {
                "urls": config.urlRegex
            });
        }
    }

    // 提供接口，供 timeline-viewer 获取数据，这里主要做了数据查询和跨域问题的处理
    @RequestMapping("/tracing")
    async getTracingFile(req: Request, res: Response) {
        const pageRequests = await appInfo.db.findById("networkTracing", req.query.id as string);
        const traceEvents = NetworkTracing.requestsToTraceEvents(pageRequests);
        const traceEventsStr = JSON.stringify(traceEvents);
        res.header("Access-Control-Allow-Origin", req.header("origin"));
        res.header("Access-Control-Allow-Credentials", "true");
        res.header("Access-Control-Allow-Headers", "Content-Type,X-Requested-With");
        res.header("Access-Control-Allow-Methods","GET,OPTIONS");
        res.header('Content-Type', "text/plain; charset=utf-8");
        res.write(traceEventsStr, 'utf-8');
        res.end();
    }

    private toSeconds(millisecond: number, digits: number = 3) {
        return +(millisecond / 1000).toFixed(digits).replace(/\.0+$/, '');
    }

}
