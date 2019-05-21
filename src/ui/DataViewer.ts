import {DataUi} from "ppspider";
import {LoadPageInfo} from "../tasks/WebMonitorTask";

type TimeRangeCount = {
    timeMax: number;
    timeRange: string;
    count: number;
    percent: number;
}

declare const G2: any;

@DataUi({
    label: "网站响应速度分析",
    // language=CSS
    style: `
        th.sort {
            cursor: pointer;
            position: relative;
        }

        th.sort:after {
            content: ' ';
            position: absolute;
            height: 0;
            width: 0;
            right: 10px;
        }
        
        th.sort.asc:after {
            top: 16px;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 0px solid transparent;
            border-bottom: 5px solid #333;
        }
        th.sort.asc:hover:after {
            border-bottom: 5px solid #888;
        }

        th.sort.desc:after {
            top: 22px;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 5px solid #333;
            border-bottom: 5px solid transparent;
        }
        th.sort.desc:hover:after {
            border-top: 5px solid #888;
        }
    `,
    // language=Angular2HTML
    template: `
    <div class="container-fluid" style="margin: 12px 0">
        <form class="form-inline" style="margin-bottom: 12px">
            <div class="form-group">
                <label for="status" class="control-label" style="margin-right: 12px">状态码</label>
                <select [(ngModel)]="curStatus" (change)="computeAndRedraw()" id="status" name="status" class="form-control">
                    <option [ngValue]="0">所有</option>
                    <option *ngFor="let item of htmlStatusArr" [ngValue]="item">{{item == -1 ? '超时' : item}}</option>
                </select>
            </div>
            <div class="form-group" style="margin-left: 24px">
                <label for="urlRegex" class="control-label" style="margin-right: 12px">Url正则筛选</label>
                <input [(ngModel)]="urlRegex" (change)="computeAndRedraw()" id="urlRegex" name="urlRegex" class="form-control">
            </div>
            <div class="form-group" style="margin-left: 24px">
                <label class="control-label" style="margin-right: 12px">Html加载时间范围</label>
                <input [(ngModel)]="minHtmlCost" (change)="computeAndRedraw()" type="number" min="0" max="60" required id="minHtmlCost" name="minHtmlCost" class="form-control">~
                <input [(ngModel)]="maxHtmlCost" (change)="computeAndRedraw()" type="number" min="0" max="60" required id="maxHtmlCost" name="maxHtmlCost" class="form-control">
            </div>
            <div class="form-group" style="margin-left: 24px">
                <label class="control-label" style="margin-right: 12px">资源加载时间范围</label>
                <input [(ngModel)]="minAllCost" (change)="computeAndRedraw()" type="number" min="0" max="60" required id="minAllCost" name="minAllCost" class="form-control">~
                <input [(ngModel)]="maxAllCost" (change)="computeAndRedraw()" type="number" min="0" max="60" required id="maxAllCost" name="maxAllCost" class="form-control">
            </div>
        </form>
    
        <div class="row">
            <h4 class="col-md-12">html加载时间</h4>
            <div class="col-md-6">
                <div id="htmlCostsHistogram"></div>
            </div>
            <div class="col-md-6">
                <div id="htmlCostsRing"></div>
            </div>
        </div>
    
        <div class="row">
            <h4 class="col-md-12">所有资源加载时间</h4>
            <div class="col-md-6">
                <div id="allCostsHistogram"></div>
            </div>
            <div class="col-md-6">
                <div id="allCostsRing"></div>
            </div>
        </div>
    
        <div *ngIf="detailTableDatas.length" class="row">
            <div class="col-sm-12">
                <table class="table table-bordered">
                    <thead>
                    <tr>
                        <th>#</th>
                        <th>Job Id</th>
                        <th>Url</th>
                        <th>Html请求响应码</th>
                        <th (click)="sortDetailTable('htmlCost')" [class]="curSortKey == 'htmlCost' ? 'sort ' + (curSortOrder == -1 ? 'desc' : 'asc') : ''">Html加载时间(秒)</th>
                        <th (click)="sortDetailTable('allCost')" [class]="curSortKey == 'allCost' ? 'sort ' + (curSortOrder == -1 ? 'desc' : 'asc') : ''">资源加载时间(秒)</th>
                        <th>Tracing</th>
                    </tr>
                    </thead>
                    <tbody>
                    
                    <ng-container *ngFor="let row of detailTableDatas; let rowI = index">
                        <tr *ngIf="rowI < detailTableRows">
                            <th scope="row">{{rowI + 1}}</th>
                            <td>{{row.id}}</td>
                            <td>
                                <a [href]="row.url" target="_blank">{{row.url}}</a>
                            </td>
                            <td>{{row.status}}</td>
                            <td>{{row.htmlCost}}</td>
                            <td>{{row.allCost}}</td>
                            <td>
                                <label (click)="openTimelineViewer(row.id)" class="text-primary" style="cursor: pointer">查看</label>
                            </td>
                        </tr>
                    </ng-container>
                    <tr *ngIf="detailTableRows < detailTableDatas.length - 1">
                        <td (click)="loadMoreDetailTable()" colspan="7" class="text-center text-primary" style="cursor: pointer">加载更多</td>
                    </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>        
    `
})
export class DataViewer {

