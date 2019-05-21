import {DbHelperUi, Launcher, PuppeteerWorkerFactory} from "ppspider";
import {WebMonitorTask} from "./tasks/WebMonitorTask";
import {DataViewer} from "./ui/DataViewer";
import {TimelineViewer} from "./timeline-viewer/TimelineViewer";

@Launcher({
    workplace: __dirname + "/workplace",
    dbUrl: "mongodb://192.168.1.150:27017/bilibili",
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
