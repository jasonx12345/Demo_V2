# B&M panel shop — static clickable demo

A benchtop checklist, live shop-floor board and printable build report for a fictional panel shop. All people, panels, readings, findings and records are fabricated. Badge sign-in is cosmetic; nothing is sent anywhere.

Plain HTML, CSS and vanilla JavaScript. No install, npm, dependencies, framework, build step, external fonts, backend, API or service worker.

## Open and publish

Double-click `index.html` to open the bench locally. Use **Open floor board** for a second window in the same browser profile. All paths are relative and scripts are ordinary local scripts, so a GitHub Pages repository prefix works.

GitHub Pages:

1. Push the files to a GitHub repository.
2. Open **Settings → Pages** and choose **Deploy from a branch**.
3. Select your branch and **/(root)**, then Save.

The browser tool used here blocks `file://` navigation, so direct double-click testing could not be performed. Browsers also differ in whether localStorage is shared between separate local HTML files. Each page works locally, but the reliable two-window demonstration uses a served URL such as GitHub Pages. A five-second board poll backs up storage events. Blocked storage displays a warning and keeps changes in memory for that window only.

## Demo badges

| Badge | Name | Role |
| --- | --- | --- |
| 4471 | A. Kovach | technician |
| 5104 | R. Bissonnette | technician |
| 3218 | J. Okafor | lead |
| 2907 | M. Cardoso | lead |

**Switch user** returns to sign-in; selecting a badge always opens the queue, at the top of the page. The selected badge is shared with other bench windows. **Reset demo** restores the seven seeded panels and signs out. Generated-number counters retain their high-water marks, so numbers are not reused even after reset in the same browser data.

## Suggested walkthrough

1. Sign in as 4471. Search `merivale`: the queue shows all three matches and a result count. Clear the search, then sort by time in stage to show the queue reordering. Find PNL-602 and click anywhere on its row, including the project or serial text. Rows also open with Enter or Space when focused.
2. On PNL-602, only Wiring is displayed. Complete step 10, enter 148 on step 11, and complete it. Attempt signoff as a technician to see the rule.
3. Switch to 3218, reopen PNL-602 from the queue, and sign off. Testing opens automatically; the separate board moves the card from Wiring to Testing.
4. On step 12, choose **Create finding**, select **Needs evaluation** and **At Testing**, and save. The finding appears in the Testing stage and the all-findings list. Add entries under different badges to demonstrate multi-person troubleshooting. The original step keeps its numbered finding marker permanently.
5. Open PNL-589. A seeded blue 14 AWG shift-handoff note requires acknowledgement before work. The acknowledgement records a name and time; the note then remains in the collapsed notes list. Only leads can remove notes.
6. As a lead, choose an upcoming stage and record a step out of sequence. The step, History and report show **OUT OF SEQUENCE**, the lead's name and time. Technicians continue to work in order. Independent signoff still requires a different lead.
7. On PNL-601, complete step 16. Its seeded label-alignment finding keeps **Review open findings** and **Final QA release** locked. Open F-000002, add a lead disposition and note, return to the checklist, complete review (step 17) and release (step 18). Switch to a different lead and sign off. Open the report, choose **Save / Print PDF**, then select **Save as PDF** in the browser print window.
8. Use **New work order** to enter your own details or select **Fill demo example**. Add one row per panel, with its own alphanumeric rack and panel type. Create the draft, edit its checklist if needed, then have a lead select **Release to shop**. A shop user selects **Begin work** before Receiving can be completed manually. Drafts stay off the floor board; released panels appear in Receiving as ready to begin.
9. Try presenter controls: **Undo**, **Remove signoff**, and **Correct reading**. Inspect History, then reset the demo.

## Findings and Final QA

There is one problem-reporting action per step: **Create finding**. Findings have severity **awareness** or **needs evaluation**, and can be addressed now or deferred to Wiring, Testing or Final QA. Neither severity blocks ordinary build work.

Each finding retains its description, original action and all subsequent entries with name, badge and timestamp. Entries render as a table. All findings can be filtered by status, severity and panel. Permanent step markers link to the full record, including dispositioned findings.

As a demo judgment call, only leads disposition findings: **accepted as-is**, **corrected**, or **deferred to site**, with a required note. Both severities must be dispositioned before the mandatory Final QA review. The review also lists steps completed with failed readings. Leads cannot bypass this review or release with outstanding findings. Creating a new finding after review reopens review and release; normal work can continue.

This is a lightweight record and review, not a formal non-conformance workflow. No routing, retest generation, approval matrix or physical-action authorization is implemented.

## Presenter recovery and sequence rules

- **Undo** is available on every completed step. It clears that step and all later completions, readings and attached signoffs. Technicians must redo the sequence. Findings, panel notes and activity history remain. Leads can explicitly record new out-of-sequence work again.
- **Remove signoff** is lead-only. It preserves the step completion, returns it to **NEEDS LEAD SIGNOFF**, and clears downstream completions and signoffs.
- Before completion, a failed input can simply be re-entered (for example, torque 14 → 22). The reading preview changes immediately. A failed reading never prevents completing the step.
- **Correct reading** on a completed step appends a named, timestamped reading. It preserves all prior readings and the permanent failed-completion marker. It removes that step's signoff and clears downstream records so they can be recorded again against the correction.
- Completed stages are read-only during normal work. Secondary presenter controls remain available there to satisfy the recovery requirements. Upcoming stages are unavailable to technicians; leads have explicitly labelled out-of-sequence actions.
- Final QA is now three steps: visual check (16), findings review (17), release (18). Only release needs independent lead signoff.

