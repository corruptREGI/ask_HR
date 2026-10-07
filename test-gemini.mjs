import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

try {
  const result = streamText({
    model: google("gemini-3.7-flash"),
    prompt: "Reply with exactly: Gemini streaming works.",
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
} catch (error) {
  console.error(error);
}