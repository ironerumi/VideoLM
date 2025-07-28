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
}

export async function analyzeVideoFrame(base64Frame: string): Promise<VideoAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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
              text: "Analyze this video frame and provide a comprehensive analysis including summary, key points, topics, sentiment, and visual elements. Return the response in JSON format with the following structure: { 'summary': string, 'keyPoints': string[], 'topics': string[], 'sentiment': string, 'visualElements': string[] }"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Frame}`
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
      visualElements: result.visualElements || []
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
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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
