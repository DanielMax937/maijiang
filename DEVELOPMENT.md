# Agentic Development Workflow

This document outlines the standard operating procedure for developing, testing, and finalizing features in this project. It is designed to guide the LLM through a rigorous, iterative process.

## 1. Requirement Analysis & Planning
**Goal**: Define *what* to build and *how* to build it before writing code.

1.  **Understand the Goal**: Analyze the user's request.
2.  **Task Breakdown**:
    - **Granularity**: Split the user's goal into the *smallest possible* actionable tasks. Avoid large, monolithic tasks.
    - Update `task.md` with these granular items.
    - Group tasks logically (e.g., "Refactoring", "UI Implementation", "Verification").
3.  **Technical Design**:
    - Create or update `implementation_plan.md`.
    - List specific files to modify or create.
    - Define data structures, interfaces, and component hierarchies.
    - **CRITICAL**: Request user review and approval of the plan before proceeding.

4.  **Define Acceptance Criteria (Test Cases)**:
    - Create mapped test cases in `test_plan.md` corresponding directly to the granular tasks defined in Step 2.
    - **Verification Question**: Define a specific question to ask the VLM script (e.g., "Are the top, left, and right player hands visible and face-up?").
    - **Expected Answer**: Define the expected positive response.
    - Define the specific workflow steps to reach that state.

## 2. Implementation
**Goal**: Execute the approved plan.

1.  **Write Code**: Implement changes file-by-file.
2.  **Dev Features**: If a feature is complex or hard to reach (e.g., specific game states), implement a **Dev Mode** (toggle, debug buttons) to facilitate testing.
3.  **Build Check**: Ensure the dev server (`npm run dev`) is running and the app builds without errors.

## 3. Verification (The Testing Loop)
**Goal**: Prove that the feature works as expected using empirical evidence.

1.  **Define Test Cases**:
    - Update `test_plan.md` with specific scenarios (e.g., "TC1: Verify Deal", "TC2: Gameplay Flow").
    - Define the **Workflow** (Steps to reproduce) and **Expected Observation**.
2.  **Execute Tests (Browser Subagent)**:
    - **Navigate**: Open the local server URL.
    - **Interact**: Use ONLY standard user interactions (Click, Scroll, Type).
    - **Prohibited**: Do NOT use JavaScript execution to force states or simulate events (e.g., `document.querySelector(...).click()`). If a standard click fails, it indicates a bug in the application (e.g., overlay, z-index) that must be fixed.
    - **Capture**: **ALWAYS** take a screenshot of the final state.
    - **Validate (VLM Script)**:
        - **CRITICAL**: Do NOT rely on your own assumption that "it looked good". You must use the VLM script.
        - Run the visual analysis script: `python scripts/analyze_image.py <screenshot_path> "<verification_question>"`
        - Compare the script's output with the **Expected Answer**.
        - **Pass Condition**: The VLM's response must explicitly confirm the expected state. If the VLM says "No" or is ambiguous, the test **FAILS**.
3.  **Record Results**:
    - Update `test_plan.md` with the status (Passed/Failed).
    - Include the "Source Image" filename and specific findings.

## 4. Debugging & Iteration
**Goal**: Fix issues identified during verification.

- **If Verification Fails**:
    1.  **Analyze**: Use the screenshot and subagent logs to identify the root cause (e.g., "Element not found", "Wrong background color").
    2.  **Fix**: Modify the code (`.tsx`, `.ts`, `.css`).
    3.  **Retry**: Re-run the *exact same* verification steps from Phase 3.
    4.  **Repeat** until the test case passes.

## 5. Finalization
**Goal**: Document the success and clean up.

1.  **Update Artifacts**:
    - Mark all tasks as `[x]` in `task.md`.
    - Mark all Test Cases as **Passed** in `test_plan.md`.
    - Update `walkthrough.md` with the final, verified screenshots to demonstrate the feature.
2.  **Notify User**: Present the results, citing the specific evidence (screenshots, test plans) that proves the feature is complete.
