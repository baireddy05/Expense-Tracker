# Kharch Project Continuity & Agent Rules

1. **Read Progress First on Session Start / Account Switch:**
   - Before planning or editing in a new session, read `PROGRESS.md` (and `FEATURES.md` when touching web/feature parity) in the workspace root so you know the exact current state, architecture, verified build/test status, and pending items.
2. **Keep `PROGRESS.md` Up to Date After Every Task:**
   - Before finishing any turn that completes code changes, bug fixes, new features, or verification runs, update `PROGRESS.md` with:
     - Timestamp & summary of what changed
     - Files modified/added
     - Exact lint/build/test commands run and their observed results
     - Current active state, known gaps, and next steps
3. **Preserve User Data & Credentials:**
   - `.env` contains Firebase project configuration read by both Vite (`VITE_FIREBASE_*`) and Gradle (`android/app/build.gradle.kts`). Never hardcode secrets or print API keys in summaries.
   - Maintain 1:1 feature and schema parity between the Web App (`src/`) and the Native Android App (`android/`), especially Firestore `users/{uid}/...` document formats and `FullBackupV3` (`version: "3.0"`) JSON backups.
