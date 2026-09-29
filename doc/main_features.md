# SmartPharma ERP — Main Features
> **Market:** Kingdom of Saudi Arabia 🇸🇦 (Phase 1) → UAE 🇦🇪 (Phase 2)
> **Strategy:** KSA-first. One market at a time. Real pharmacies live before adding scope.
> **Last updated:** September 2026

---

## Table of Contents

1. [What This Document Is](#1-what-this-document-is)
2. [KSA Mandatory Government Integrations](#2-ksa-mandatory-government-integrations)
3. [Inventory & Supply Chain](#3-inventory--supply-chain)
4. [Dispensing & POS](#4-dispensing--pos)
5. [Insurance & Revenue Cycle](#5-insurance--revenue-cycle)
6. [Compliance Dashboard](#6-compliance-dashboard)
7. [Multi-Tenancy & Chain Management](#7-multi-tenancy--chain-management)
8. [User Management & RBAC](#8-user-management--rbac)
9. [Localisation](#9-localisation)
10. [Security & Data Compliance](#10-security--data-compliance)
11. [Reporting & Analytics](#11-reporting--analytics)
12. [Infrastructure & Hosting](#12-infrastructure--hosting)
13. [Features Deliberately Deferred](#13-features-deliberately-deferred)
14. [Build Sequence](#14-build-sequence)
15. [Things to Verify Before Shipping](#15-things-to-verify-before-shipping)

---

## 1. What This Document Is

This is the **authoritative feature list** for SmartPharma. It reflects corrections made after a detailed critique of an earlier draft. Where the earlier draft made overstatements or errors, those are corrected here and the reason is noted inline.

**What this document is not:**
- A complete backlog. Every feature listed here needs to be broken into tasks before development.
- A legal or tax opinion. Items marked ⚠️ **Verify with professional** require a KSA-licensed lawyer or tax advisor before implementation.
- Final. Regulations in KSA and UAE change frequently. Review government portals before starting each integration.

---

## 2. KSA Mandatory Government Integrations

These are legal requirements. A pharmacy cannot operate compliantly without them. They are not optional features.

**Critical sequencing note:** Each integration below requires sandbox registration, conformance testing, and production onboarding that takes 6–12 weeks. Register on all portals **in Month 1 of development**, even if the code is not ready until Month 6.

---

### 2.1 ZATCA Phase 2 — e-Invoicing (Fatoorah)

**Enforced by:** Zakat, Tax and Customs Authority (ZATCA)  
**Penalty:** Fines and operational suspension

Every sale must produce a ZATCA-compliant e-invoice. There are two distinct flows:

| Sale Type | Invoice Type | ZATCA Flow |
|-----------|-------------|------------|
| Patient / OTC (B2C) | Simplified Tax Invoice | Generate QR code; **report to ZATCA within 24 hours** |
| Insurance / Corporate (B2B) | Standard Tax Invoice | **Real-time clearance with ZATCA before issuing** to the buyer |

**Technical requirements per invoice:**
- Format: UBL 2.1 XML with embedded PDF/A-3
- `UUID` — universally unique identifier per invoice
- `ICV` — invoice counter value (sequential, never resets)
- `PIH` — previous invoice hash (chains invoices for tamper detection)
- `CSID` — cryptographic stamp identifier obtained from ZATCA onboarding

**VAT rate:** ⚠️ **Verify with a KSA tax advisor.** Do not hardcode 15% for all drug categories. Make the VAT rate configurable per drug category. Some pharmaceutical categories may be zero-rated; zero-rated and exempt are not the same — zero-rated preserves the pharmacy's input VAT recovery, exempt does not.

**Important:** ZATCA e-invoicing and NPHIES insurance claims are **separate, independent pipelines** that both fire on a single insurance transaction. ZATCA handles the invoice; NPHIES handles the claim. Do not conflate them.

---

### 2.2 SFDA RSD / DTTS — Drug Track & Trace

**Enforced by:** Saudi Food & Drug Authority (SFDA)  
**Purpose:** Anti-counterfeiting, drug recall management, supply chain visibility

Every pharmaceutical unit received into stock and dispensed to a patient must be tracked at the serialised unit level using GS1 2D DataMatrix barcodes.

**What the DataMatrix encodes:**
- GTIN (Global Trade Item Number)
- Serial number
- Batch / lot number
- Expiry date

**System requirements:**
- Scan DataMatrix on every goods receipt (GRN). Reject unreadable or unverified units.
- Store serialised unit records (not just batch-level). Each physical pack has a record.
- Report dispensing events to SFDA RSD API in real-time at the point of sale.
- Receive drug recall alerts from SFDA. Automatically block dispensing of recalled serial numbers.
- Surface SFDA submission status on the [Compliance Dashboard](#6-compliance-dashboard).

---

### 2.3 Wasfaty — National e-Prescription Platform

**Run by:** Ministry of Health (MOH)  
**Used by:** All MOH hospitals and government health facilities

**System requirements:**
- Pull electronic prescriptions from Wasfaty API using patient ID or prescription code.
- Display prescription in the pharmacist review screen before dispensing.
- Record dispensing event back to Wasfaty API on completion.
- Handle partial dispensing: record the shortfall, notify the patient when stock arrives.
- Handle prescription expiry: block dispensing of expired prescriptions.
- Handle cancellations received from Wasfaty.
- Surface Wasfaty queue and error status on the [Compliance Dashboard](#6-compliance-dashboard).

---

### 2.4 NPHIES — Insurance Claims Platform

**Run by:** Council of Health Insurance (CHI)  
**Protocol:** HL7 FHIR R4.0.1 (mandatory)  
**Coding standards:** ICD-10-AM for diagnosis, SFDA GTIN for drugs, UCUM for units

**Important correction:** NPHIES is the **single gateway** for all provider-to-insurer claims in KSA. You integrate once with NPHIES. Individual payer APIs (Bupa Arabia, Tawuniya, etc.) are not required — payers receive claims via NPHIES on their side.

**Full claim lifecycle the system must handle:**

```
1. Eligibility Check
   Patient presents insurance card → query NPHIES before dispensing
   Display: covered drugs, co-payment %, benefit limits, deductibles, pre-auth requirements

2. Prior Authorization (where required)
   Submit pre-auth request to NPHIES
   Block dispensing until approved, or dispense with pharmacist override + documentation

3. Claim Submission
   Generate HL7 FHIR R4 claim bundle after dispensing
   Submit to NPHIES → receive claim ID + acknowledgement

4. Status Tracking
   Poll or receive callbacks: Submitted → Under Review → Approved / Rejected

5. Denial Management
   Categorise by denial reason code
   One-click re-submission with correction
   Track denial rate by drug category and reason code

6. Payment Reconciliation
   Receive remittance / EOB from payer via NPHIES
   Match payment to open AR items
   Flag discrepancies for review

7. Write-off Management
   Approve write-offs with dual-control sign-off
```

- Surface NPHIES queue, claim status, and AR aging on the [Compliance Dashboard](#6-compliance-dashboard).

---

## 3. Inventory & Supply Chain

This is the data foundation for every government report. It must be correct before any compliance integration is built.

### 3.1 Drug Master

- Drug records with: Arabic name, English name, SFDA GTIN, barcode, category, unit, form (tablet / syrup / injection / etc.), storage requirements (ambient / cold chain)
- Supplier-drug mapping: which suppliers carry each drug, at what price
- Reorder level and reorder quantity per drug per branch

### 3.2 Goods Receipt (GRN)

- Scan GS1 DataMatrix on every received unit → auto-populate batch, lot, expiry from barcode
- Three-way matching: Purchase Order → GRN → Supplier Invoice
- Reject units where DataMatrix is unreadable or SFDA verification fails
- Cold chain flag: prompt for temperature log on receipt of cold-chain items

### 3.3 Batch & Lot Tracking

- Every stock movement (receipt, dispense, transfer, adjustment, return) records batch + lot number
- Mandatory. Cannot be skipped or bypassed.
- Enables drug recall: given a recalled batch, identify all units in stock and all units already dispensed to patients.

### 3.4 Expiry Management

- Expiry stored as `DateTime` (not a string — existing bug to fix)
- FEFO (First Expired, First Out) enforced at dispense: system presents the earliest-expiring batch. Dispensing a later-expiring batch requires supervisor override with reason code.
- Automated internal alerts at: 90 days / 60 days / 30 days / 7 days before expiry
- Near-expiry report: all drugs expiring within a configurable window, with stock quantity and branch

### 3.5 Stock Adjustments

- Every adjustment records: reason code, quantity delta, batch, user, timestamp, approver
- Reason codes: damaged, stocktake variance, expired disposal, supplier return, theft/loss
- Dual-control: adjustments above a configurable threshold require a second approver

### 3.6 Inter-Branch Transfers

- Initiate transfer request from branch A to branch B
- Head office or branch manager approval
- Dispatch record (batch, quantity, driver/carrier)
- Receipt confirmation at destination branch
- Stock moves only when receiving branch confirms

### 3.7 Purchase Orders & Suppliers

- Supplier management: contact details, payment terms, lead times, performance history
- Automated PO generation when stock hits reorder point
- PO sent to supplier via email (WhatsApp integration added post-launch)
- GRN links back to PO for three-way matching
- Supplier performance: on-time delivery %, price variance vs. agreed price

### 3.8 Multi-Branch Stock Visibility

- Head office dashboard: total stock value and quantities across all branches
- Branch-level stock screen: only shows own branch
- Low-stock alerts visible at head office level
- Suggested inter-branch transfer when one branch is overstocked and another is below reorder

---

## 4. Dispensing & POS

### 4.1 Prescription Queue

```
Prescription arrives (Wasfaty API pull / manual pharmacist entry / paper scan)
        ↓
Pharmacist Review Screen
  - Drug name, dosage, quantity, prescriber details
  - Patient allergy flags (from patient record)
  - Insurance eligibility check (auto-fires against NPHIES)
        ↓
Prior Auth required? → Submit → Wait for approval
        ↓
Dispense Screen
  - Scan each unit (GS1 DataMatrix)
  - SFDA verification on scan
  - FEFO check: is this the correct batch to dispense?
  - Block if recalled serial number
        ↓
Patient Counselling Checklist (pharmacist confirms)
        ↓
Checkout
  - Co-payment collected (cash / card)
  - ZATCA invoice generated (B2B clearance or B2C reporting)
  - Dispensing event reported to SFDA RSD
  - Dispensing event reported to Wasfaty
```

### 4.2 POS Terminal

- Touch-optimised interface for counter use on desktop (Electron)
- Drug search: Arabic name, English name, barcode scan, SFDA code
- Customer lookup: mobile number, national ID, insurance card number
- Multi-tender payments:
  - Cash (SAR)
  - Insurance split: co-payment in cash / card, remainder claimed to insurer via NPHIES
  - mada (debit) via Moyasar payment terminal integration
  - Visa / Mastercard via Moyasar
  - STC Pay via Moyasar
- Customer-facing display: shows itemised bill in Arabic and English
- Thermal receipt printing — ZATCA-stamped receipt replaces any non-compliant receipt from earlier phases
- Refund / exchange with mandatory reason code and supervisor approval above a configurable threshold

### 4.3 Offline Mode

**This is a critical feature for the desktop app, not optional.**

- Pharmacists can continue selling when internet connectivity is lost
- All transactions saved locally with full detail
- Government submissions (ZATCA, SFDA, Wasfaty, NPHIES) queued locally with timestamps
- On reconnect: queue drains automatically; ZATCA 24-hour B2C reporting window must be respected
- Offline indicator clearly visible to all staff at all times
- Conflict resolution: if two terminals process the same batch unit offline, flag on sync for pharmacist review

### 4.4 OTC Sales (No Prescription)

- Standard POS flow without prescription queue
- SFDA DataMatrix scan still required for every serialised unit
- ZATCA B2C simplified invoice generated on checkout

---

## 5. Insurance & Revenue Cycle

See [Section 2.4](#24-nphies--insurance-claims-platform) for the full NPHIES integration. This section covers the operational features built on top of that integration.

### 5.1 Insurance Card Management

- Store patient insurance details: card number, payer, policy number, validity dates
- Auto-alert when insurance card is expired at checkout

### 5.2 Real-Time Eligibility Display

On insurance card swipe or patient lookup, display to pharmacist:
- Covered / not covered status
- Active co-payment percentage
- Remaining benefit limits (if returned by NPHIES)
- Drugs that require prior authorisation
- Card expiry date

### 5.3 AR Aging Dashboard

- Outstanding claims grouped by payer and age bucket: 0–30 / 31–60 / 61–90 / 90+ days
- Drill down to individual claims from the aging view
- Payer performance: average days to payment per payer
- Alert when a claim passes configurable age threshold with no response

### 5.4 Denial Tracking

- Every denial recorded with NPHIES reason code
- Denial rate report: by payer, by drug category, by pharmacist
- Re-submission workflow: correct the flagged fields, re-submit with one action

---

## 6. Compliance Dashboard

This is the highest-value product screen in SmartPharma. It is cheap to build relative to its impact and is the primary demo screen for sales.

**Purpose:** Give pharmacy managers and owners a single screen showing whether the pharmacy is compliant with all government integrations, without requiring them to understand the technical details.

### Layout

One card per integration, per branch (for chains):

```
┌─────────────────────────────────────────────────────────┐
│ Compliance Status — Branch: Al Olaya, Riyadh            │
├────────────────┬────────────┬──────────┬────────────────┤
│ Integration    │ Status     │ Queue    │ Last Error     │
├────────────────┼────────────┼──────────┼────────────────┤
│ ZATCA          │ 🟢 Live    │ 0 pending│ —              │
│ SFDA RSD       │ 🟢 Live    │ 2 pending│ —              │
│ Wasfaty        │ 🟡 Warning │ 0 pending│ Timeout 14:32  │
│ NPHIES         │ 🔴 Error   │ 8 pending│ Auth failed    │
└────────────────┴────────────┴──────────┴────────────────┘
```

### Features

- **Per-branch status** for chain pharmacies
- **Submission queue**: number of documents waiting to be sent for each integration
- **Retry controls**: manually retry a failed submission; set auto-retry interval
- **Error log**: last error per integration with timestamp and raw response code
- **Submission history**: filterable log of every submission — success, failure, retry
- **Alert on failure**: notify pharmacy manager via in-app notification (WhatsApp notification added post-launch)
- **SLA timer**: for ZATCA B2C, show time remaining before the 24-hour reporting window closes for queued invoices

---

## 7. Multi-Tenancy & Chain Management

### 7.1 Architecture Decision (Prototype Required)

Two approaches exist. **Do not commit to either without prototyping the migration workflow across 20 simulated tenants first.**

| Approach | Pros | Cons |
|----------|------|------|
| **Schema-per-tenant** (separate PostgreSQL schema per pharmacy chain) | Strong isolation, clean separation | Prisma migrations across many schemas are painful; Prisma multi-schema client has constraints |
| **Row-level tenancy** (`tenant_id` on every table + PostgreSQL Row-Level Security policies) | Simpler migrations, single schema | More complex query authoring; RLS policy errors can leak data if misconfigured |

Whichever is chosen, the decision must be validated with a working migration script before any production customer is onboarded.

### 7.2 Tenant Structure

```
Platform (SmartPharma SaaS)
└── Tenant (pharmacy chain, e.g. "Al Shifa Group")
    └── Region (e.g. "Riyadh Region")
        └── Branch (e.g. "Al Olaya Branch")
            └── Till (e.g. "Counter 1", "Counter 2")
```

### 7.3 Head Office Features

- Aggregate stock view across all branches
- Centralised drug master: add a drug once, available in all branches
- Centralised price list: push price updates to all branches simultaneously
- Branch performance comparison: revenue, insurance AR, dispensing volume
- Policy engine: set chain-wide rules (e.g. maximum discount %, mandatory prior auth for drugs above a cost threshold)
- Staff management: create users, assign roles, assign to branches

### 7.4 Tenant Onboarding

- Self-service signup with pharmacy licence number verification
- Licence number stored per branch (DHA / MOHAP / MOH depending on emirate or KSA region)
- ZATCA CSID and SFDA credentials stored per tenant — never shared across tenants

---

## 8. User Management & RBAC

| Role | Arabic | Key Permissions |
|------|--------|-----------------|
| **Platform Admin** | مدير المنصة | All tenants, billing, support |
| **Tenant Owner** | مالك السلسلة | Full access to own chain |
| **Pharmacy Manager** | مدير الصيدلية | All operations, staff, reports, settings |
| **Senior Pharmacist** | صيدلاني أول | Dispense, override FEFO, approve returns, approve adjustments |
| **Pharmacist** | صيدلاني | Dispense, view prescriptions, view inventory |
| **Pharmacy Technician** | مساعد صيدلاني | Dispense under supervision only, stock count |
| **Cashier** | كاشير | OTC POS, basic refunds below threshold |
| **Purchasing Officer** | مسؤول المشتريات | Suppliers, POs, GRN |
| **Accounts** | محاسب | Financial reports, VAT reports, AR management |
| **Delivery Staff** | موظف التوصيل | Delivery orders only (deferred feature) |

**Implementation rules:**
- Permissions are additive: a role has a defined minimum set; a manager can grant additional permissions per user up to their own level.
- Every permission check is enforced server-side. Frontend hiding is a UX nicety, not a security control.
- Role changes are recorded in the audit log.

---

## 9. Localisation

### 9.1 Language

- **Arabic (MSA)** and **English** — user toggles per-session
- Bilingual invoices: Arabic and English on the same printed document (legally required for some UAE government submissions)
- Drug names stored in both languages; search works in either language simultaneously
- Arabic font: **Cairo** or **Tajawal** — both have strong pharmaceutical / medical legibility

### 9.2 Layout

- Full RTL layout when Arabic is active — menus, tables, forms, navigation all flip direction
- RTL and LTR can coexist on the same screen where needed (e.g. English drug names inside an Arabic UI)

### 9.3 Dates & Numbers

- Gregorian calendar used internally for all storage and API communication
- Hijri calendar displayed alongside Gregorian in patient-facing screens and Saudi regulatory documents
- Eastern Arabic numerals (١٢٣) available as a display option for invoices; Western numerals (123) used by default in the system UI
- Phone number format: +966 (KSA), with proper validation

### 9.4 Currency

- SAR (ريال سعودي) for KSA
- AED (درهم إماراتي) added when UAE tenant support is built
- Currency stored and computed as `Decimal` (not `Float` — this is an existing bug to fix)
- Exchange rates are not needed for Phase 1 (single-currency per tenant)

---

## 10. Security & Data Compliance

### 10.1 KSA Data Residency

⚠️ **Verify with a KSA-licensed legal advisor before onboarding any KSA customer.**

**Confirmed facts as of September 2026:**
- AWS Saudi Arabia region (me-central-2) is targeted for **December 2026** and is **not yet live**.
- AWS Bahrain (me-south-1) is outside the Kingdom and does **not** satisfy KSA data residency requirements for health data.
- Current options for KSA in-country hosting: **STC Cloud**, **Elm Cloud**, **Mobily Cloud**.
- AWS Outposts can run AWS infrastructure on-premises in KSA if a data centre partnership is arranged.

**Design requirement:** The application must support a configuration where each tenant's database and file storage is hosted in the tenant's home country. KSA tenants and UAE tenants must never share the same database instance.

### 10.2 UAE Data Residency

**Governing law:** Federal Law No. 2 of 2019 Concerning the Use of ICT in Health Fields  
**Rule:** Health data from UAE-based services must be stored, processed, and transferred **within the UAE only**.  
**Cloud:** Permitted only if infrastructure is **physically hosted in the UAE**.  
**Retention:** Health records must be kept for **25 years from the date of the patient's last procedure**.  
**AWS UAE (me-central-1) satisfies UAE residency.** Use this region for UAE tenants.  
**Exceptions:** Cross-border transfers are permitted under Ministerial Resolution No. 51 of 2021 only for narrow cases (patient abroad, lab samples, MOHAP-approved). These do not apply to routine pharmacy operations.

### 10.3 Saudi Personal Data Protection Law (PDPL)

- Patient consent required before accessing or processing personal health data
- Right to access, correct, and delete personal data (subject to retention rules)
- Data breach notification required within 72 hours of discovery
- Data processing agreements required with any third-party processors

### 10.4 Authentication & Session Security

- Two-factor authentication: TOTP app + SMS OTP
- Biometric login on mobile app (Face ID / fingerprint — device-native, no biometric data stored on server)
- Session timeout: configurable per role (e.g. cashier 15 min, pharmacist 60 min)
- Concurrent session limit: configurable per role
- IP allowlisting: optional per branch; useful for fixed-terminal setups

### 10.5 Audit Log

- Append-only: no record can be modified or deleted, only new records appended
- Captures: user ID, role, action, affected entity, entity ID, old value, new value, timestamp, IP address, device identifier
- Covers all: create, update, delete, status change, login, logout, failed login, role change, override events
- Exportable for regulatory inspection (CSV and JSON)
- Retention: minimum 7 years (verify with legal advisor — PDPL and health data rules may differ)

### 10.6 Encryption

- In transit: TLS 1.3 minimum
- At rest: AES-256 for database and file storage
- JWT secrets: generated randomly, stored in secrets manager (never hardcoded — existing bug to fix)
- Patient data fields (name, national ID, mobile): encrypted at the column level with application-managed keys

### 10.7 AI and Cross-Border Data Transfer

If AI features (OCR for prescription images, drug interaction checking via external API) are added:
- Sending patient data to a foreign LLM API constitutes a cross-border health data transfer under UAE law.
- Use in-region AI endpoints or on-premise models for any feature that processes patient-identifiable data.
- This applies even if the API call is encrypted.

---

## 11. Reporting & Analytics

Only reports needed to operate the pharmacy are included in Phase 1. Strategic analytics are deferred.

### 11.1 Operational Reports (Daily)

- **Sales summary:** total revenue by payment type (cash / card / insurance), by cashier, by drug category
- **Insurance claims summary:** submitted / approved / rejected / pending for the day
- **Stock movement log:** all receipts, dispensing, adjustments, transfers for the day
- **Expiry alert report:** drugs expiring within 90 days, with branch, batch, quantity
- **Controlled substance register:** all controlled drug dispensing with pharmacist, patient, prescriber, quantity

### 11.2 Financial Reports (Weekly / Monthly)

- **Accounts receivable aging:** outstanding insurance claims by payer, by age bucket
- **Supplier payments outstanding:** invoices due and overdue by supplier
- **VAT summary:** output VAT collected, input VAT on purchases, net position — formatted for ZATCA return filing
- **Purchase spend:** total spend by supplier by month
- **Gross margin by drug category:** revenue minus cost of goods

### 11.3 Compliance Reports

- **ZATCA submission log:** every invoice, status, submission time, error if any
- **SFDA dispensing report:** all serialised units dispensed, for SFDA audit
- **Wasfaty dispensing report:** all prescriptions received and dispensed via Wasfaty
- **NPHIES claim report:** claims by status, denial rate, average days to payment
- **Audit trail export:** full append-only log for any date range

### 11.4 Scheduled Delivery

- Branch manager: daily sales summary delivered via in-app notification at configurable time
- Chain owner: weekly P&L across all branches
- Accounts: monthly VAT summary
- (WhatsApp delivery of reports added after WhatsApp integration is built)

---

## 12. Infrastructure & Hosting

### 12.1 Current Tech Stack (Unchanged)

| Layer | Technology |
|-------|-----------|
| Backend | Node.js / Express / TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT (access + refresh token rotation) |
| Real-time | Socket.io |
| Validation | Zod |
| Desktop app | Electron / React |
| Mobile app | Expo / React Native |
| Web app | Next.js |

### 12.2 Additions Required

| Addition | Purpose | When Needed |
|----------|---------|------------|
| **Redis** | Session store, rate limiting, caching, offline sync queue management | Phase 1 |
| **BullMQ** | Background job queue for government submissions, scheduled reports | Phase 1 |
| **S3-compatible object storage** | Prescription images, ZATCA invoice XML, audit exports | Phase 2 |
| **Moyasar** | KSA payment gateway (mada, Visa, STC Pay) | Phase 2 |
| **Unifonic** | WhatsApp Business API — KSA-local provider | After Phase 3 live |
| **Sentry** | Error tracking and alerting | Phase 1 |
| **Structured logging (Pino)** | Replace current console.log wrapper | Phase 1 |

### 12.3 Hosting by Region

| Region | Provider | Reason |
|--------|---------|--------|
| KSA tenants | STC Cloud / Elm Cloud / Mobily Cloud | In-country data residency (AWS KSA not live until Dec 2026) |
| UAE tenants | AWS me-central-1 (UAE) | UAE health data residency law satisfied |
| KSA — switch when live | AWS me-central-2 (KSA) | Migrate when region is available |

### 12.4 Multi-Region Design Requirement

- Each tenant's database is hosted in the tenant's home country.
- Application servers can be centralised but must route database connections to the correct regional endpoint.
- File storage (S3 / equivalent) also per-region.
- No cross-region data replication of health data without legal approval.

---

## 13. Features Deliberately Deferred

These features are explicitly out of scope until real pharmacies are live and the compliance stack is stable. Adding them earlier introduces scope, delays launch, and risks the accuracy of core operations.

| Feature | Reason for Deferral |
|---------|---------------------|
| Patient mobile app (consumer-facing) | Separate product; requires compliance stack stable first |
| Home delivery with driver app | Requires patient app and logistics partner integration |
| Loyalty / points program | Low regulatory impact; high scope |
| Telemedicine / pharmacist chat | Separate regulatory licensing (teleconsultation) |
| AI demand forecasting | Requires 6+ months of real transaction data; OCR/AI raises cross-border data concerns |
| BNPL (Tabby / Tamara) | Payment feature; deferred until core payments stable |
| WhatsApp patient notifications | Build after first live pharmacy confirms compliance stack working |
| UAE compliance stack | Built after KSA is live and stable |
| White-labeling | Enterprise sales feature; deferred until proven product |
| Custom report builder | Advanced analytics; deferred |
| Drug interaction checker UI | Data model is designed now; UI and integration with drug database deferred |

---

## 14. Build Sequence

```
MONTH 1  ─── Security fixes (8 items from audit report)
         ─── Float → Decimal migration for all money fields
         ─── Expiry field: String → DateTime
         ─── Soft deletes on all financial models
         ─── Append-only audit log middleware
         ─── Parallel: register on ZATCA, SFDA, Wasfaty, NPHIES sandboxes
         ─── Parallel: engage KSA legal advisor (data residency)
         ─── Parallel: engage KSA tax advisor (VAT per drug category)

MONTHS   ─── Prototype tenancy approach (schema vs row-level; test 20 tenants)
2–3      ─── Implement chosen tenancy model + RBAC (10 roles)
         ─── Arabic RTL layout + bilingual UI (Cairo/Tajawal font)
         ─── Hijri calendar display
         ─── Configurable VAT rate per drug category (not hardcoded)
         ─── 2FA (TOTP + SMS OTP)
         ─── Session management (timeout, concurrent limits)

MONTHS   ─── GS1 DataMatrix scanning (camera + USB scanner)
4–5      ─── Batch / lot / expiry tracking (mandatory on all stock movements)
         ─── FEFO enforcement at dispense with supervisor override
         ─── Expiry alerts (90 / 60 / 30 / 7 days)
         ─── Inter-branch stock transfers
         ─── Automated purchase orders on reorder point
         ─── POS terminal (touch, search, multi-tender, receipt printing)
         ─── Offline mode with sync queue (BullMQ)
         ─── Moyasar payment terminal integration (mada, Visa, STC Pay)
         ─── Prescription queue (manual entry; Wasfaty pull added in next phase)

MONTHS   ─── ZATCA Phase 2 (UBL 2.1, B2C simplified + B2B clearance)
6–9      ─── SFDA RSD Drug Track & Trace (serialised unit reporting)
         ─── Wasfaty e-Prescription API
         ─── NPHIES Insurance Claims (FHIR R4: eligibility, pre-auth, claims, AR)
         ─── Compliance Dashboard (green/red per integration, queue, retry, history)
         ─── ZATCA conformance testing (budget 6 weeks in sandbox)
         ─── NPHIES conformance testing (budget 6–8 weeks in sandbox)

MONTH    ─── Onboard first live pharmacy customer
10+      ─── Monitor compliance stack in production
         ─── Fix issues before adding features
         ─── Then: Unifonic WhatsApp integration
         ─── Then: Drug interaction checker
         ─── Then: UAE compliance stack (Tatmeen, NABIDH/Malaffi, Shafafiya, FTA)
```

---

## 15. Things to Verify Before Shipping

These questions must be answered by qualified professionals, not assumed.

| Question | Who to Ask | When |
|----------|-----------|------|
| Which data must physically stay in KSA? Does health data differ from financial data? | KSA-licensed legal advisor (NDMO / NCA regulations) | Month 1 |
| Are prescription medicines zero-rated or exempt under KSA VAT? Which drug categories? | KSA-licensed tax advisor | Month 1 |
| Are specified medicines zero-rated or exempt under UAE VAT? | UAE-licensed tax advisor | Before UAE launch |
| Current NPHIES sandbox queue time and conformance testing process | CHI (Council of Health Insurance) portal | Month 1 |
| Current ZATCA sandbox onboarding time and CSID process | ZATCA Fatoorah developer portal | Month 1 |
| Does SmartPharma need to register as a software product with SFDA or MOH before selling? | SFDA, MOH | Month 1 |
| For a UAE customer in Abu Dhabi — is their claims platform Shafafiya or something else? | Ask each UAE customer individually | Before UAE launch |
| Does UAE e-invoicing B2B mandate affect a pharmacy supplying hospitals? | UAE-licensed tax advisor | Before UAE launch |

---

*This document is the reference for SmartPharma product decisions. Update it when regulations change or decisions are revised. Do not let it drift from the actual implementation.*