## Panel notes

Any signed-in person can add a panel note. The next different person opening the panel must acknowledge it before working. The seeded PNL-589 note fires for the first opener, including its author, so it is immediately demonstrable. One acknowledgement clears the banner shop-wide. A lead may remove a note; the report and History retain removed notes and their attribution. Notes do not gate physical equipment.

## Numbering and hours

New panels use separate shop-wide counters for serials and work orders: initially `PNL-612` and `WO-025912`. Panel serials are not padded with zeros; work-order numbers remain six digits. The office job number is an entered parent field. Each generated order starts in Draft with zero progress. A lead releases it, and a shop user begins work before checklist activity is allowed. Counters persist with the demo data and are retained on reset. Clearing browser storage begins a new independent demo dataset.

Each work order can contain 1–50 explicit panel rows. Rack identifiers accept letters, such as `201A` and `201B`, and each row selects its own panel type/checklist template. While a panel is Draft, **Edit checklist** can change its step titles and instructions before release. The demonstration templates share the same controlled stage, reading and signoff structure.

Hours are derived from the first and last currently recorded **step completion timestamps**: within a stage for stage hours, across a panel for panel hours. Zero or one completion means zero elapsed hours. Project hours on the queue sum panel hours. Signoff times are used for the report's completed date, but do not extend derived hours. Undo changes the current rollups; the original actions remain in History.

These are approximate elapsed hours and include idle time between steps. A real deployment would reconcile them against the office's existing job-costing system. No clock-on/off UI or reconciliation is part of this demo.

## Colour and board choices

Green `#16A34A` denotes completed records/stages only. Blue `#2D7DD2` denotes active work and the primary action. Upcoming work is neutral; findings and attention are amber `#E8B923`; failed readings and lateness are red `#C1272D`. Passing uncommitted input stays blue because it is not yet complete.

The wall board has no controls, navigation or scrolling. At 1920×1080, five columns show large serials and the Wiring bottleneck. Cards are due-date ordered; overflow is a `+N MORE` row. Stage age becomes amber after 36 hours. Late red takes precedence over attention. Finding markers are amber. Untouched panels are neutral and have no initials. Finished panels leave the board but remain in the queue and report.

WIP thresholds are 3 for Receiving, Assembly, Wiring and Testing, and 2 for Final QA. Headers turn amber above threshold and red more than two above it. Due dates expire at the end of the local calendar day. Fixtures use dates relative to page initialization and persist as a coherent dataset, including panel due dates.

## Data and files

`index.html` is the bench, `board.html` the wall board, and `report.html?panel=PNL-601` the report. The report is light-themed and A4-ready. **Save / Print PDF** opens the browser print window; choosing **Save as PDF** creates the PDF with a panel-based suggested document name. Print CSS hides the report navigation and onscreen instructions.

`assets/data.js` assigns `window.SEED`; `assets/store.js` owns state, persistence and derived values. `bench.js`, `board.js` and `report.js` render explicitly labelled fields and tables. JSON serialization is used only for cloning fixtures and localStorage, never for DOM output.

Everything shares the single localStorage key `panel-shop-demo-v1`. State version 5 adds attributed receiving-material records. Existing version-2 through version-4 data migrates without deleting recorded work.

The queue defaults to **Last accessed · newest first** and retains due-date, time-in-stage, stage and project sorting. Responsive CSS adapts the bench, queue forms and checklist to phone-sized screens; the floor board remains a large-display view.

The future production design is to select a project and enter rack identifiers, then populate panel specifications from SQL or another office system query. This static demo keeps those fields manual because it has no backend or database connection.

No test suite or dependencies are included. Development verification uses one-off state checks and a local static preview under `/panel-demo/` to exercise repository-prefix paths.

## Verification of this revision

One-off state checks covered technician ordering, independent signoff rules, cascading undo, signoff removal, failed-reading preservation, acknowledgement gating, Final QA release gates, reopening review after a new finding, and number uniqueness across reset.

Browser checks under `/panel-demo/` covered opening a queue row via its serial text, search and clearing search, longest-stage sorting (PNL-588 first), user-switch routing, automatic stage advancement and board synchronization, deferred findings and entries, combined finding filters, note acknowledgement, lead out-of-sequence recording, readable activity history, three-panel work-order generation, Final QA disposition and independent release, report contents, live 14 → 22 torque correction, saved-reading correction and cascading undo. The one-stage layout and board were visually inspected. Browser logs showed no JavaScript errors. Direct filesystem navigation remains unverified because of the tool policy described above.


## Receiving camera-scan pilot

The queue now includes **Scan receiving label**. On an Android phone, the receiver can take a photo or upload an existing image. The static browser demo uses Tesseract.js to run OCR in the browser and the browser `BarcodeDetector` API when available. Parsed part number, description, quantity, barcode and panel/work-order matches are suggestions only: the receiver reviews and edits them before saving. Confirmed receipts are attributed to the signed-in user, written to panel History, and included in the build report.

The first OCR use downloads the Tesseract browser worker and English language data from a CDN, so the static demo needs an internet connection for initial loading. Image recognition then runs locally in the browser and the photo is not uploaded by this demo. **Load demo label** gives a reliable fabricated path when presenting without a suitable label or network.

For production Android devices, use Google ML Kit Text Recognition and Barcode Scanning with bundled models. That provides offline, on-device processing without a per-scan API charge. OCR reads printed text and barcode scanning decodes labelled identifiers. An unlabelled component cannot be identified reliably by OCR; it needs a controlled part-photo catalogue and a trained on-device image model, or a manual lookup.
