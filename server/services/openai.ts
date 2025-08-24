import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key",
  baseURL: process.env.OPENAI_BASE_URL || undefined 
});

const model = process.env.OPENAI_MODEL || "gpt-4.1-mini"; // Default to the most cost-effective model

export interface VideoAnalysis {
  summary: string;
  keyPoints: string[];
  topics: string[];
  sentiment: string;
  visualElements: string[];
  transcription: string[];  // Array of timestamped descriptions
}

export interface KeyFrameAnalysis {
  summary: string;
  keyPoints: string[];
  topics: string[];
  sentiment: string;
  visualElements: string[];
}

export interface FrameBatchTranscription {
  transcription: string[];
}

// Analyze key frames for high-level insights only
export async function analyzeKeyFrames(frameData: Array<{base64: string, timestamp: number}>, language: string = 'en'): Promise<KeyFrameAnalysis> {
  try {
    // Prepare images for the request
    const imageContent = frameData.map(frame => ({
      type: "image_url" as const,
      image_url: {
        url: `data:image/jpeg;base64,${frame.base64}`,
        detail: "low" as const
      }
    }));

    const timestamps = frameData.map(frame => {
      const minutes = Math.floor(frame.timestamp / 60);
      const seconds = Math.floor(frame.timestamp % 60);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    });

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: `You are a video analyst. Analyze these KEY video frames to understand the overall video content and themes. Focus on:
          - Main themes and topics
          - Key visual elements and patterns
          - Overall sentiment and mood
          - Important moments and transitions
          
          Do NOT generate transcriptions - focus on high-level analysis only.
          
          ${language === 'ja' ? 'Please respond in Japanese.' : 'Please respond in English.'}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze these ${frameData.length} key video frames taken at timestamps ${timestamps.join(', ')} and provide high-level analysis ONLY:
              
              Return JSON with this structure:
              {
                "summary": "Comprehensive summary covering main themes and content",
                "keyPoints": ["[00:00] key observation 1", "[00:01] key observation 2", "[00:02] key observation 3"],
                "topics": ["main topic 1", "main topic 2"],
                "sentiment": "overall mood/sentiment",
                "visualElements": ["visual element 1", "visual element 2"]
              }`
            },
            ...imageContent
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 3000,
    });

    const responseContent = response.choices[0].message.content || "{}";
    let result;
    try {
      result = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("JSON parsing failed:", parseError);
      result = {
        summary: "Video analysis completed with limited details due to response format issues",
        keyPoints: ["Video content analyzed", "Processing completed"],
        topics: ["General content"],
        sentiment: "neutral",
        visualElements: ["Various visual elements detected"]
      };
    }
    
    return {
      summary: result.summary || "Unable to analyze video content",
      keyPoints: result.keyPoints || [],
      topics: result.topics || [],
      sentiment: result.sentiment || "neutral",
      visualElements: result.visualElements || []
    };
  } catch (error) {
    console.error("Error analyzing key frames:", error);
    throw new Error("Failed to analyze key frames");
  }
}

// Generate detailed transcription with context from key frame analysis
export async function transcribeFrameBatch(
  frameData: Array<{base64: string, timestamp: number}>, 
  context: KeyFrameAnalysis | null,
  language: string = 'en'
): Promise<FrameBatchTranscription> {
  try {
    // Prepare images for the request
    const imageContent = frameData.map(frame => ({
      type: "image_url" as const,
      image_url: {
        url: `data:image/jpeg;base64,${frame.base64}`,
        detail: "low" as const
      }
    }));

    const timestamps = frameData.map(frame => {
      const minutes = Math.floor(frame.timestamp / 60);
      const seconds = Math.floor(frame.timestamp % 60);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    });

    const contextText = context ? `
Video Context (for reference):
- Main themes: ${context.topics.join(', ')}
- Key visual elements: ${context.visualElements.join(', ')}
- Overall sentiment: ${context.sentiment}
- Summary: ${context.summary}

Use this context to provide meaningful frame descriptions that connect to the bigger picture.` : '';

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: `You are a video transcriber. Create detailed frame-by-frame descriptions. Focus on:
          - Specific actions and movements in each frame
          - Important objects and changes
          - Environmental details
          
          Keep each transcription entry SHORT (10-15 words) and focused on what's happening in that specific moment.
          
          ${language === 'ja' ? 'Please respond in Japanese.' : 'Please respond in English.'}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${contextText}
              
              Transcribe these ${frameData.length} video frames taken at timestamps ${timestamps.join(', ')}.
              
              Return JSON with this structure:
              {
                "transcription": ["[${timestamps[0]}] description", "[${timestamps[1] || '00:01'}] description", "... for ALL frames"]
              }
              
              CRITICAL: Create transcription entries for ALL ${frameData.length} frames. Keep each entry 8-15 words.`
            },
            ...imageContent
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 15000,
    });

    const responseContent = response.choices[0].message.content || "{}";
    let result;
    try {
      result = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("JSON parsing failed:", parseError);
      result = {
        transcription: frameData.map((_, index) => {
          const minutes = Math.floor(frameData[index].timestamp / 60);
          const seconds = Math.floor(frameData[index].timestamp % 60);
          const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          return `[${timestamp}] Frame ${index + 1} processed`;
        })
      };
    }
    
    return {
      transcription: result.transcription || []
    };
  } catch (error) {
    console.error("Error transcribing frame batch:", error);
    throw new Error("Failed to transcribe frame batch");
  }
}

