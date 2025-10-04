"use client";

import { useState } from "react";

export default function HomePage() {
	const [email, setEmail] = useState("");
	const [amount, setAmount] = useState("50000");
	const [memo, setMemo] = useState("Test payment");
	const [paymentUrl, setPaymentUrl] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const createPayment = async () => {
		try {
			setIsLoading(true);
			setError("");
			setPaymentUrl("");

			// Create payment intent
			const intentRes = await fetch("/api/pay/intents", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email,
					amountSats: parseInt(amount),
					memo,
				}),
			});

			if (!intentRes.ok) {
				throw new Error(await intentRes.text());
			}

			const intent = await intentRes.json();

			// Create magic link
			const linkRes = await fetch(`/api/pay/intents/${intent.id}/magic-link`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ttlHours: 24 }),
			});

			if (!linkRes.ok) {
				throw new Error(await linkRes.text());
			}

			const { url } = await linkRes.json();
			setPaymentUrl(url);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create payment");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 py-12 px-4">
			<div className="max-w-2xl mx-auto">
				<div className="bg-white rounded-lg shadow-lg p-8">
					<h1 className="text-3xl font-bold text-gray-900 mb-8">
						Bitcoin Pay Demo
					</h1>

					<div className="space-y-6">
						{/* Email */}
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Email (optional)
							</label>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
								placeholder="customer@example.com"
							/>
						</div>

						{/* Amount */}
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Amount (sats)
							</label>
							<input
								type="number"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
								placeholder="50000"
							/>
							<p className="mt-1 text-sm text-gray-500">
								≈ {(parseInt(amount || "0") / 100_000_000).toFixed(8)} BTC
							</p>
						</div>

						{/* Memo */}
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Memo (optional)
							</label>
							<input
								type="text"
								value={memo}
								onChange={(e) => setMemo(e.target.value)}
								className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
								placeholder="What is this payment for?"
							/>
						</div>

						{/* Submit */}
						<button
							onClick={createPayment}
							disabled={isLoading || !amount}
							className="w-full bg-orange-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
						>
							{isLoading ? "Creating..." : "Create Payment Link"}
						</button>

						{/* Error */}
						{error && (
							<div className="bg-red-50 border border-red-200 rounded-lg p-4">
								<p className="text-red-800 text-sm">{error}</p>
							</div>
						)}

						{/* Success */}
						{paymentUrl && (
							<div className="bg-green-50 border border-green-200 rounded-lg p-6">
								<h2 className="font-semibold text-green-900 mb-3">
									Payment Link Created! 🎉
								</h2>
								<div className="bg-white border border-green-300 rounded p-3 mb-4">
									<p className="text-sm font-mono text-gray-800 break-all">
										{paymentUrl}
									</p>
								</div>
								<div className="flex gap-3">
									<button
										onClick={() => navigator.clipboard.writeText(paymentUrl)}
										className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition text-sm"
									>
										Copy Link
									</button>
									<a
										href={paymentUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition text-center text-sm"
									>
										Open Payment Page
									</a>
								</div>
							</div>
						)}
					</div>

					{/* Info */}
					<div className="mt-8 p-4 bg-gray-50 rounded-lg">
						<h3 className="font-semibold text-gray-900 mb-2">How it works:</h3>
						<ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
							<li>Create a payment intent with amount and optional email/memo</li>
							<li>Get a magic link that's valid for 24 hours</li>
							<li>Send the link to your customer</li>
							<li>Customer pays with their Bitcoin wallet</li>
							<li>Payment is tracked automatically via blockchain</li>
							<li>Get notified when payment is confirmed</li>
						</ol>
					</div>
				</div>

				{/* API Docs */}
				<div className="mt-8 bg-white rounded-lg shadow-lg p-8">
					<h2 className="text-2xl font-bold text-gray-900 mb-4">API Endpoints</h2>
					<div className="space-y-4 text-sm">
						<div>
							<code className="bg-gray-100 px-2 py-1 rounded text-green-600">
								POST /api/pay/intents
							</code>
							<p className="text-gray-600 mt-1">Create a payment intent</p>
						</div>
						<div>
							<code className="bg-gray-100 px-2 py-1 rounded text-green-600">
								POST /api/pay/intents/:id/magic-link
							</code>
							<p className="text-gray-600 mt-1">Create magic link for intent</p>
						</div>
						<div>
							<code className="bg-gray-100 px-2 py-1 rounded text-blue-600">
								GET /api/pay/pay/:token
							</code>
							<p className="text-gray-600 mt-1">Initialize payment from magic link</p>
						</div>
						<div>
							<code className="bg-gray-100 px-2 py-1 rounded text-blue-600">
								GET /api/pay/status?intentId=xxx
							</code>
							<p className="text-gray-600 mt-1">Get payment status</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
