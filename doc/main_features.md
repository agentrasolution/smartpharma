# Pharmacy ERP: Main Feature List 

**Scope:** Strictly pharmacy retail, inventory, purchasing and dispensing. This is not a general ERP like Odoo or SAP. **Platforms:** Web, desktop (offline-first) and mobile, multi-tenant. **Note:** Verify every regulatory detail against the regulators' own documentation and with qualified legal and tax advisors before building or selling.

---

## A. Foundation (everything depends on it)

- Multi-tenant setup with per-tenant jurisdiction settings: country, currency, tax rules, languages, active integrations
- Roles and permissions (start with a few roles) and 2FA
- Append-only audit log, soft deletes on financial records, Decimal money
- Offline-first desktop app with a sync queue and visible sync status
- Arabic and English, RTL layout, Hijri dates, SAR and AED
- Deployment that can run in-country per tenant, because KSA and UAE health data hosting rules apply

## B. Drug master data

- Local drug lists with Arabic and English names
- Generic-to-brand links and barcodes
- Rx, OTC and controlled flags
- Regulated price updates

## C. Inventory and batch lifecycle

- Multi-unit conversion (box, strip, tablet), stored in the smallest unit
- Batch and lot tracking with expiry dates, plus FEFO suggestions at the counter
- GS1 DataMatrix scanning (serial-level where regulators require it)
- Expiry dashboard (30, 60 and 90 days), dead stock and reorder points
- Stock adjustments with reason codes and an approver, plus stocktaking
- Recall blocking by batch or serial

## D. Purchasing and suppliers

- Direct supplier invoice entry, with optional PO, GRN and invoice flow
- Supplier ledger (what you owe each distributor)
- Supplier returns and credit notes, including near-expiry returns
- Batch cost captured at receiving

## E. Dispensing

- Prescription capture (manual first, e-prescription later)
- Pharmacist verification and brand-to-generic substitution
- Controlled-drug register and dispensing records
- Partial fills

## F. Point of sale and shifts

- Fast search by barcode, Arabic or English name, or code
- Split payments, with the insurer's share recorded as a receivable, not cash
- Customer returns
- Shifts with opening cash, cash drops and X/Z reports
- Receipt and label printing, scanner support

## G. Multi-branch

- Central catalog with branch stock levels
- Branch price overrides only where pricing rules allow them
- Transfers with approval, where batch, expiry and cost travel with the stock
- Cross-branch stock visibility with a "last updated" time

## H. Customers

- Patient profiles and chronic-refill reminders
- Arrears ledger for regular customers
- Consent management, since this is health data

## I. Costing and reports

- Cost stored on each sale line at the moment of sale (batch-level cost of goods)
- Margin by drug, category, supplier and branch
- Loss reports (expiry, adjustments, returns) and stock valuation
- Simple profit and loss, with a configurable VAT rate per drug category
- Exports for the owner's accountant

## J. Compliance layer (per-country adapters)

**KSA**

- ZATCA e-invoicing (Phase 2)
- SFDA RSD drug track-and-trace
- Wasfaty e-prescriptions
- NPHIES insurance claims (one integration; no per-insurer connectors)

**UAE**

- Tatmeen track-and-trace
- Emirate health exchanges: NABIDH (Dubai), Malaffi (Abu Dhabi), Riayati (federal)
- Claims platforms per emirate (Shafafiya in Abu Dhabi; confirm the Dubai platform)
- E-invoicing through an accredited service provider (B2B first; B2C currently out of scope)

**Both**

- Compliance dashboard: submission queues, statuses, retries and errors

## K. Later, after live customers

Patient mobile app, WhatsApp notifications, drug-interaction checks, home delivery, loyalty, AI forecasting, telemedicine, white-labeling.

**Early mobile app scope:** owner and manager tasks only: dashboards, expiry alerts, stock lookup, approvals.

---

## Key decisions still open

1. Tenancy model: row-level with RLS, or schema-per-tenant (prototype both).
2. Offline design for ZATCA: which device holds the signing key and invoice counter.
3. Where each tenant's data is hosted, per country (get legal advice).
4. Drug master data source and update process.
5. Whether a local entity or a design-partner pharmacy is needed to obtain government API access.