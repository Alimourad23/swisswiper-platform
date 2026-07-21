# SwissWiper Partner Portal (Orders) — Roadmap & Blueprint

_Status: planning. Nothing built yet. This is the blueprint we build from._

## 1. Vision

A B2B2C partner portal built into the platform. Invite-only partners (interior
designers, redistributors) log in, submit **made-to-measure** requests (shower
type, measurements, finish, delivery), and track each order's progress — while
internally the aggregate of orders becomes a **demand pipeline** that drives
production ("how much to make, by when") and delivery ("where, and when it lands").

It replaces email chaos with a structured, trackable, auditable flow — and becomes
a relationship moat: once partners run their SwissWiper orders through the portal,
we're embedded in their workflow.

## 2. Audiences

- **Partners (external):** interior designers, redistributors. See only their own
  orders. Invite-only, magic-link sign-in (they won't have Google Workspace).
- **Internal (SwissWiper):** Ali, Etienne (production/ops), team. See all orders,
  the production pipeline, and delivery planning. Google sign-in (as today).

## 3. Core experience

### Partner side (the intake form IS the product)
- **Guided order builder:** project & delivery details → add units (shower type
  from a visual catalog; measurements with a diagram of exactly what to measure;
  finish, glass type/thickness, hardware, quantity) → attachments (drawings, site
  photos) → review & submit.
- **Instant confirmation:** order number + confirmation email; status "Under review".
- **Order tracking:** status timeline (Submitted → Quoted → Approved → In production
  → QC → Ready → In transit → Delivered), ETA, delivery destination, line-item specs,
  documents (quote, confirmation, invoice, delivery note), and an in-context message
  thread with the team.
- **My orders dashboard:** all orders at a glance; **reorder/duplicate** a past spec.
- **Notifications:** email + in-app on each status change.
- Measurement accuracy is the #1 risk → guidance, validation ranges, required site
  photo, "measured on site / confirmed" acknowledgment.

### Internal side
- **Order inbox:** triage new submissions; review specs; request clarification
  (same thread); **quote → confirm** → fires emails, moves to production.
- **Production pipeline:** confirmed orders aggregated by required-by date; board by
  stage; auto-generated **spec sheet per unit** for the vendor/workshop.
- **Delivery planning:** group by destination/region/date; attach tracking; mark
  delivered.
- **Partner performance:** volume, on-time, remake rate → informs the discount tier.

## 4. Pricing model

- **Price = f(configuration).** A pricing engine turns each bespoke spec into a
  **list/website price** (base + rate × glass area + finish/hardware surcharges).
- **Partner cost = list price × (1 − partner discount %).** Portal shows both list
  and net so their margin is explicit.
- **Discount % = performance-tiered.** v1: set manually per partner. Later: a
  performance dashboard recommends/auto-sets the tier on a **quarterly** cadence,
  with **guardrails** (min/max, hard margin floor) + audit trail + manual override.
- **Lock pricing at confirmation** so open orders never re-price.
- Keep a **"confirm final quote" safety valve** for specs the engine can't price.
- **MAP / channel integrity:** protect partner margin so our DTC site doesn't
  undercut them. (Decision: is website price their mandated resale price or just
  their cost reference? — leaning "cost reference".)

## 5. Architecture & key decisions

- **Multi-tenancy is the foundation.** Every user belongs to an organization
  (SwissWiper internal, or a partner company). Every order is scoped to an org with
  Supabase **row-level security**. Build this first; **security review** before any
  partner logs in.
- **Partner auth:** magic-link / email OTP (Supabase), invite-only.
- **Same app, role-routed:** partner portal at `/partners`, RLS-isolated — not a
  separate app. Reuses the existing stack (Next.js, Supabase, Vercel) and brand.
- **Luxury, client-facing UI:** this surface reflects the brand (calm, precise;
  "commission" not "buy"; no discount language shown to end-clients).

## 6. Data model (sketch)

- `organizations` (id, name, type: internal|partner, discount_pct, tier, …)
- `org_members` (user_id, org_id, role)
- `orders` (id, org_id, order_number, status, project_name, delivery_address,
  desired_date, list_total, discount_pct, net_total, confirmed_at, …)
- `order_items` (id, order_id, product_type, width_mm, height_mm, depth_mm, glass,
  finish, hardware, quantity, unit_list_price, notes)
- `order_documents` (id, order_id, kind, url)
- `order_events` (id, order_id, status, note, actor, created_at) — the timeline
- `order_messages` (id, order_id, sender_org, body, created_at)
- RLS: partners see rows where org_id ∈ their orgs; internal sees all.

## 7. Phased roadmap

- **Phase 0 — Foundation:** organizations, members, roles, RLS; order schema;
  magic-link partner auth (behind a flag). No user-facing features yet.
- **Phase 1 — Internal Orders:** team creates/sees all orders, advances status.
  Usable day one (log orders that arrive by email today).
- **Phase 2 — Partner Portal:** invite a partner → they log in → order builder →
  submit → confirmation email → track their own orders. Strict isolation.
- **Phase 3 — Pricing & quoting:** config → list price engine; per-partner discount;
  quote → approve → confirm; lock at confirmation.
- **Phase 4 — Production pipeline:** demand aggregation; production board; spec sheets.
- **Phase 5 — Delivery & logistics:** destinations, grouping, tracking, delivered.
- **Phase 6 — Documents, messaging, notifications:** the full trust layer.
- **Phase 7 — Performance tiers:** auto-recommend discount tiers from performance.
- **Phase 8 — API/integration:** for larger partners to push orders programmatically.

## 8. Open decisions (Ali)

1. MAP: is website price a mandated resale price or just the partner's cost reference?
2. Do we want a hard margin floor on the discount, and starting tier bands?
3. Which performance metrics drive the tier (volume / on-time / remakes / growth)?
4. How many partners at launch, and who are the 1–2 pilots?

## 9. Requirements to confirm with Etienne (production / vendor)

_These unlock the configurator, the pricing engine, and the status model. Send this
to Etienne._

**Product & configuration**
- What product types / models do we offer? (list them)
- For each: what measurements does the vendor need? (width/height/depth, others?)
  Units (mm?), and acceptable **min/max** ranges and **tolerances**.
- Glass options (types, thickness), finishes, coatings, hardware, colours.
- Which configurations are **not** feasible (constraints the form must block)?
- Who is responsible for measuring, and what proof do we require (photo, template,
  signed drawing)? Who bears the cost if measurements are wrong?

**Pricing inputs**
- Cost drivers per unit (glass area rate, glass-type surcharge, finish/hardware
  add-ons, complexity). Enough to build a formula.
- Base / website (retail) price list per product.
- Any minimum order quantity (MOQ) or minimum order value.

**Production**
- Real production **stages** (e.g. cutting → tempering → coating → QC → packing) —
  drives the status timeline.
- **Lead time** per product/finish (how many days from confirmation to ready).
- **Capacity** (units/week) so promised dates are realistic; batching rules.
- QC criteria; remake process and typical remake time.

**Delivery / logistics**
- Who ships — vendor direct, our warehouse, or a 3PL? Do we get tracking numbers?
- Packaging, freight constraints, delivery regions, and delivery lead time.
- Any install/handover step, or delivery only?

**Documents**
- What documents must accompany an order (spec sheet, drawings, certificates,
  delivery note)? What exact fields does the vendor need to start production?

## 10. Recommended approach

1. **Validate before you build.** The requirements above (product taxonomy,
   measurements, lead times, pricing drivers) are the real unlock — code is cheap
   once they're known. Confirm with Etienne + pressure-test the intake with 1–2
   friendly pilot partners.
2. **Internal-first, portal-second.** Build Phase 1 (internal order management) so
   the team gets value immediately and we de-risk the model — even if partner
   onboarding slips, we have a working order tracker. Then open the portal on top.
3. **Foundation early, not retrofitted.** Build tenancy + RLS in Phase 0 so security
   isn't bolted on later. Security review before any partner logs in.
4. **Start narrow, prove the loop.** One product type, a few finishes, one pilot
   partner — take a single order from submission → production → delivery end to end,
   then widen the catalog and invite more partners.
5. **Keep pricing simple first.** Manual discount % + a basic price formula; add the
   performance-tier automation once real orders have accrued.
6. **Reuse everything.** Same stack, same brand system, Alfred can later summarise
   "this week's production needs" and "deliveries at risk".

## 11. Risks
- Multi-tenant security (partner data isolation) — highest; needs a review.
- Measurement errors → remakes/cost — mitigate in the intake UX.
- Pricing a bespoke product — start simple, keep a quote safety valve.
- Scope creep (this touches orders + light MRP + logistics + a customer portal) —
  keep v1 tight.

## 12. Pricing engine — the keystone (BUILD FIRST, as a service)

Decision from brainstorm: build the pricing engine **before** the rest of the portal.
It's the highest-uncertainty, highest-leverage, most reusable piece, and it's
independently valuable now as an internal quote tool.

**It's a service, not a page.** One brain, consumed everywhere:
- Internal **quote calculator** (platform) — price a custom order instantly, with margin visibility.
- **Partner portal** — partners see their net price (list − their discount) live.
- **Public website** — an instant-quote configurator that returns a **list price only**
  (partner discounts + cost/margin stay private, behind login), turning the brochure
  site into a conversion funnel; a quote/lead flows back into the platform.
- **Sales / Finance / Alfred** — quote leads, roll up revenue & margin, answer pricing questions.

**Where it lives:** the engine + rate config live in the platform (single source of
truth, secure, editable, auditable) as a shared library `src/lib/pricing/`, exposed via
a **public API** (`/api/pricing/quote`, list-price only) that the website calls. New
internal module **"Pricing"** at `/dashboard/pricing` (founder-only): a Quote calculator,
a Rates editor, and saved Quotes. Same engine, three permission modes: public = sticker,
partner = net, internal = margin.

**v1 parametric model (per unit):**
`price = base + glassArea(m²) × glassRate + finishSurcharge + Σ hardware`, floored at a
minimum, rounded; partner discount applied on the list total with a max-discount guardrail.
Rates are **data-driven & versioned** (edit without redeploy; quotes snapshot the rates
used so history never drifts). Currency: CHF/EUR (TBC).

**Build order (tomorrow):** (1) engine lib + seeded placeholder config, (2) config schema
(pricing_config + quotes), (3) internal calculator UI, (4) rates editor, (5) public
list-price API endpoint (so the website can plug in later).

**Still needed from Etienne (feeds this directly):** product taxonomy, the real cost
drivers (per-m² glass rates by type, finish/hardware surcharges, base/handling, minimums),
and the retail/website price list. See §9.

**Note:** a first `src/lib/pricing/engine.ts` sketch exists (pure, unused, safe to rewrite).
