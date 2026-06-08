export class CountdownTimer {
    intervalId;
    remainingMs;
    tui;
    onTick;
    onExpire;
    constructor(timeoutMs, tui, onTick, onExpire) {
        this.remainingMs = timeoutMs;
        this.tui = tui;
        this.onTick = onTick;
        this.onExpire = onExpire;
    }
    start() {
        const startTime = Date.now();
        const totalMs = this.remainingMs;
        const tick = () => {
            const elapsed = Date.now() - startTime;
            this.remainingMs = Math.max(0, totalMs - elapsed);
            this.onTick(this.remainingMs);
            if (this.remainingMs <= 0) {
                this.stop();
                this.onExpire();
            }
        };
        tick(); // immediate first tick
        this.intervalId = setInterval(tick, 1000);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }
    dispose() {
        this.stop();
    }
}
//# sourceMappingURL=countdown-timer.js.map