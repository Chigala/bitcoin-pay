import { ref, onMounted, onUnmounted, computed, type Ref } from "vue";
import { BitcoinPayClient } from "../vanilla.js";
import type { PaymentInitData, PaymentStatusData } from "../types.js";

/**
 * Vue composable for initializing a payment from a magic link token
 *
 * @example
 * ```vue
 * <script setup>
 * import { usePaymentInit } from '@bitcoin-pay/core/vue';
 *
 * const props = defineProps<{ token: string }>();
 * const { data, isPending, error } = usePaymentInit(props.token);
 * </script>
 * ```
 */
export function usePaymentInit(
	token: string | Ref<string>,
	client?: BitcoinPayClient,
) {
	const payClient = client || new BitcoinPayClient();
	const tokenRef = ref(token);

	const data = ref<PaymentInitData | null>(null);
	const isPending = ref(true);
	const error = ref<Error | null>(null);

	const init = async () => {
		try {
			isPending.value = true;
			error.value = null;
			const result = await payClient.initPayment(tokenRef.value);
			data.value = result;
		} catch (err) {
			error.value = err instanceof Error ? err : new Error(String(err));
		} finally {
			isPending.value = false;
		}
	};

	onMounted(() => {
		init();
	});

	return { data, isPending, error, refetch: init };
}

/**
 * Vue composable for polling payment status
 *
 * @example
 * ```vue
 * <script setup>
 * import { usePaymentStatus } from '@bitcoin-pay/core/vue';
 *
 * const props = defineProps<{ intentId: string }>();
 * const { status, confs, txid, data } = usePaymentStatus(props.intentId);
 * </script>
 * ```
 */
export function usePaymentStatus(
	intentId: string | Ref<string | null>,
	options: { intervalMs?: number; client?: BitcoinPayClient } = {},
) {
	const { intervalMs = 3000, client } = options;
	const payClient = client || new BitcoinPayClient();
	const intentIdRef = ref(intentId);

	const data = ref<PaymentStatusData | null>(null);

	let cleanup: (() => void) | null = null;

	const startPolling = () => {
		if (!intentIdRef.value) return;

		cleanup = payClient.pollStatus(
			intentIdRef.value,
			(newData) => {
				data.value = newData;
			},
			intervalMs,
		);
	};

	const stopPolling = () => {
		if (cleanup) {
			cleanup();
			cleanup = null;
		}
	};

	onMounted(() => {
		startPolling();
	});

	onUnmounted(() => {
		stopPolling();
	});

	const status = computed(() => data.value?.status || null);
	const confs = computed(() => data.value?.confs || 0);
	const txid = computed(() => data.value?.txid || null);

	return { status, confs, txid, data };
}

/**
 * Vue composable for countdown timer to payment expiry
 *
 * @example
 * ```vue
 * <script setup>
 * import { useExpiryCountdown } from '@bitcoin-pay/core/vue';
 *
 * const expiresAt = ref(new Date(Date.now() + 3600000));
 * const { secondsLeft, minutes, seconds, isExpired } = useExpiryCountdown(expiresAt);
 * </script>
 *
 * <template>
 *   <div v-if="!isExpired">
 *     Time left: {{ minutes }}:{{ seconds.toString().padStart(2, '0') }}
 *   </div>
 *   <div v-else>Payment expired</div>
 * </template>
 * ```
 */
export function useExpiryCountdown(expiresAt: Date | Ref<Date | null>) {
	const expiresAtRef = ref(expiresAt);
	const secondsLeft = ref(0);

	const update = () => {
		if (!expiresAtRef.value) {
			secondsLeft.value = 0;
			return;
		}

		const diff = Math.max(
			0,
			Math.floor((expiresAtRef.value.getTime() - Date.now()) / 1000),
		);
		secondsLeft.value = diff;
	};

	let intervalId: ReturnType<typeof setInterval> | null = null;

	onMounted(() => {
		update();
		intervalId = setInterval(update, 1000);
	});

	onUnmounted(() => {
		if (intervalId !== null) {
			clearInterval(intervalId);
		}
	});

	const minutes = computed(() => Math.floor(secondsLeft.value / 60));
	const seconds = computed(() => secondsLeft.value % 60);
	const isExpired = computed(() => secondsLeft.value === 0);

	return { secondsLeft, minutes, seconds, isExpired };
}

/**
 * Vue composable for complete payment flow
 *
 * Combines initialization, status polling, and expiry countdown
 *
 * @example
 * ```vue
 * <script setup>
 * import { usePaymentFlow } from '@bitcoin-pay/core/vue';
 *
 * const props = defineProps<{ token: string }>();
 * const payment = usePaymentFlow(props.token);
 * </script>
 *
 * <template>
 *   <div v-if="payment.isLoading">Loading...</div>
 *   <div v-else-if="payment.error">Error: {{ payment.error.message }}</div>
 *   <div v-else-if="payment.data">
 *     <p>Amount: {{ payment.data.amountSats }} sats</p>
 *     <p>Address: {{ payment.data.address }}</p>
 *     <p>Status: {{ payment.status }}</p>
 *     <p>Confirmations: {{ payment.confs }}</p>
 *     <p v-if="!payment.isExpired">
 *       Time left: {{ payment.minutes }}:{{ payment.seconds.toString().padStart(2, '0') }}
 *     </p>
 *   </div>
 * </template>
 * ```
 */
export function usePaymentFlow(
	token: string | Ref<string>,
	options: { intervalMs?: number; client?: BitcoinPayClient } = {},
) {
	const { client } = options;

	const {
		data: initData,
		isPending: isLoading,
		error,
		refetch,
	} = usePaymentInit(token, client);

	const intentId = computed(() => initData.value?.intentId || null);
	const expiresAt = computed(() => initData.value?.expiresAt || null);

	const { status, confs, txid, data: statusData } = usePaymentStatus(
		intentId,
		options,
	);

	const { secondsLeft, minutes, seconds, isExpired } =
		useExpiryCountdown(expiresAt);

	return {
		// Init data
		data: initData,
		isLoading,
		error,
		refetch,

		// Status
		status,
		confs,
		txid,
		statusData,

		// Expiry
		secondsLeft,
		minutes,
		seconds,
		isExpired,
	};
}
