import { TUI } from '@earendil-works/pi-tui';

export class CountdownTimer {
	private intervalId?: any;
	private remainingMs: number;
	private tui: TUI | undefined;
	private onTick: (remainingMs: number) => void;
	private onExpire: () => void;

	constructor(timeoutMs: number, tui: TUI | undefined, onTick: (remainingMs: number) => void, onExpire: () => void) {
		this.remainingMs = timeoutMs;
		this.tui = tui;
		this.onTick = onTick;
		this.onExpire = onExpire;
	}

	start(): void {
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

	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = undefined;
		}
	}

	dispose(): void {
		this.stop();
	}
}
