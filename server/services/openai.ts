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
export async function analyzeVideoFrames(frameData: Array<{base64: string, timestamp: number}>): Promise<VideoAnalysis> {
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
          
          Be extremely observant and describe what you see with forensic precision, like Sherlock Holmes examining a crime scene.`
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
    console.error("Error analyzing video frames:", error);
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

export async function chatWithVideo(message: string, videoAnalysis: VideoAnalysis, chatHistory: Array<{message: string, response: string}>): Promise<string> {
  try {
    const context = `
Video Analysis Context:
- Summary: ${videoAnalysis.summary}
- Key Points: ${videoAnalysis.keyPoints.join(", ")}
- Topics: ${videoAnalysis.topics.join(", ")}
- Visual Elements: ${videoAnalysis.visualElements.join(", ")}

Previous Chat History:
${chatHistory.map(h => `User: ${h.message}\nAI: ${h.response}`).join("\n\n")}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini", // the newest OpenAI model is "gpt-4.1-mini" which is more cost-effective. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an AI assistant specialized in video content analysis. Use the provided video analysis context and chat history to answer questions about the video content. Be specific, informative, and reference the visual elements when relevant."
        },
        {
          role: "user",
          content: `${context}\n\nUser Question: ${message}`
        }
      ],
      max_tokens: 500,
    });

    return response.choices[0].message.content || "I'm unable to provide a response at the moment.";
  } catch (error) {
    console.error("Error in chat response:", error);
    throw new Error("Failed to generate chat response");
  }
}

export async function generateVideoSummary(videoAnalyses: VideoAnalysis[]): Promise<string> {
  try {
    const combinedContext = videoAnalyses.map((analysis, index) => 
      `Video ${index + 1}:\n- Summary: ${analysis.summary}\n- Key Points: ${analysis.keyPoints.join(", ")}\n- Topics: ${analysis.topics.join(", ")}`
    ).join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini", // the newest OpenAI model is "gpt-4.1-mini" which is more cost-effective. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert at creating concise summaries. Create a comprehensive summary of the selected videos, highlighting common themes, key insights, and important visual elements."
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
