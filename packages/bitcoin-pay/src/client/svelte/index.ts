import { writable, derived, readable, type Readable } from "svelte/store";
import { BitcoinPayClient } from "../vanilla.js";
import type { PaymentInitData, PaymentStatusData } from "../types.js";

/**
 * Svelte store for initializing a payment from a magic link token
 *
 * @example
 * ```svelte
 * <script>
 * import { createPaymentInit } from '@bitcoin-pay/core/svelte';
 *
 * export let token;
 * const payment = createPaymentInit(token);
 * </script>
 *
 * {#if $payment.isPending}
 *   <p>Loading...</p>
 * {:else if $payment.error}
 *   <p>Error: {$payment.error.message}</p>
 * {:else if $payment.data}
 *   <p>Amount: {$payment.data.amountSats} sats</p>
 *   <p>Address: {$payment.data.address}</p>
 * {/if}
 * ```
 */
export function createPaymentInit(
	token: string,
	client?: BitcoinPayClient,
) {
	const payClient = client || new BitcoinPayClient();

	const { subscribe, set, update } = writable<{
		data: PaymentInitData | null;
		isPending: boolean;
		error: Error | null;
	}>({
		data: null,
		isPending: true,
		error: null,
	});

	const init = async () => {
		try {
			update((state) => ({ ...state, isPending: true, error: null }));
			const result = await payClient.initPayment(token);
			set({ data: result, isPending: false, error: null });
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			set({ data: null, isPending: false, error });
		}
	};

	// Auto-initialize
	init();

	return {
		subscribe,
		refetch: init,
	};
}

/**
 * Svelte store for polling payment status
 *
 * @example
 * ```svelte
 * <script>
 * import { createPaymentStatus } from '@bitcoin-pay/core/svelte';
 *
 * export let intentId;
 * const status = createPaymentStatus(intentId);
 * </script>
 *
 * {#if $status.data}
 *   <p>Status: {$status.data.status}</p>
 *   <p>Confirmations: {$status.data.confs}</p>
 * {/if}
 * ```
 */
export function createPaymentStatus(
	intentId: string,
	options: { intervalMs?: number; client?: BitcoinPayClient } = {},
) {
	const { intervalMs = 3000, client } = options;
	const payClient = client || new BitcoinPayClient();

	const { subscribe, set } = writable<{
		data: PaymentStatusData | null;
	}>({
		data: null,
	});

	let cleanup: (() => void) | null = null;

	// Start polling
	cleanup = payClient.pollStatus(
		intentId,
		(data) => {
			set({ data });
		},
		intervalMs,
	);

	return {
		subscribe,
		stop: () => {
			if (cleanup) {
				cleanup();
				cleanup = null;
			}
		},
	};
}

/**
 * Svelte readable store for countdown timer to payment expiry
 *
 * @example
 * ```svelte
 * <script>
 * import { createExpiryCountdown } from '@bitcoin-pay/core/svelte';
 *
 * export let expiresAt;
 * const countdown = createExpiryCountdown(expiresAt);
 * </script>
 *
 * {#if !$countdown.isExpired}
 *   <p>Time left: {$countdown.minutes}:{$countdown.seconds.toString().padStart(2, '0')}</p>
 * {:else}
 *   <p>Payment expired</p>
 * {/if}
 * ```
 */
export function createExpiryCountdown(expiresAt: Date) {
	return readable(
		{
			secondsLeft: 0,
			minutes: 0,
			seconds: 0,
			isExpired: false,
		},
		(set) => {
			const update = () => {
				const diff = Math.max(
					0,
					Math.floor((expiresAt.getTime() - Date.now()) / 1000),
				);
				const minutes = Math.floor(diff / 60);
				const seconds = diff % 60;
				const isExpired = diff === 0;

				set({ secondsLeft: diff, minutes, seconds, isExpired });
			};

			update();
			const intervalId = setInterval(update, 1000);

			return () => {
				clearInterval(intervalId);
			};
		},
	);
}

/**
 * Svelte store for complete payment flow
 *
 * Combines initialization, status polling, and expiry countdown
 *
 * @example
 * ```svelte
 * <script>
 * import { createPaymentFlow } from '@bitcoin-pay/core/svelte';
 *
 * export let token;
 * const payment = createPaymentFlow(token);
 * </script>
 *
 * {#if $payment.isLoading}
 *   <p>Loading...</p>
 * {:else if $payment.error}
 *   <p>Error: {$payment.error.message}</p>
 * {:else if $payment.initData}
 *   <div>
 *     <p>Amount: {$payment.initData.amountSats} sats</p>
 *     <p>Address: {$payment.initData.address}</p>
 *     <p>Status: {$payment.status}</p>
 *     <p>Confirmations: {$payment.confs}</p>
 *     {#if !$payment.isExpired}
 *       <p>Time left: {$payment.minutes}:{$payment.seconds.toString().padStart(2, '0')}</p>
 *     {/if}
 *   </div>
 * {/if}
 * ```
 */
export function createPaymentFlow(
	token: string,
	options: { intervalMs?: number; client?: BitcoinPayClient } = {},
) {
	const { client } = options;
	const payClient = client || new BitcoinPayClient();

	const initStore = createPaymentInit(token, payClient);
	let statusStore: ReturnType<typeof createPaymentStatus> | null = null;
	let countdownStore: Readable<{
		secondsLeft: number;
		minutes: number;
		seconds: number;
		isExpired: boolean;
	}> | null = null;

	const { subscribe, set, update } = writable<{
		initData: PaymentInitData | null;
		isLoading: boolean;
		error: Error | null;
		status: string | null;
		confs: number;
		txid: string | null;
		secondsLeft: number;
		minutes: number;
		seconds: number;
		isExpired: boolean;
	}>({
		initData: null,
		isLoading: true,
		error: null,
		status: null,
		confs: 0,
		txid: null,
		secondsLeft: 0,
		minutes: 0,
		seconds: 0,
		isExpired: false,
	});

	// Subscribe to init store
	const unsubInit = initStore.subscribe((init) => {
		update((state) => ({
			...state,
			initData: init.data,
			isLoading: init.isPending,
			error: init.error,
		}));

		// Start status polling when we have an intentId
		if (init.data && !statusStore) {
			statusStore = createPaymentStatus(init.data.intentId, options);

			statusStore.subscribe((status) => {
				update((state) => ({
					...state,
					status: status.data?.status || null,
					confs: status.data?.confs || 0,
					txid: status.data?.txid || null,
				}));
			});
		}

		// Start countdown when we have an expiresAt
		if (init.data && !countdownStore) {
			countdownStore = createExpiryCountdown(init.data.expiresAt);

			countdownStore.subscribe((countdown) => {
				update((state) => ({
					...state,
					secondsLeft: countdown.secondsLeft,
					minutes: countdown.minutes,
					seconds: countdown.seconds,
					isExpired: countdown.isExpired,
				}));
			});
		}
	});

	return {
		subscribe,
		refetch: () => {
			initStore.refetch();
		},
		stop: () => {
			unsubInit();
			if (statusStore) {
				statusStore.stop();
			}
		},
	};
}
