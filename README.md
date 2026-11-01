# Capital Home Residence Hostels

use these images for references, use that logo as the site title icon and social image and also as the site logo. use that image containing the building as the image background where needed. use the prompt provided to generate and build a professional site.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://capital-home-residence-hostels.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f75de88d-4c49-43a5-9d77-d7cd290225f7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Payments on Lovable and Vercel

The Vercel payment page calls the secured payment service on the stable Lovable production host. Lovable retains the Paystack secret and private database credentials; do not copy them into GitHub or browser environment variables. Start, confirmation polling and administrator re-checks all use this service. Both websites read the same payment history and receipts.

Deployment order:
1. Publish the updated Lovable app first to deploy `/api/public/payments`.
2. Push the updated code to GitHub and redeploy Vercel. No extra payment secret is required on Vercel. Keep the existing public login configuration pointing to the same Lovable Cloud project.
3. Keep Paystack's **Live** webhook set to `https://project--f75de88d-4c49-43a5-9d77-d7cd290225f7.lovable.app/api/public/paystack-webhook`.
4. Sign in as an approved tenant on each site and make an authorized small partial payment. Confirm the receipt and balance on both sites. A live payment requires the payer's phone approval; automated checks do not send live STK requests.

Only the explicit production/preview origins in `src/lib/payment-contract.ts` may call the service. Add future custom domains there deliberately; never allow arbitrary origins or forward session tokens to a user-supplied host.

## SMS on Lovable and Vercel

Publish Lovable first to deploy `/api/public/sms`, then redeploy the synced GitHub code on Vercel. The Vercel SMS page forwards only the signed-in admin's bearer token to the trusted Lovable host; no SMS secrets belong in GitHub or Vercel browser settings. `AFRICASTALKING_API_KEY` and `AFRICASTALKING_USERNAME` are configured as server secrets on Lovable. Only the production messaging endpoint is used.

Select one tenant, send a paid test SMS with confirmation, and check History for the provider response and cost. Bulk sending is blocked until a successful provider-accepted test is logged. “Sent” means Africa's Talking accepted the message, not confirmed handset delivery; ask the recipient to confirm receipt. No schedule or automatic sending is enabled.
