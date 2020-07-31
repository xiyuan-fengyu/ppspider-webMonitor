import {DbHelperUi, Launcher, PuppeteerWorkerFactory} from "ppspider";
import {WebMonitorTask} from "./tasks/WebMonitorTask";
import {DataViewer} from "./ui/DataViewer";
import {TimelineViewer} from "./timeline-viewer/TimelineViewer";

@Launcher({
    workplace: "workplace",
    dbUrl: "mongodb://192.168.99.150:27017/bilibili",
    tasks: [
        WebMonitorTask
    ],
    dataUis: [
        DataViewer,
        DbHelperUi
    ],
    webUiPort: 9000,
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: true,
            devtools: false
        })
    ]
})
class App {

}

export const timelineViewerPort = 9090;
new TimelineViewer(timelineViewerPort);
