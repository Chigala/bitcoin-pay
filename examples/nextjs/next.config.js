/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		serverComponentsExternalPackages: ['zeromq'],
	},
};

module.exports = nextConfig;
