"use client";

import { usePaymentFlow } from "@bitcoin-pay/core/react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

export default function PaymentPage({ params }: { params: { token: string } }) {
	const payment = usePaymentFlow(params.token);
	const [qrCode, setQrCode] = useState<string>("");

	useEffect(() => {
		if (payment.data?.bip21) {
			QRCode.toDataURL(payment.data.bip21).then(setQrCode);
		}
	}, [payment.data?.bip21]);

	if (payment.isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading payment...</p>
				</div>
			</div>
		);
	}

	if (payment.error) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="bg-red-50 border border-red-200 rounded-lg p-6">
					<h2 className="text-red-800 font-bold text-xl mb-2">Error</h2>
					<p className="text-red-600">{payment.error.message}</p>
				</div>
			</div>
		);
	}

	if (!payment.data) return null;

	const getStatusColor = (status: string | null) => {
		switch (status) {
			case "confirmed":
				return "text-green-600";
			case "processing":
				return "text-yellow-600";
			case "expired":
				return "text-red-600";
			default:
				return "text-gray-600";
		}
	};

	const getStatusMessage = (status: string | null) => {
		switch (status) {
			case "confirmed":
				return "Payment confirmed!";
			case "processing":
				return `Payment detected (${payment.confs} confirmations)`;
			case "expired":
				return "Payment expired";
			default:
				return "Awaiting payment";
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 py-12 px-4">
			<div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
				<div className="bg-orange-500 text-white px-6 py-4">
					<h1 className="text-2xl font-bold">Bitcoin Payment</h1>
				</div>

				<div className="p-6">
					{/* Amount */}
					<div className="mb-6 text-center">
						<p className="text-gray-600 text-sm">Amount Due</p>
						<p className="text-4xl font-bold text-gray-900">
							{payment.data.amountSats.toLocaleString()} <span className="text-2xl">sats</span>
						</p>
						<p className="text-gray-500 text-sm mt-1">
							≈ {(payment.data.amountSats / 100_000_000).toFixed(8)} BTC
						</p>
					</div>

					{/* Status */}
					<div className="mb-6 p-4 bg-gray-50 rounded-lg text-center">
						<p className={`font-semibold ${getStatusColor(payment.status)}`}>
							{getStatusMessage(payment.status)}
						</p>
						{payment.txid && (
							<p className="text-xs text-gray-500 mt-2 font-mono break-all">
								{payment.txid}
							</p>
						)}
					</div>

					{/* QR Code */}
					{payment.status === "pending" && qrCode && (
						<div className="mb-6">
							<p className="text-center text-sm text-gray-600 mb-2">Scan with your Bitcoin wallet</p>
							<img src={qrCode} alt="Payment QR Code" className="mx-auto" />
						</div>
					)}

					{/* Address */}
					{payment.status === "pending" && (
						<div className="mb-6">
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Or send to this address:
							</label>
							<div className="bg-gray-100 p-3 rounded font-mono text-sm break-all">
								{payment.data.address}
							</div>
							<button
								onClick={() => navigator.clipboard.writeText(payment.data!.address)}
								className="mt-2 text-sm text-orange-600 hover:text-orange-700"
							>
								Copy address
							</button>
						</div>
					)}

					{/* Timer */}
					{payment.status === "pending" && !payment.isExpired && (
						<div className="text-center text-sm text-gray-600">
							Time remaining:{" "}
							<span className="font-mono font-bold">
								{payment.minutes}:{payment.seconds.toString().padStart(2, "0")}
							</span>
						</div>
					)}

					{/* Expired */}
					{payment.isExpired && payment.status === "pending" && (
						<div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
							<p className="text-red-800 font-semibold">This payment link has expired</p>
							<p className="text-red-600 text-sm mt-1">Please request a new payment link</p>
						</div>
					)}

					{/* Confirmed */}
					{payment.status === "confirmed" && (
						<div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
							<svg
								className="mx-auto h-12 w-12 text-green-600 mb-2"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M5 13l4 4L19 7"
								/>
							</svg>
							<p className="text-green-800 font-semibold">Payment Complete!</p>
							<p className="text-green-600 text-sm mt-1">Thank you for your payment</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
