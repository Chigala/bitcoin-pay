import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Bitcoin Pay Demo",
	description: "Bitcoin payment processing with Bitcoin Pay SDK",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
