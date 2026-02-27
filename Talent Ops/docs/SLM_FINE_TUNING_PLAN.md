# SLM Fine-Tuning Plan: Privacy-First AI Native Features

## Objective
Transition the current AI native features (**AI Risk Analysis** and **AI Planning Assistant**) from external cloud providers (OpenAI) to a locally hosted or private **Small Language Model (SLM)**. This ensures data privacy, reduced latency, and specific domain alignment for TalentOps.

---

## 1. Feature Specifications
We are optimizing for two distinct AI tasks:

### Feature A: AI Risk & Productivity Coach
*   **Input:** Task metrics (hours elapsed, progress ratio, phase status, step completion).
*   **Behavior:** Reason about the metrics to predict delays and explain risks.
*   **Desired Output:** Risk level (Low/Med/High), reasoning array, and recommended coaching actions.

### Feature B: AI Planning Assistant
*   **Input:** Task title, description, and skill tags.
*   **Behavior:** Decompose a broad task into professional, granular checklist steps.
*   **Desired Output:** JSON array of steps (Title, Duration (2h/4h), Phase ID).

---

## 2. Phase 1: Data Strategy & Dataset Preparation
To fine-tune an SLM, we need a high-quality dataset of **Input/Output Pairs**.

1.  **Extract GPT-4o Logs:** Use the existing `task_risk_snapshots` and `task_steps` tables to extract successful GPT-4o generations as training ground truth.
2.  **Synthetic Data Generation:** Use a large model (GPT-4o) to generate 1,000+ diverse task/step examples and metrics/risk examples to broaden the dataset.
3.  **Data Cleaning:** Ensure metrics align with the logic we fixed (e.g., using `completed` status and `phase_validations`).
4.  **Formatting (JSON Tuning):** Store data in **Alpaca** or **ShareGPT** format, ensuring the model is trained to output **Strict JSON only**.

---

## 3. Phase 2: SLM Selection (The Base Model)
We will target models that can run efficiently on mid-range hardware (or private servers):
*   **Llama-3.2 (1B / 3B):** Best-in-class performance for small parameter sizes.
*   **Mistral-7B-v0.3:** Highly reliable for structured reasoning.
*   **Phi-3.5 Mini (3.8B):** Strong logic and mathematical reasoning (Good for Risk Metrics).

---

## 4. Phase 3: Fine-Tuning Strategy (LoRA/QLoRA)
We will use **Low-Rank Adaptation (LoRA)** to train the model without needing massive GPU resources:
*   **Domain Alignment:** Train the model on "TalentOps Vocabulary" (Requirement Refiner, Build Guidance, etc.).
*   **Strict JSON Enforcement:** Fine-tune specifically on the JSON schemas defined in `ai_native_feature_research.md`.
*   **Persona Tuning:** Ensure the "Productivity Coach" voice is consistent (encouraging but firm).

---

## 5. Phase 4: Serving & Infrastructure
*   **Inference Engine:** Use **Ollama** or **vLLM** for local serving.
*   **GPU Specs:** 16GB VRAM (Single A10G or 3090/4090) is sufficient for 4-bit quantized 7B models.
*   **Supabase Integration:** Replace the current `supabase.functions.invoke('analyze-task-risk')` with a call to our private SLM endpoint. Keep the same JSON interface so the frontend requires **zero changes**.

---

## 6. Phase 5: Evaluation & Fallback
1.  **Benchmark:** Compare SLM output against GPT-4o-mini using "Rogue-L" or "Human Review" scores.
2.  **Confidence Check:** If the SLM output is invalid JSON, fall back to GPT-4o-mini temporarily.
3.  **Cost Savings:** Track the reduction in API costs as we move 90% of requests to the local SLM.

---

## 7. Timeline
*   **Week 1:** Dataset collation from `task_risk_snapshots`.
*   **Week 2:** LoRA Fine-tuning on Llama-3.2 3B.
*   **Week 3:** Deployment of private inference endpoint.
*   **Week 4:** Full migration & GPT Fallback implementation.