// DEPRECATED: Use analyzeKeyFrames() and transcribeFrameBatch() instead
export async function analyzeVideoFrames(frameData: Array<{base64: string, timestamp: number}>, language: string = 'en'): Promise<VideoAnalysis> {
  try {
    // Prepare images for the request
    const imageContent = frameData.map(frame => ({
      type: "image_url" as const,
      image_url: {
        url: `data:image/jpeg;base64,${frame.base64}`,
        detail: "low" as const
      }
    }));

    const timestamps = frameData.map(frame => {
      const minutes = Math.floor(frame.timestamp / 60);
      const seconds = Math.floor(frame.timestamp % 60);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    });

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: `You are a video analyst. Analyze these video frames chronologically and create a concise transcription. Focus on:
          - Key actions and movements
          - Important objects and changes
          - Brief environmental details
          
          Keep each transcription entry SHORT (10-20 words) to avoid response truncation.
          
          ${language === 'ja' ? 'Please respond in Japanese.' : 'Please respond in English.'}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze these ${frameData.length} video frames taken at timestamps ${timestamps.join(', ')} and provide:
              1. A comprehensive video analysis covering the full duration
              2. A complete transcription with entries for ALL ${frameData.length} frames using timestamps: [${timestamps[0]}], [${timestamps[1] || '00:01'}], etc.
              
              Return JSON with this structure:
              {
                "summary": "Comprehensive summary covering entire video duration",
                "keyPoints": ["[00:00] key observation 1", "[00:01] key observation 2", "[00:02] key observation 3"],
                "topics": ["main topic 1", "main topic 2"],
                "sentiment": "overall mood/sentiment",
                "visualElements": ["visual element 1", "visual element 2"],
                "transcription": ["[00:00] description", "[00:01] description", "... for ALL frames"]
              }
              
              CRITICAL: Create transcription entries for ALL ${frameData.length} frames. Keep each entry 8-12 words for full coverage.`
            },
            ...imageContent
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 30000, // Increased to accommodate more transcription entries
    });

    const responseContent = response.choices[0].message.content || "{}";
    console.log("Raw OpenAI response length:", responseContent.length);
    console.debug("Response preview:", responseContent.substring(0, 200) + "...");

    let result;
    try {
      result = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("JSON parsing failed:", parseError);
      console.error("Content that failed to parse:", responseContent);
      
      // Try to extract JSON from potentially malformed response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (fallbackError) {
          console.error("Fallback JSON parsing also failed:", fallbackError);
          // Create minimal fallback response
          result = {
            summary: "Video analysis completed with limited details due to response format issues",
            keyPoints: ["Video content analyzed", "Processing completed"],
            topics: ["General content"],
            sentiment: "neutral",
            visualElements: ["Various visual elements detected"],
            transcription: frameData.map((_, index) => {
              const minutes = Math.floor(frameData[index].timestamp / 60);
              const seconds = Math.floor(frameData[index].timestamp % 60);
              const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
              return `[${timestamp}] Frame ${index + 1} analyzed`;
            })
          };
        }
      } else {
        console.log("No JSON structure found, creating minimal response");
        // Create minimal fallback response
        result = {
          summary: "Video analysis completed with basic frame detection",
          keyPoints: ["Video frames processed", "Content detected"],
          topics: ["Video content"],
          sentiment: "neutral",
          visualElements: ["Visual content present"],
          transcription: frameData.map((_, index) => {
            const minutes = Math.floor(frameData[index].timestamp / 60);
            const seconds = Math.floor(frameData[index].timestamp % 60);
            const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            return `[${timestamp}] Frame ${index + 1} processed`;
          })
        };
      }
    }
    
    return {
      summary: result.summary || "Unable to analyze video content",
      keyPoints: result.keyPoints || [],
      topics: result.topics || [],
      sentiment: result.sentiment || "neutral",
      visualElements: result.visualElements || [],
      transcription: result.transcription || []
    };
  } catch (error) {
    console.error("Error analyzing video frames:", error);
    const errorMsg = (error as Error).message;
    if (errorMsg?.includes("JSON") || errorMsg?.includes("parse")) {
      throw new Error("AI analysis response format error - please try uploading again");
    }
    throw new Error("Failed to analyze video content");
  }
}

// Keep the single frame function for backward compatibility
export async function analyzeVideoFrame(base64Frame: string): Promise<VideoAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: "You are a video analysis expert. Analyze the provided video frame and return detailed insights in JSON format. Focus on visual elements, content, style, and overall composition."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this video frame and provide a comprehensive analysis including summary, key points, topics, sentiment, visual elements, and a single transcription entry. Return the response in JSON format with the following structure: { 'summary': string, 'keyPoints': string[], 'topics': string[], 'sentiment': string, 'visualElements': string[], 'transcription': string[] }"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Frame}`,
                "detail": "low"
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      summary: result.summary || "Unable to analyze video content",
      keyPoints: result.keyPoints || [],
      topics: result.topics || [],
      sentiment: result.sentiment || "neutral",
      visualElements: result.visualElements || [],
      transcription: result.transcription || []
    };
  } catch (error) {
    console.error("Error analyzing video frame:", error);
    throw new Error("Failed to analyze video content");
  }
}

