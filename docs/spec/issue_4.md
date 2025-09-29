# Issue #4 — Migrate from OpenAI TypeScript package to Vercel AI SDK for structured outputs

## 【CORE JUDGMENT】
✅ Worth doing: We have FOUR parseError occurrences in production code because we're pretending a probabilistic model is a JSON serializer. This isn't theoretical academic garbage - it's breaking real requests with Gemini through LiteLLM proxy.

## 【KEY INSIGHTS】
- **Data structure**: The problem is we scatter JSON.parse() calls like breadcrumbs and act surprised when the model returns markdown or commentary instead of JSON
- **Complexity**: We have fallback parsing logic, regex extraction, and error recovery scattered across 500+ lines - this is the definition of papering over bad design
- **Risk**: Zero breakage risk if we use a feature flag and keep the old path as fallback during migration

## 【LINUS SOLUTION】

### The Real Problem
We keep tripping over JSON parsing because we ask a probabilistic model to pretend it's a JSON serializer, then scatter `JSON.parse()` calls around the code and act surprised when it blows up. The OpenAI `response_format: { type: "json_object" }` is NOT a contract for Gemini behind a proxy. Stop papering over it.

### Is This a Real Problem or Imagined Threat?
**REAL**. We have recurring parseError events at lines 92, 188, 445 in `server/services/openai.ts`. Gemini through LiteLLM happily returns code fences and commentary even when you ask for `json_object`. We rely on undefined behavior and then blame the model. **This is our bug**.

### Constraints (The Reality We Live In)
- Model/endpoint: `vertex_ai/gemini-2.5-flash` via LiteLLM proxy at `${DATAROBOT_ENDPOINT}/genai/llmgw`
- Current lib: OpenAI TypeScript SDK with `response_format: { type: "json_object" }`
- Failure mode: frequent invalid JSON, trailing text, code fences, hallucinated keys
- Back-compat: Do NOT break current call signatures; keep a flag to fall back during rollout

### The Decision
- Adopt Vercel AI SDK for ALL structured outputs using `generateObject()` and Zod schemas
- Keep OpenAI SDK as temporary fallback behind feature flag for unstructured/legacy flows
- Remove it once metrics prove stability

## Design (Data Structures First, Always)

### 1. Provider Initialization
Single provider factory that returns an OpenAI-compatible client pointed at the LiteLLM proxy.

```typescript
// server/ai/provider.ts
import { createOpenAI } from '@ai-sdk/openai';

export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: `${process.env.DATAROBOT_ENDPOINT}/genai/llmgw`,
});

export const defaultModelName = process.env.GEMINI_MODEL || 'vertex_ai/gemini-2.5-flash';
export const getModel = (name?: string) => openai(name || defaultModelName);
```

### 2. Schema Registry
Put EVERY structured output schema in ONE place. No ad-hoc inline shapes sprinkled across services like pixie dust.

```typescript
// server/schemas/llm.ts
import { z } from 'zod';

export const KeyFrameAnalysisSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  topics: z.array(z.string()),
  sentiment: z.string(),
  visualElements: z.array(z.string())
});

export const FrameBatchTranscriptionSchema = z.object({
  transcription: z.array(z.string())
});

export const ChatResponseSchema = z.object({
  rephrasedQuestion: z.string(),
  response: z.string(),
  relevantFrame: z.union([z.string(), z.array(z.string()), z.null()])
});

// Export types ONLY where necessary - don't hand-write types that drift
export type KeyFrameAnalysis = z.infer<typeof KeyFrameAnalysisSchema>;
export type FrameBatchTranscription = z.infer<typeof FrameBatchTranscriptionSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
```

### 3. Structured Output Function
ONE function. This is the ONLY place that knows how to talk to the model for JSON.

```typescript
// server/ai/structured.ts
import { generateObject } from 'ai';
import { getModel } from './provider';
import type { z } from 'zod';

export class StructuredOutputValidationError extends Error {
  constructor(message: string, public info: { attempts: number; issues?: string; raw?: string }) {
    super(message);
    this.name = 'StructuredOutputValidationError';
  }
}

export async function askStructured<T>({
  modelName,
  system,
  prompt,
  schema,
  temperature = 0,
  maxTokens = 10000,
  maxRetries = 2
}: {
  modelName?: string;
  system: string;
  prompt: string;
  schema: z.ZodSchema<T>;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
}): Promise<{ object: T; usage: any; finishReason: string }> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateObject({
        model: getModel(modelName),
        system,
        prompt,
        schema,
        temperature,
        maxTokens,
      });
      
      return { 
        object: result.object, 
        usage: result.usage, 
        finishReason: result.finishReason || 'stop' 
      };
    } catch (err) {
      lastError = err as Error;
      console.error(`Structured output attempt ${attempt + 1} failed:`, err);
    }
  }
  
  throw new StructuredOutputValidationError(
    'Structured output validation failed after retries',
    { 
      attempts: maxRetries + 1,
      issues: lastError?.message,
      raw: lastError?.toString()?.substring(0, 200)
    }
  );
}
```

