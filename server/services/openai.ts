import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

export interface VideoAnalysis {
  summary: string;
  keyPoints: string[];
  topics: string[];
  sentiment: string;
  visualElements: string[];
  transcription: string[];  // Array of timestamped descriptions
}

// New function to analyze all frames and generate transcription
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
      model: "gpt-4.1-mini", // the newest OpenAI model is "gpt-4.1-mini" which is more cost-effective. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are a master detective like Sherlock Holmes with extraordinary observational skills. Analyze these video frames in chronological order and create a detailed transcription of what happens. Focus on:
          - Actions and movements of people/objects
          - Environmental details and changes
          - Facial expressions and body language
          - Tools, objects, and their usage
          - Spatial relationships and positioning
          - Describe in 20-70 words per frame
          
          Be extremely observant and describe what you see with forensic precision, like Sherlock Holmes examining a crime scene.
          
          ${language === 'ja' ? 'Please respond in Japanese. すべての回答を日本語で書いてください。' : 'Please respond in English.'}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze these ${frameData.length} video frames taken at timestamps ${timestamps.join(', ')} and provide:
              1. A comprehensive video analysis
              2. A detailed transcription where each line starts with [${timestamps[0]}], [${timestamps[1] || '00:01'}], etc.
              
              Return JSON with this structure:
              {
                "summary": "Overall video summary",
                "keyPoints": ["key observation 1", "key observation 2"],
                "topics": ["main topics"],
                "sentiment": "overall mood/sentiment",
                "visualElements": ["visual elements observed"],
                "transcription": ["[00:00] detailed Sherlock Holmes-style description", "[00:01] next observation", ...]
              }
              
              Make the transcription descriptions vivid and precise, noting every detail like a detective would.`
            },
            ...imageContent
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4000, // Increased for detailed transcriptions
    });

    const responseContent = response.choices[0].message.content || "{}";
    console.log("Raw OpenAI response length:", responseContent.length);
    console.log("Response preview:", responseContent.substring(0, 200) + "...");
    
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
          throw new Error("OpenAI response contains malformed JSON");
        }
      } else {
        throw new Error("No valid JSON found in OpenAI response");
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
      model: "gpt-4.1-mini", // the newest OpenAI model is "gpt-4.1-mini" which is more cost-effective. do not change this unless explicitly requested by the user
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

export async function chatWithVideo(message: string, videoAnalysis: VideoAnalysis, chatHistory: Array<{message: string, response: string}>, language: string = 'en'): Promise<{
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

Previous Chat History:
${chatHistory.map(h => `User: ${h.message}\nAI: ${h.response}`).join("\n\n")}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini", // the newest OpenAI model is "gpt-4.1-mini" which is more cost-effective. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are an AI assistant specialized in video content analysis. Your task is to:
          1. Rephrase the user's question into a complete, clear sentence based on the video context
          2. Provide a detailed answer based on the video analysis
          3. Identify the most relevant frame from the transcription if applicable
          
          ${language === 'ja' ? 'すべての回答を日本語で書いてください。質問の言い換えと回答の両方を日本語で提供してください。' : 'Please respond in English.'}
          
          Return JSON with this structure:
          {
            "rephrasedQuestion": "Complete sentence version of the user's question with video context",
            "response": "Detailed answer to the question",
            "relevantFrame": "frame_XXX_YYs.jpg or null if no specific frame is most relevant"
          }`
        },
        {
          role: "user",
          content: `${context}\n\nUser Question: ${message}

Please rephrase the question into a complete sentence with video context, provide a helpful response based on the video analysis, and identify the most relevant frame filename if applicable (e.g., frame_003_3.0s.jpg).`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      response: result.response || "I'm unable to provide a response at the moment.",
      rephrasedQuestion: result.rephrasedQuestion || message,
      relevantFrame: result.relevantFrame || null
    };
  } catch (error) {
    console.error("Error in chat response:", error);
    throw new Error("Failed to generate chat response");
  }
}

export async function generateVideoSummary(videoAnalyses: VideoAnalysis[], language: string = 'en'): Promise<string> {
  try {
    const combinedContext = videoAnalyses.map((analysis, index) => 
      `Video ${index + 1}:\n- Summary: ${analysis.summary}\n- Key Points: ${analysis.keyPoints.join(", ")}\n- Topics: ${analysis.topics.join(", ")}`
    ).join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini", // the newest OpenAI model is "gpt-4.1-mini" which is more cost-effective. do not change this unless explicitly requested by the user
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
