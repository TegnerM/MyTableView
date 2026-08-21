<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Standing rules for this project (owner: Michael)

- **Michael's machine is Windows and his shell is PowerShell 5.1. It does NOT support `&&`.** Never hand him a bash-style chained command — it fails with "The token '&&' is not a valid statement separator in this version." Give separate lines, or `;` / `if ($?)` chaining. This applies to every command you ever ask him to paste, not just git.
- **Always commit and push automatically.** After completing any code change, run the git commands without being asked. Do this at the end of every completed change, not only when Michael asks. Pushing to the default branch (`master`) deploys via Vercel — that is intended. In PowerShell:

  ```powershell
  git add -A
  git commit -m "<short description>"
  git push
  ```

- If the session has no shell access to this folder (e.g. a cloud session using the device bridge), say so explicitly and give Michael the exact PowerShell commands to paste, or offer to run them via desktop control.
- Prices are IVA-inclusive (21%). Pricing must always be mirrored exactly between the client widgets and `src/lib/booking/create.ts` (server is authoritative).
- Stock/availability is per product per time range (`booking_hour` range overlap). Never introduce a product whose physical stock overlaps another product's units without linking them.
- **Michael edits the catalogue in the admin panel constantly.** Before answering ANY question about products, prices, or stock — or creating catalogue data — query the live `product` and `category` tables first. Never answer from an earlier snapshot, and never create products that might already exist.
- Category 10 = "Cooler boxes": accessories. They are stock-tracked bookable products, offered as add-ons on floating equipment (categories 6-9), and NEVER count toward the bundle discount item count (see COOLER_CATEGORY_ID in create.ts and isAddon in cart.ts).
