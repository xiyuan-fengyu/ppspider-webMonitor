export class DelayExecutor {

    private action: any;

    private delay: number;

    private maxDelay: number;

    private args: any[];

    constructor(action: any, delay: number = 1000 / 60 * 5, maxDelay: number = 1000) {
        this.action = action;
        this.delay = delay;
        this.maxDelay = maxDelay;
    }

    private curTaskId = null;
    private firstTaskTime = null;
    delayExecute(...args: any[]) {
        this.args = args;
        if (this.firstTaskTime == null) {
            this.firstTaskTime = new Date().getTime();
        }
        const taskId = this.curTaskId = new Date().getTime() + "_" + (Math.random() * 10000).toFixed();
        setTimeout(() => {
            if (this.curTaskId == taskId || new Date().getTime() - this.firstTaskTime >= this.maxDelay) {
                this.execute();
                this.firstTaskTime = null;
            }
        }, this.delay);
    }


    private execute() {
        this.action(...this.args);
    }

}
