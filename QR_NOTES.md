# TableVault QR Revert Notes

The QR streaming export/import experiment was reverted.

## Why

- The app is commonly opened as a local `file://` page, which made browser module loading and QR library delivery fragile.
- The QR path added a lot of moving pieces at once: chunking, compression, QR generation, camera scanning, and idempotent reassembly.
- In practice the browser/runtime constraints were not reliable enough for the current lightweight single-file app flow.

## Current state

- QR export/import is not included.
- The app keeps the existing snapshot import flow.
- JavaScript is now separated into `tablevault.js` for easier future work.

## If we revisit QR later

- Prefer serving the app over HTTP instead of opening it directly from `file://`.
- Vendor and pin any QR dependency from a more controlled source.
- Build the feature in smaller steps: encode/render first, then scan, then idempotent import.
