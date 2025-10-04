# Bitcoin Pay

A comprehensive Bitcoin payment SDK for TypeScript, featuring magic links, live status tracking, and webhooks.

## Features

- 🔗 **Magic Link Payments** - Email-based payment flow with secure signed tokens
- 📡 **Live Status Updates** - Real-time payment tracking via polling or SSE
- 🔔 **Event Webhooks** - Idempotent webhooks for processing, confirmed, expired events
- 🔌 **Plugin System** - Extensible architecture for subscriptions, refunds, and more
- 🗄️ **Multiple Adapters** - Support for Prisma, Drizzle, and custom storage
- 🌐 **Framework Agnostic** - Works with Next.js, Nuxt, SvelteKit, etc.
- 🔐 **Watch-Only** - No private keys required; secure address derivation

## Packages

- `@bitcoin-pay/core` - Core SDK with server and client libraries
- `@bitcoin-pay/cli` - CLI tool for migrations and schema generation

## Quick Start

```bash
npm install @bitcoin-pay/core
```

See [documentation](./docs) for detailed setup and usage.

## Architecture

Inspired by [Better Auth](https://github.com/better-auth/better-auth), this SDK follows similar patterns for:

- Plugin system
- Database adapters
- Client hooks (React, Vue, Svelte)
- Type-safe APIs

## License

MIT