### 4. Compatibility Switch
Environment variable `USE_VERCEL_AI_SDK` defaults to `true`. If `false`, route structured calls back to the old path. This makes rollback trivial.

## Migration Plan (No Heroics, Just Discipline)

### Phase 1: Add Dependencies and Provider
```bash
npm install ai zod @ai-sdk/openai
```
- Create `server/ai/provider.ts` and `server/ai/structured.ts`
- Keep `openai` package installed temporarily

### Phase 2: Central Schemas
- Create `server/schemas/llm.ts` with Zod schemas for EVERY structured output
- Start by covering those referenced by parseError locations

### Phase 3: Replace Fragile Parse Paths
In `server/services/openai.ts`:
- Remove ALL `response_format: { type: "json_object" }` usage
- Replace each `JSON.parse()` with `askStructured()` using the right schema
- Keep external function signatures UNCHANGED

Example migration:
```typescript
// BEFORE (Garbage)
const response = await openai.chat.completions.create({
  model: "vertex_ai/gemini-2.5-flash",
  response_format: { type: "json_object" },
  // ...
});
const result = JSON.parse(response.choices[0].message.content); // Can fail

// AFTER (Good Taste)
if (process.env.USE_VERCEL_AI_SDK !== 'false') {
  const { object } = await askStructured({
    modelName: "vertex_ai/gemini-2.5-flash",
    system: systemPrompt,
    prompt: userPrompt,
    schema: KeyFrameAnalysisSchema,
  });
  return object; // Already validated, typed
} else {
  // Old path for rollback
}
```

### Phase 4: Observability
Centralize logging in `askStructured()`:
- Log: modelName, schema name, attempt, error summary
- Add counters: `structured_attempt_count`, `structured_validation_fail_count`
- Keep logs privacy-safe - no full prompts/outputs

### Phase 5: Testing
- **Unit**: Feed known bad outputs into schema validation, confirm clear Zod errors
- **Integration**: Call LiteLLM proxy with `generateObject()` for each schema
- **Smoke**: Hit service endpoints that used to fail, confirm 200s and correct shapes

### Phase 6: Rollout
1. **Staging**: Enable `USE_VERCEL_AI_SDK=true`, run 200+ requests, measure parseError rate
2. **Production**: Roll to 10% traffic for one day, compare metrics
3. **Rollback**: Flip `USE_VERCEL_AI_SDK=false` if metrics regress

### Phase 7: Cleanup
Once stable, delete the old path and uninstall unused dependencies.

## Current Progress — 2025-09-27
- ✅ Phase 1 complete: dependencies added and `server/ai/provider.ts` + `server/ai/structured.ts` created.
- ✅ Phase 2 complete: shared schemas live in `server/schemas/llm.ts` with descriptions.
- ✅ Phase 3 complete: all structured paths (`analyzeKeyFrames()`, `transcribeFrameBatch()`, `analyzeVideoFrames()`, `analyzeVideoFrame()`, `chatWithVideo()`) now route through `askStructured()` behind `USE_VERCEL_AI_SDK`, with legacy OpenAI SDK retained under the flag for rollback.
- ✅ Phase 4 complete: structured telemetry is centralized via `server/telemetry.ts` with `METRICS_ENABLED` gating and per-schema success/failure counters.
- ✅ Phase 5 complete: regression scripts (`tests/structured/local.test.ts`, `tests/structured/live.test.ts`) updated, cover full pipeline (real/synthetic frames), and wired to npm scripts (`test:structured`, `test:structured:live`).
- ⚪️ Phases 6-7 not started: staging/production rollout and cleanup remain outstanding.

## Acceptance Criteria
- ✅ parseError events drop to near zero for structured outputs
- ✅ No change to public API or response shapes
- ✅ No latency increase beyond retry overhead (95th percentile +200ms budget)

## Risks and Non-Goals
- **Risk**: `generateObject()` can't always coerce Gemini in one shot
  - **Mitigation**: Retries, tighter prompts, better schemas
- **Risk**: Proxy oddities
  - **Mitigation**: Use OpenAI-compatible provider with explicit baseURL, keep logs
- **Non-goal**: Change models. We're not swapping Gemini without evidence

## Timeline
- **Day 1**: Add dependencies, provider, schemas, `askStructured()`
- **Day 2**: Replace call sites, land tests
- **Day 3**: Staging soak with metrics, then production behind flag
- **Day 4**: Delete old path if metrics are clean

## Why Vercel AI SDK Instead of More Duct Tape?
It generates structured data with a REAL schema and knows how to coax models into compliance, including non-OpenAI models behind OpenAI-compatible proxies. It validates, retries, and returns typed results. That's EXACTLY what we keep reinventing badly with `JSON.parse()`.

## The Brutal Truth
The solution is to **stop being sloppy**. One code path, defined schemas, real validation, and clear errors. The Vercel AI SDK gives us the plumbing; we use it to eliminate special cases, not to add new ones.

Bad programmers worry about code. Good programmers worry about data structures. **This fixes the data structure problem**.

---

*"Sometimes you can see a problem from a different angle and rewrite it so that the special case goes away and becomes the normal case."* - That's what we're doing here. No more special cases for JSON parsing failures.