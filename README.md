This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Authentication setup

Apply `database/schema.sql` to your PostgreSQL database, then configure `DATABASE_URL` and a long random `SESSION_SECRET` in the environment before deploying. Authentication uses PostgreSQL for durable accounts and signed, HTTP-only session cookies. In local development without `DATABASE_URL`, accounts are kept in memory and are cleared when the server restarts.

### Merchant accounts

Merchant accounts are provisioned by an operator rather than self-selected during public signup. Run this command in an interactive terminal, replacing the restaurant key and manager name. The password is entered without being echoed or stored in shell history.

```bash
node --env-file=.env.local scripts/provision-merchant.mjs saffron "Restaurant Manager"
```

Restaurant keys are `saffron`, `green`, `fire`, and `bamboo`. The command creates a restaurant-role account tied to that existing profile. The merchant signs in at `/login` with the profile email printed by the command and the password set during provisioning.

In the merchant workspace, create dishes with a starting stock count and optional festival discount. Open a dish with **Edit item** to change its price, stock, or discount, or delete it. Customer prices reflect the discount, unavailable dishes cannot be added to the basket, and checkout decrements stock transactionally.

Platform admins are also provisioned by an operator, never through public signup:

```bash
node --env-file=.env.local scripts/provision-admin.mjs admin@example.com "Platform Admin"
```

The admin signs in at `/login` with the supplied email and the password entered at the hidden prompt.

Delivery staff accounts are provisioned by an operator in the same way:

```bash
node --env-file=.env.local scripts/provision-delivery.mjs driver@example.com "Driver Name"
```

Drivers sign in at `/login` with that email and the password set at the hidden prompt. Their dashboard includes an on-duty toggle and live pickup/active delivery lists.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