    private timelineViewerPort: number;

    private loadPageInfos: LoadPageInfo[];

    htmlStatusArr: number[] = [];

    curStatus: number = 0;

    urlRegex: string = "";

    minHtmlCost: number = 0;

    maxHtmlCost: number = 60;

    minAllCost: number = 0;

    maxAllCost: number = 60;

    htmlCosts: TimeRangeCount[] = [];

    allCosts: TimeRangeCount[] = [];

    detailTableDatas: LoadPageInfo[] = [];

    detailTableRows = 20;

    private charts = {};

    curSortKey: "" | "htmlCost" | "allCost" = "";

    curSortOrder: -1 | 1 = -1;

    // 主动请求
    getInitInfo(): Promise<{
        loadPageInfos: LoadPageInfo[],
        timelineViewerPort: number
    }> {
        // just a stub
        return null;
    }

    openTimelineViewer(id: string) {
        const location = window.location;
        const timelineViewerUrl = location.protocol + "//" + location.hostname + ":" + this.timelineViewerPort
            + "/?loadTimelineFromURL=" + document.baseURI + 'tracing/?id=' + id;
        window.open(timelineViewerUrl, "_blank");
    }

    // 接收增量推送
    receiveLoadPageInfos(infos: LoadPageInfo[]) {
        if (!this.loadPageInfos) {
            return;
        }

        let shouldRefresh = false;
        const oldStatusLen = this.htmlStatusArr.length;
        for (let info of infos) {
            this.loadPageInfos.push(info);
            if (this.htmlStatusArr.indexOf(info.status) == -1) {
                this.htmlStatusArr.push(info.status);
            }

            if (this.isLoadPageInfoExpected(info)) {
                this.addToTimeRange(this.htmlCosts, info.htmlCost);
                this.addToTimeRange(this.allCosts, info.allCost);
                shouldRefresh = true;
            }
        }
        if (oldStatusLen != this.htmlStatusArr.length) {
            this.htmlStatusArr.sort();
        }
        if (shouldRefresh) {
            this.redraw("htmlCosts");
            this.redraw("allCosts");
        }
    }

    ngOnInit() {
        this.getInitInfo().then(res => {
            this.loadPageInfos = res.loadPageInfos;
            this.timelineViewerPort = res.timelineViewerPort;
            this.computeAndRedraw();
        });
    }

    private isLoadPageInfoExpected(info: LoadPageInfo) {
        if (this.curStatus != 0 && this.curStatus != info.status) {
            return false;
        }

        if (this.urlRegex != "" && !info.url.match(this.urlRegex)) {
            return false;
        }

        if (isNaN(parseFloat('' + this.minHtmlCost)) || info.htmlCost < this.minHtmlCost) {
            return false;
        }

        if (isNaN(parseFloat('' + this.maxHtmlCost)) || info.htmlCost > this.maxHtmlCost) {
            return false;
        }

        if (isNaN(parseFloat('' + this.minAllCost)) || info.allCost < this.minAllCost) {
            return false;
        }

        if (isNaN(parseFloat('' + this.maxAllCost)) || info.allCost > this.maxAllCost) {
            return false;
        }

        return true;
    }

    computeAndRedraw() {
        this.computeInfo();
        this.redraw("htmlCosts");
        this.redraw("allCosts");
    }

    private computeInfo() {
        this.htmlCosts = this.initTimeRangeCounts();
        this.allCosts = this.initTimeRangeCounts();
        for (let info of this.loadPageInfos) {
            if (this.htmlStatusArr.indexOf(info.status) == -1) {
                this.htmlStatusArr.push(info.status);
            }

            if (this.isLoadPageInfoExpected(info)) {
                this.addToTimeRange(this.htmlCosts, info.htmlCost);
                this.addToTimeRange(this.allCosts, info.allCost);
            }
        }
        this.htmlStatusArr.sort();
    }

