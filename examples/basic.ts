/**
 * Basic usage examples for the Gradium SDK
 *
 * Run with: bun examples/basic.ts
 */

import Gradium from "../src";

const client = new Gradium({
  apiKey: process.env.GRADIUM_API_KEY,
});

async function main() {
  console.log("=== Gradium SDK Examples ===\n");

  // Example 1: Check credits
  console.log("1. Checking credits...");
  try {
    const credits = await client.credits.get();
    console.log(credits);
    console.log(
      `   Credits: ${credits.remaining_credits}/${credits.allocated_credits}`
    );
    console.log(`   Plan: ${credits.plan_name}`);
  } catch (_error) {
    console.log("   (Skipped - requires valid API key)");
  }

  // Example 2: List voices
  console.log("\n2. Listing voices...");
  try {
    const voices = await client.voices.list({
      include_catalog: true,
      limit: 5,
    });
    console.log(`   Found ${voices.length} voices`);
    voices.slice(0, 3).forEach((v) => {
      console.log(`   - ${v.name} (${v.uid})`);
    });
  } catch (_error) {
    console.log("   (Skipped - requires valid API key)");
  }

  // Example 3: Text-to-Speech
  console.log("\n3. Text-to-Speech...");
  try {
    const result = await client.tts.create({
      voice_id: "YTpq7expH9539ERJ", // Emma
      output_format: "wav",
      text: "Hello! Welcome to Gradium. This is a test of the text to speech system.",
    });
    console.log(`   Generated ${result.raw_data.length} bytes of audio`);
    console.log(`   Sample rate: ${result.sample_rate}Hz`);
    console.log(`   Request ID: ${result.request_id}`);

    // Save to file
    await Bun.write("output.wav", result.raw_data);
    console.log("   Saved to output.wav");
  } catch (_error) {
    console.log("   (Skipped - requires valid API key)");
  }

  // Example 4: Streaming TTS
  console.log("\n4. Streaming TTS...");
  try {
    const stream = await client.tts.stream({
      voice_id: "YTpq7expH9539ERJ",
      output_format: "pcm",
    });

    await stream.waitReady();
    console.log(`   Stream ready, request ID: ${stream.getRequestId()}`);

    stream.sendText(
      "This is a streaming example. The audio is generated in real-time."
    );
    stream.sendEndOfStream();

    let totalBytes = 0;
    for await (const chunk of stream.iterBytes()) {
      totalBytes += chunk.length;
    }
    console.log(`   Received ${totalBytes} bytes of streaming audio`);
  } catch (_error) {
    console.log("   (Skipped - requires valid API key)");
  }

  console.log("\n=== Examples Complete ===");
}

main().catch(console.error);