export async function chatWithVideo(message: string, videoAnalysis: VideoAnalysis, chatHistory: Array<{message: string, response: string}>, availableFrames: string[] = [], language: string = 'en'): Promise<{
  response: string;
  rephrasedQuestion: string;
  relevantFrame: string | null;
}> {
  try {
    const context = `
Video Analysis Context:
- Summary: ${videoAnalysis.summary}
- Key Points: ${videoAnalysis.keyPoints.join(", ")}
- Topics: ${videoAnalysis.topics.join(", ")}
- Visual Elements: ${videoAnalysis.visualElements.join(", ")}
- Transcription: ${videoAnalysis.transcription.join("\n")}

Available Frame Files (IMPORTANT - Only reference these exact filenames):
${availableFrames.join(", ")}

Previous Chat History:
${chatHistory.map(h => `User: ${h.message}\nAI: ${h.response}`).join("\n\n")}
`;

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: `You are an AI assistant specialized in video content analysis. Your task is to:
          1. Rephrase the user's question into a complete, clear sentence based on the video context
          2. Provide a detailed answer based on the video analysis
          3. Identify the most relevant frame from the transcription if applicable
          4. Be BRIEF and CONCISE in your responses

          ${language === 'ja' ? 'すべての回答を日本語で書いてください。質問の言い換えと回答の両方を日本語で提供してください。' : 'Please respond in English.'}
          
          Return JSON with this structure:
          {
            "rephrasedQuestion": "Complete sentence version of the user's question with video context",
            "response": "Detailed answer to the question",
            "relevantFrame": "exact filename from available frames list or null (e.g., frame_003_14.1s.jpg or ['frame_037_74.0s.jpg','frame_056_112.0s.jpg'])"
          }
          
          CRITICAL: For relevantFrame, you MUST use only the exact filename(s) from the "Available Frame Files" list above. Do not create or guess frame names.`
        },
        {
          role: "user",
          content: `${context}\n\nUser Question: ${message}
          Please rephrase the question into a complete sentence with video context, provide a helpful response based on the video analysis, and identify the most relevant frame filename if applicable. 
          IMPORTANT: Only use exact frame filenames from the Available Frame Files list above.`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 5000,
    });

    const responseContent = response.choices[0].message.content || '{}';
    console.debug("Chat response content:", responseContent);
    
    let result;
    try {
      result = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("JSON parsing failed:", parseError);
      console.error("Content that failed to parse:", responseContent);
      
      // Try to extract JSON from potentially malformed response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (fallbackError) {
          console.error("Fallback JSON parsing also failed:", fallbackError);
          // Create minimal fallback response
          result = {
            rephrasedQuestion: message,
            response: "I apologize, but I encountered an issue processing your question. Please try asking again or rephrase your question.",
            relevantFrame: null
          };
        }
      } else {
        console.log("No JSON structure found, creating minimal response");
        // Create minimal fallback response
        result = {
          rephrasedQuestion: message,
          response: "I'm unable to provide a response at the moment due to a formatting issue. Please try asking your question again.",
          relevantFrame: null
        };
      }
    }
    return {
      response: result.response || "I'm unable to provide a response at the moment.",
      rephrasedQuestion: result.rephrasedQuestion || message,
      relevantFrame: Array.isArray(result.relevantFrame) 
        ? JSON.stringify(result.relevantFrame) 
        : result.relevantFrame || null
    };
  } catch (error) {
    console.error("Error in chat response:", error);
    console.error("Error details:", {
      message: (error as Error).message,
      stack: (error as Error).stack
    });
    throw new Error("Failed to generate chat response");
  }
}

export async function generateVideoSummary(videoAnalyses: VideoAnalysis[], language: string = 'en'): Promise<string> {
  try {
    const combinedContext = videoAnalyses.map((analysis, index) => 
      `Video ${index + 1}:\n- Summary: ${analysis.summary}\n- Key Points: ${analysis.keyPoints.join(", ")}\n- Topics: ${analysis.topics.join(", ")}`
    ).join("\n\n");

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: `You are an expert at creating concise summaries. Create a comprehensive summary of the selected videos, highlighting common themes, key insights, and important visual elements. ${language === 'ja' ? 'すべての回答を日本語で書いてください。' : 'Please respond in English.'}`
        },
        {
          role: "user",
          content: `Create a comprehensive summary based on the following video analyses:\n\n${combinedContext}`
        }
      ],
      max_tokens: 300,
    });

    return response.choices[0].message.content || "Unable to generate summary";
  } catch (error) {
    console.error("Error generating summary:", error);
    throw new Error("Failed to generate video summary");
  }
}