    private addToTimeRange(ranges: TimeRangeCount[], cost: number) {
        for (let range of ranges) {
            if (cost <= range.timeMax) {
                range.count++;
                break;
            }
        }
    }

    private initTimeRangeCounts() {
        const res: TimeRangeCount[] = [];
        const ranges = [0, 1, 2, 3, 4, 5, 7.5, 10, 15, 20, 30, 60];
        for (let i = 1, len = ranges.length; i < len; i++) {
            res.push({
                timeMax: ranges[i],
                timeRange: ranges[i - 1] + "~" + ranges[i],
                count: 0,
                percent: 0
            })
        }
        return res;
    }

    private redraw(dataType: "htmlCosts" | "allCosts") {
        let data = this[dataType] as TimeRangeCount[];

        // 柱状图
        let id = dataType + "Histogram";
        let chart = this.charts[id];
        if (!chart) {
            chart = new G2.Chart({
                container: id,
                forceFit: true,
                height: 350
            });
            chart.source(data);
            chart.interval().position('timeRange*count');
            chart.on('interval:click', event => {
                this.prepareDetailTable(dataType, event.data._origin.timeRange);
            });
            chart.render();
            this.charts[id] = chart;
        }
        else {
            chart.changeData(data);
        }

        // 环图
        // 过滤count为0的分段，计算 total 和 percent
        data = data.filter(item => item.count > 0);
        let maxCountItem: TimeRangeCount = null;
        if (data.length > 0) {
            let total = 0;
            for (let item of data) {
                total += item.count;
                if (maxCountItem == null || maxCountItem.count < item.count) {
                    maxCountItem = item;
                }
            }
            for (let item of data) {
                item.percent = item.count / total;
            }
        }

        const percentFormatter = percent => {
            return (percent * 100).toFixed(2).replace(/\.0+$/, '') + '%';
        };

        id = dataType + "Ring";
        chart = this.charts[id];
        if (!chart) {
            chart = new G2.Chart({
                container: id,
                forceFit: true,
                height: 350,
                animate: false
            });
            chart.source(data, {
                percent: {
                    formatter: percentFormatter
                }
            });
            chart.coord('theta', {
                radius: 0.8,
                innerRadius: 0.65
            });
            chart.tooltip({
                showTitle: false,
                itemTpl: '<li><span style="background-color:{color};" class="g2-tooltip-marker"></span>{tooltip}</li>'
            });
            chart.intervalStack().position('percent').color('timeRange').label('percent', {
                formatter: (val, item) => item.point.timeRange + '秒 ' + val
            }).tooltip('timeRange*percent*count', (timeRange, percent, count) => {
                percent = percentFormatter(percent);
                return {
                    tooltip: timeRange + '秒 ' + count + "次(" + percent + ")"
                };
            }).style({
                lineWidth: 1,
                stroke: '#fff'
            });
            chart.on('interval:click', event => {
                this.prepareDetailTable(dataType, event.data._origin.timeRange);
            });
            chart.render();
            this.charts[id] = chart;
        }
        else {
            chart.changeData(data);
        }
    }

    private prepareDetailTable(dataType: "htmlCosts" | "allCosts", timeRange: string) {
        const timeKey = dataType.substring(0, dataType.length - 1);
        const [timeMin, timeMax] = timeRange.split("~").map(item => +item);
        this.detailTableDatas = [];
        for (let info of this.loadPageInfos) {
            const time = info[timeKey];
            if (this.isLoadPageInfoExpected(info) && time > timeMin && time <= timeMax) {
                this.detailTableDatas.push(info);
            }
        }
        this.sortDetailTable(timeKey as any, -1);
    }

    sortDetailTable(sortKey: "htmlCost" | "allCost", sortOrder?: -1 | 1) {
        this.curSortOrder = sortOrder ? sortOrder : (this.curSortKey == sortKey ? -this.curSortOrder : this.curSortOrder) as any;
        this.curSortKey = sortKey;
        this.detailTableDatas.sort((o1, o2) => this.curSortOrder * (o1[sortKey] - o2[sortKey]));
    }

    loadMoreDetailTable() {
        this.detailTableRows = Math.min(this.detailTableDatas.length, this.detailTableRows + 20);
    }

}
