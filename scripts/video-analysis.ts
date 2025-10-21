import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { config } from 'dotenv';

config({ override: true });

const model = "vertex_ai/gemini-2.5-flash";
const apiKey = process.env.DATAROBOT_API_KEY || process.env.DATAROBOT_API_TOKEN;
const endpoint = process.env.DATAROBOT_ENDPOINT;

if (!apiKey) {
  console.error('Error: DATAROBOT_API_KEY environment variable is not set');
  process.exit(1);
}

if (!endpoint) {
  console.error('Error: DATAROBOT_ENDPOINT environment variable is not set');
  process.exit(1);
}

// Try different DataRobot API paths
const baseURL = `${endpoint}/genai/llmgw`;

console.log('Debug info:');
console.log('API Key:', apiKey ? 'Set (length: ' + apiKey.length + ')' : 'Not set');
console.log('Endpoint:', endpoint);
console.log('Base URL:', baseURL);
console.log('Model:', model);

const client = new OpenAI({
  apiKey,
  baseURL,
});

// Returns a single JSON object with nested table per requirements
async function analyzeVideo4Sewage() {
  try {
    const videoPath = path.join(process.cwd(), 'data', 'F25-047_048.mp4');

    if (!fs.existsSync(videoPath)) {
      console.error(`Error: Video file not found at ${videoPath}`);
      process.exit(1);
    }

    console.log(`Reading video file: ${videoPath}`);
    const videoBytes = fs.readFileSync(videoPath);
    const encodedData = videoBytes.toString('base64');
    // check encodedData size in MB
    console.log(`Encoded data size: ${encodedData.length / 1024 / 1024} MB`);

    // Structured prompt tailored for sewage footage key-frame extraction
    const messages = [
      {
        role: "system" as const,
        content: "You are a sewage inspection assistant. Return ONLY a valid JSON object matching the requested schema.",
      },
      {
        role: "user" as const,
        content: [
          {
            type: "file" as const,
            file: {
              // file_id: `https://storage.googleapis.com/ygu_test/best.mp4?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=service-account-837%40ygu-test.iam.gserviceaccount.com%2F20251020%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20251020T161703Z&X-Goog-Expires=900&X-Goog-SignedHeaders=host&X-Goog-Signature=a8beab6225b436bb7eae2cb4fe8c77c166ae0f1ce00e9c1c6810c7745d20e240fbf5e6f3e704c94f59bf34663b30472b25324cdc0f86222e8aac33e524b62a2cc33ff1c385fb0eda669d5f4ee5eb179e91851f4272f0abd3beb994d838fabe08f4b8d71ba072c773ae3a6284effef94352e5d7b148fec8a2ae4367b3b6ef242522650d126b54dcfb897fad1b21c5e0a5e6ad930bcdca490b44aa477f1957890246964377305002e5b82f210c78016decbbaac9301ec847d376857c1bb930c2081302514218844913fc627ae7cc2570c9f6cc3fde3817260588ff0bc28e42c735ea59f535e5b62ac1935ae1f3e2c139d7bc21a82a6bf252e60c1f92c8d0cbfe53`,
              // format: "video/mp4"
              file_data: `data:video/mp4;base64,${encodedData}`,
            },
          },
          {
            type: "text" as const,
            text: `You are a sewage inspection assistant tasked to extract key info from drone footage.

Requirements:
- Only extract KEY frames: frames that show either cracks or leaks.
- Camera angle is the annotation at top-right. If the dot is centered, angle = 'front'; if dot at top, angle = 'top'. Choose one of: [top, left, right, down, front].
- Include any on-frame annotations verbatim in the 'note'.
- Distance must be numeric in meters and should NOT include unit text (e.g., 2.89). If the display is missing for a key frame, infer distance based on frame sequence.
- The constant bottom-line text is the inspection task ID; return it as 'title' and DO NOT include it redundantly in the table rows.
- If an annotation says '浸水' it's a leak for sure. If not annotated but you assess a leak, include it.

Schema (return EXACTLY this JSON shape):
{
  "title": string, // the inspection task ID shown constantly at bottom of footage
  "table": {
    "columns": ["timestamp","joint_no","distance","camera_angle","crack","leak","note"],
    "rows": [
      {
        "timestamp": "MM:SS", // like 03:19
        "joint_no": string,    // e.g., J4 or J6-7
        "distance": number,    // meters, numeric only
        "camera_angle": "top"|"left"|"right"|"down"|"front",
        "crack": "yes"|"no",
        "leak": "yes"|"no",
        "note": string         // include annotations like 浸入水B, 左取付管-2, etc.
      }
    ]
  }
}

Notes:
- Timestamp format must be MM:SS.
- Only include rows for frames with cracks or leaks.
- Prefer annotations for joint numbers (e.g., J4, J6-7). If missing, infer when reasonable.
- Camera angle determination must use the top-right circle/dot indicator.
- Ensure output is STRICT JSON with no markdown or extra text.`,
          },
        ],
      },
    ];

    console.log('Sending structured sewage analysis request to DataRobot endpoint...');

    const response = await client.chat.completions.create({
      model,
      messages: messages as any,
      // Enforce JSON-only responses (pattern used by server/services/openai.ts)
      response_format: { type: "json_object" } as any,
      // Generous token limit to allow multiple key rows
      max_tokens: 50000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    let result: any;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.error('Raw response content:', content);
      // Attempt to salvage JSON from the response if the model added extra text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (fallbackError) {
          console.error('Fallback JSON parsing also failed:', fallbackError);
          throw new Error('Sewage analysis returned malformed JSON');
        }
      } else {
        throw new Error('No JSON object found in sewage analysis response');
      }
    }

    // Print structured JSON result
    console.log('\nSewage Analysis Result (JSON):');
    console.log(JSON.stringify(result, null, 2));

    if (response.usage) {
      console.log('\nUsage:\n', response.usage);
    }
  } catch (error) {
    console.error('Error (analyzeVideo4Sewage):', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
  }
}

// CLI entry: default analyzeVideo, or sewage mode via flag (ESM-safe)
import { fileURLToPath } from 'url';
const argvScript = process.argv[1] ? path.resolve(process.argv[1]) : '';
const thisFile = path.resolve(fileURLToPath(import.meta.url));
const isDirectRun = argvScript && argvScript === thisFile;

if (isDirectRun) {
  const args = process.argv.slice(2).map(a => a.toLowerCase());
  
  console.log('Analyzing video for sewage inspection...');
  analyzeVideo4Sewage();
}
