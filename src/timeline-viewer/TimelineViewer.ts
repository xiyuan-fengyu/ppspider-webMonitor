import {Server as HttpServer} from "http";
import {logger} from "ppspider";

export class TimelineViewer {

    private webRoot = __dirname + "/../../src/timeline-viewer/web";

    private http: HttpServer;

    constructor(private port: number) {
        if (this.http != null) return;

        const express = require("express");
        const app = express();
        app.use(express.static(this.webRoot));

        this.http = require("http").Server(app);

        this.http.listen(port, () => {
            logger.info("The timeline-viewer ui server started successfully");
        });
    }

}
