# Refactoring Plan: VideoLM

This document outlines the phased approach to refactoring the VideoLM application. The primary goals are to improve stability, simplify the architecture, and fix fundamental design flaws while preserving all existing functionality.

This plan is not a suggestion. It is the path forward. Each phase must be completed and verified before moving to the next.

## Guiding Principles

- **Stability First:** No refactoring will be done without a test harness in place.
- **Simplicity:** Complexity is the enemy. The goal is to arrive at the simplest possible solution that works.
- **Clear Separation of Concerns:** Code will be organized by its function (e.g., routes, services, data access).

---

## Phase 1: Stop the Bleeding - Build a Safety Net & Fix Uploads

This phase is about making the code base stable enough to work on without breaking it.

1.  **Write End-to-End Tests (Non-negotiable):**
    *   **Action:** Add `vitest` and `supertest` to the project.
    *   **Scope:** Create a single, comprehensive test suite that covers the primary user workflow: video upload, processing, status polling, data verification, chat, and deletion.
    *   **Requirement:** All external services, specifically OpenAI API calls, must be mocked to ensure tests are fast, repeatable, and don't incur costs.
    *   **Verification:** The test suite must pass before and after any subsequent changes.

2.  **Replace Manual File Upload Logic:**
    *   **Problem:** The custom `busboy` implementation in `routes.ts` is complex, error-prone, and a security risk.
    *   **Action:** Remove the custom middleware and replace it with `multer`.
    *   **Implementation:** Configure `multer` to use `diskStorage` to handle file uploads to a temporary directory, respecting the local storage constraint.
    *   **Verification:** The E2E test suite must pass.

---

## Phase 2: Clean Up The Mess - Decouple and Simplify

This phase focuses on untangling the application logic to make it maintainable.

1.  **Isolate Business Logic from Routes:**
    *   **Problem:** The `routes.ts` file contains significant business logic, making it hard to read and test.
    *   **Action:** Create a `VideoService.ts` to encapsulate all business logic related to video processing.
    *   **Implementation:** Route handlers will be simplified to only parse HTTP requests and call the corresponding service method. All logic for database interaction, job creation, etc., will move to the service layer.
    *   **Verification:** The E2E test suite must pass.

2.  **Fix the Memory-Hogging Processor:**
    *   **Problem:** `video-processor.ts` reads all video frames into memory at once, which will crash the application on large files.
    *   **Action:** Refactor the frame processing logic to handle frames in a stream or in small, fixed-size batches.
    *   **Implementation:** Replace the `map` with `readFileSync` with a `for...of` loop that processes a few frames at a time.
    *   **Error Handling:** Simplify the error handling. If `ffmpeg` or AI analysis fails, the job's status is marked as `failed` in the database with a descriptive error message. Remove the "fallback analysis" logic.
    *   **Verification:** The E2E test suite must pass.

---

## Phase 3: Fix the Foundation - The Database

This is the final and most critical phase to correct the core design flaw of the application.

1.  **Eliminate JSON Blobs:**
    *   **Problem:** Storing structured analysis data in a single `TEXT` field (`analysis`) is inefficient, un-queryable, and not scalable.
    *   **Action:** Remodel the database schema to be relational.
    *   **Implementation:**
        *   Create new tables: `transcriptions`, `key_points`, `topics`, `visual_elements`.
        *   Each new table will have a foreign key relationship to the `videos` table.
        *   Update `shared/schema.ts` to reflect the new structure.

2.  **Migrate Application Logic:**
    *   **Action:** Update the application to use the new relational schema.
    *   **Implementation:**
        *   The `video-processor.ts` will write to the new tables.
        *   API endpoints will query the new tables.
        *   A temporary transition period where the application writes to *both* the old and new structures can be used to ensure a smooth rollout.
    *   **Verification:** The E2E test suite must pass, and new endpoints for fetching relational data should be tested.
