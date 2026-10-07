import { createFileRoute } from "@tanstack/react-router";
import { verifyToken } from "@/lib/auth";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";

import { POLICY_CONTEXT } from "@/data/hr-policy";

function calculateConfidence(
  question: string,
  policy: string,
) {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "are",
    "you",
    "what",
    "when",
    "how",
    "can",
    "does",
    "with",
    "this",
    "that",
    "have",
    "from",
    "about",
    "please",
    "tell",
    "my",
    "is",
    "to",
    "of",
    "in",
    "do",
    "i",
    "me",
    "get",
    "will",
    "would",
  ]);

  const questionWords = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 2 &&
        !stopWords.has(word),
    );

  const policyWords = new Set(
    policy
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 2 &&
          !stopWords.has(word),
      ),
  );

  if (questionWords.length === 0) {
    return 0;
  }

  const matches = questionWords.filter((word) =>
    policyWords.has(word),
  ).length;

  const matchRatio =
    matches / questionWords.length;

  return Math.min(
    100,
    Math.round(matchRatio * 100),
  );
}

const SYSTEM_PROMPT = `You are "Leavy", the HR leave assistant for the company.

Answer ONLY using the HR policy knowledge base below.

Rules:
- Be short, direct and friendly.
- Always give the concrete number or rule when the policy has one.
- When relevant, mention the form or portal to use and who to contact.
- End factual answers with the policy reference in brackets, e.g. [AL-3.1].
- If the question is not covered by the policy, say you don't have that information in the leave policy and suggest contacting HR Operations.
- Never invent numbers.
- Speak to the employee as "you".

HR POLICY KNOWLEDGE BASE
========================
${POLICY_CONTEXT}`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {

        // 1. Check JWT authentication
        const authHeader =
          request.headers.get("authorization");

        if (!authHeader?.startsWith("Bearer ")) {
          return new Response(
            JSON.stringify({
              error:
                "Unauthorized. Please log in.",
            }),
            {
              status: 401,
              headers: {
                "content-type":
                  "application/json",
              },
            },
          );
        }

        const token =
          authHeader.substring(7);

        const user =
          await verifyToken(token);

        if (!user) {
          return new Response(
            JSON.stringify({
              error:
                "Invalid or expired login.",
            }),
            {
              status: 401,
              headers: {
                "content-type":
                  "application/json",
              },
            },
          );
        }

        // 2. Check Gemini API key
        const apiKey =
          process.env["GEMINI_API_KEY"];

        if (!apiKey) {
          return new Response(
            JSON.stringify({
              error:
                "Gemini AI is not configured for this app yet.",
            }),
            {
              status: 500,
              headers: {
                "content-type":
                  "application/json",
              },
            },
          );
        }

        try {
          // 3. Read chat messages
          const body =
            (await request.json()) as {
              messages: UIMessage[];
            };

          console.log(
            "Chat request received:",
            body.messages?.length,
          );

          // 4. Convert messages
          const modelMessages =
            await convertToModelMessages(
              body.messages ?? [],
            );

          console.log(
            "Messages converted successfully.",
          );

          // 5. Find latest user question
          const latestUserMessage = [
            ...(body.messages ?? []),
          ]
            .reverse()
            .find(
              (message) =>
                message.role === "user",
            );

          const questionText =
            latestUserMessage?.parts
              ?.filter(
                (part) =>
                  part.type === "text",
              )
              .map(
                (part) => part.text,
              )
              .join(" ") ?? "";

          // 6. Calculate policy match
          const confidence =
            calculateConfidence(
              questionText,
              POLICY_CONTEXT,
            );

          console.log(
            "Policy confidence:",
            confidence + "%",
          );

          // 7. Create Gemini client
          const google =
            createGoogleGenerativeAI({
              apiKey,
            });

          // 8. Use reliable fallback model
          //
          // Gemini 3.7 Flash is currently
          // experiencing high demand, so we
          // use the tested Flash-Lite model.
          const model =
            google(
              "gemini-3.5-flash-lite",
            );

          console.log(
            "Using Gemini 3.5 Flash-Lite",
          );

          // 9. Generate response
          const result = streamText({
            model,
            system: SYSTEM_PROMPT,
            messages: modelMessages,
          });

          console.log(
            "Gemini stream started.",
          );

          // 10. Return streamed response
          // with confidence metadata
          return result.toUIMessageStreamResponse({
            messageMetadata: ({ part }) => {
              if (part.type === "start") {
                return {
                  confidence,
                };
              }

              return undefined;
            },

            onError: (error) => {
              console.error(
                "hr-chat stream error:",
                error,
              );

              return "Sorry, something went wrong while answering. Please try again.";
            },
          });

        } catch (error) {
          console.error(
            "hr-chat error:",
            error,
          );

          return new Response(
            JSON.stringify({
              error:
                "The assistant is unavailable right now.",
            }),
            {
              status: 502,
              headers: {
                "content-type":
                  "application/json",
              },
            },
          );
        }
      },
    },
  },
});