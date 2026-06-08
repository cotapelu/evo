import { TUI } from '@earendil-works/pi-tui';
export declare class CountdownTimer {
    private intervalId?;
    private remainingMs;
    private tui;
    private onTick;
    private onExpire;
    constructor(timeoutMs: number, tui: TUI | undefined, onTick: (remainingMs: number) => void, onExpire: () => void);
    start(): void;
    stop(): void;
    dispose(): void;
}
//# sourceMappingURL=countdown-timer.d.ts.map