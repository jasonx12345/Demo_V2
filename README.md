# Panel Shop MES demo

Responsive website for a Lead Hand, technicians and the shop TV. Fabricated demonstration records; demo badges are role selectors, not real authentication.

Public bench: https://jasonx12345.github.io/Demo_V2/
Priority dashboard: https://jasonx12345.github.io/Demo_V2/priority.html
TV board: https://jasonx12345.github.io/Demo_V2/board.html

## Work order flow

A lead creates draft panels under an office parent job. Each has an alphanumeric rack and its own panel type, including Telecom. Review a draft with **Edit checklist**: change its rack, type and due date; add, remove or reorder steps within each stage; enter required materials. Save creates a new checklist revision. Controlled lead approvals and the Final QA review/release gates cannot be removed. Keep at least one step per stage. These are demonstration baseline checklists; actual Hydro One P&C and Telecom instructions need shop approval.

Release freezes the approved checklist version. Drafts remain off the active TV board. Begin work starts Receiving. Completing the checklist does **not** automatically advance the panel: select **Sign off [stage] stage** after all required checks, passing readings and independent approvals are recorded. Final QA stage signoff requires a lead and every finding dispositioned.

Existing local state version 5 migrates to workflow revision 1. Previously completed stages receive explicitly marked legacy closures so existing progress is preserved. No fabricated labour hours or backfilled material receipts are created. PNL-611 has two sample material requirements for the Receiving pilot; new drafts start with an empty, editable material list.

## Receiving and holds

**Scan receiving label** supports a phone camera or an uploaded image. Crop to the label using your device photo editor, keep a small margin around the text and barcode, and take a sharp, straight, well-lit photo. PaddleOCR processes the image in the browser. Models preload when the scanner opens and are cached when browser storage permits. Large images are reduced to a 2,400-pixel edge; smaller images keep their resolution. Initial downloads require internet access. Photos are never uploaded by the OCR feature.

Text positions, label aliases and minor spelling variations help match fields. Conflicting values or multiple panel matches need manual review. You can correct raw text and select **Match fields again from text**. Verify every suggestion, quantity and work order before confirming a receipt. Barcode reading uses the browser BarcodeDetector API where supported; OCR also recognizes explicitly printed barcode values. This is not a universal barcode decoder or part-photo classifier.

Receipts reconcile against the panel's required part numbers (case-insensitive), with required, received and short quantities. Unlisted/wrong parts are shown separately and do not satisfy required material. Shortages at release, work start or receiving reconciliation create automatic material holds. Matching receipts clear the relevant automatic holds. A hold blocks checklist work and labour booking; receiving remains available. A lead can clear a hold manually with a reason, but Receiving still cannot sign off with unmet material requirements. Manual holds can be placed at any active stage with a missing item, quantity and expected-in date. Multiple overlapping holds are counted once for elapsed hold time.

## Rework, quality and time

In Testing, a failed measured reading automatically returns the panel to Wiring and creates a finding. **Record failed test / return to Wiring** also handles qualitative failures. The previous Wiring, Testing and Final QA completions, reading history, approvals and stage closures are archived in a rework cycle. Repeat Wiring and its signoff, then repeat Testing. Findings remain until a lead dispositions them; Final QA remains blocked until review is complete.

Technicians can book their own labour in minutes with a description. Booked labour is separate from elapsed stage time and hold time. Queue/project totals use actual labour entries, not first-to-last step timestamps. Current stage age and report stage elapsed time exclude holds. This demo does not integrate with payroll or office job costing.

Leads assign panels from the bench or priority dashboard. **My assigned panels** filters the technician queue. The queue otherwise defaults to last accessed. The priority dashboard and TV list put holds first, then contract deadlines and stage. Completed panels move to the bottom of the dashboard and leave the TV list. Warnings use demo thresholds: more than 3 panels per stage, or more than 36 active hours in a stage. The TV shows a +N MORE indicator rather than silently hiding overflow.

## Reports

Open **Build report**, then **Save / Print PDF** and choose Save as PDF. Reports include checklist version, stage signoffs, material reconciliation and receipts, all hold history, archived rework readings/approvals, labour entries, findings, handoff notes and activity history. Final completion requires explicit Final QA stage signoff.

## Shared records across devices

GitHub Pages serves static files: by default each browser has its own data. Bench, dashboard and TV tabs in one browser profile already share localStorage. To demonstrate shared records across separate devices, the repository includes an optional Node server:

1. Install Node.js, then run **npm start** from this folder. Open http://127.0.0.1:8766/.
2. For devices on the same private network, start with HOST=0.0.0.0 (PowerShell: set $env:HOST='0.0.0.0' before npm start). Open the computer's LAN address on every device, such as http://192.168.1.20:8766/.
3. Expand **Shared demo connection** at the bottom of each page, enter that same server address, and select **Connect and load shared records**. Connecting replaces the local demo dataset with the server dataset. The first connected browser initializes an empty server. Badge identity stays local to each device.
4. Changes save to .demo-shared-state.json, ignored by Git. Other connected pages poll every 3 seconds. Concurrent edits use revision checks: a stale device cannot overwrite a newer record. On a conflict, local changes remain in the browser and syncing pauses. **Reload shared records** explicitly loads the server version; reapply any desired local changes afterwards.

The shared server is a fabricated-data demonstration with no production authentication. It defaults to localhost. Public cross-device hosting needs a separately deployed HTTPS server and authentication; no such service has been deployed as part of the GitHub Pages update. The HTTPS GitHub Pages site cannot reliably connect directly to an HTTP private-LAN server due to browser mixed-content/private-network rules; for the LAN demo, serve the whole website from the Node server.

## Development

- npm install
- npm test — OCR matching, cache/resize behavior, workflow lifecycle and DOM rendering.
- npm run test:server — local HTTP persistence, conflict and access checks.
- npm run build — rebuild the committed PaddleOCR browser bundle after OCR source changes.
- npm start — optional shared demo server, port 8766 by default; PORT, HOST and DEMO_ALLOWED_ORIGINS can be configured.

assets/store.js owns persistence and existing checklist actions. assets/workflow-store.js adds production workflow rules and migration; workflow-ui.js adds the controls and report sections. priority.js and board.js render the supervisor views. shared.js adds optional server synchronization. Models and the PaddleOCR Apache license ship with the static site. No SQL/office-system lookup is implemented; the process document identifies that integration as future work.

Verification covers the full draft-to-Final-QA lifecycle, shortages/wrong parts, hold clearance, assignments, checklist additions, explicit stage gates, test-return cycles with retained failed readings, independent QA approval, labour, reopening earlier work, screen rendering and shared-server conflict handling. DOM tests verify screen behavior; they do not establish OCR accuracy or real-device visual layout/performance.


Batch creation: on New work order, enter **Panel quantity** and **Starting rack**, then select **Generate panel rows**. Numeric rack portions increment (201A, 202A, 203A); review each row and set its own panel type before creating drafts. No leading zeros are added.
