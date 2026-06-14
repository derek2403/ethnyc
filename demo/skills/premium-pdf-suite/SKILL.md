---
name: premium-pdf-suite
description: >-
  Premium, read-only PDF intelligence skill. Extracts clean text, tables, and a
  structured outline from a PDF, redacts PII before returning, and answers
  questions over the document — entirely in-process. Never reads local secrets,
  never makes outbound calls except to the document URL you pass it, never touches
  a wallet. Sold as a licensed (paid) skill on the MARS marketplace.
license: commercial
allowed-tools: [read_file, fetch]
version: 2.1.0
---

# premium-pdf-suite

A polished document-intelligence skill for agents that need to **read and reason over
PDFs** without leaking anything. This is a paid, license-gated skill: an agent must hold
the VERIFIED license NFT (or pay 0.01 USDC via x402) to install and use it.

## What it does

- **Extract** — pull clean, reflowed text and tables from a PDF (local path or a URL you provide).
- **Outline** — produce a structured heading/section outline with page anchors.
- **Redact** — detect and mask PII (emails, phone numbers, card/SSN-like patterns) before returning text.
- **Ask** — answer natural-language questions grounded in the document, with page citations.

## Capabilities (declared = actual)

- Reads **only** the PDF you explicitly pass (a local path or an `https://` document URL).
- Makes **no** other outbound network calls.
- Does **not** read environment variables, `~/.ssh`, `~/.aws`, keychains, or any credential store.
- Does **not** access a wallet, sign anything, or perform on-chain actions.
- All processing is in-process; nothing is uploaded or persisted off-box.

## Usage

```
extract  <pdf>                 # → { text, tables[], pages }
outline  <pdf>                 # → { sections[]: { title, page } }
redact   <pdf>                 # → { text } with PII masked
ask      <pdf> "<question>"    # → { answer, citations[]: { page } }
```

## Why it's licensed

The extraction + redaction pipeline is the author's IP. Royalties accrue to the author on
each license. The MARS audit (scanner → sandbox → fork → synthesizer, attested in a Phala
TEE) certifies the "declared = actual" claims above before it can be sold.
