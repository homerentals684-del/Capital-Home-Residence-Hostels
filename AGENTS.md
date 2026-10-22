<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules
- Images (logo, building photo) are bundled project files imported via Vite (`src/assets/logo.png`, `src/assets/building.webp`), never `.asset.json` CDN pointers — external deployments (GitHub → Vercel) can't serve Lovable's `/__l5e/` asset paths.
- Roles live in public.user_roles checked via has_role(); never trust client role checks — admin gating is enforced by RLS.
- Registration approval/rejection runs in security-definer SQL functions (approve_registration / reject_registration) so capacity checks, tenancy creation and rent charges happen atomically.
- Money is stored as integer cents (KES); format with ksh() in src/lib/format.ts.
- Rent charges snapshot the room price at approval time; later price edits don't alter existing charges.
- Profile photos live in the private `avatars` bucket under `<user_id>/`; display via signed URLs.
- Paystack payments: attempts are separate from verified payments; only finalize_payment() (service role, after Paystack verify API) changes balances.
- Both hosts use the authenticated `/api/public/payments` HTTP service on Lovable for start/status/admin reconciliation; Vercel browsers forward only their bearer session to the fixed trusted host because Lovable service-role credentials are not exportable. Preserve explicit CORS origins, token validation, ownership checks and admin authorization.
- Shared payment operations live in a server-only service reused by HTTP and server-function wrappers so settlement rules cannot diverge between hosts.
