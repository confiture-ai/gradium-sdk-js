# Gradium AI SDK (JavaScript / TypeScript)

Unofficial TypeScript SDK for the [Gradium API](https://gradium.ai) — low-latency, high-quality Text-to-Speech and Speech-to-Text services.

## Features

- 🎙️ **Text-to-Speech (TTS)** — Convert text to natural-sounding speech
- 🎧 **Speech-to-Text (STT)** — Transcribe audio with real-time streaming
- 🗣️ **Voice Cloning** — Create custom voices from audio samples
- 🌍 **Multilingual** — Support for English, French, German, Spanish, and Portuguese
- ⚡ **Low Latency** — Sub-300ms time-to-first-token
- 🔄 **Streaming** — Real-time audio streaming via WebSockets

## Installation

```bash
bun add gradium-ai
# or
npm install gradium-ai
# or
pnpm add gradium-ai
```

## Quick Start

```typescript
import Gradium from '@confiture-ai/gradium-ai';

const client = new Gradium({
  apiKey: process.env['GRADIUM_API_KEY'], // This is the default and can be omitted
});

// Text-to-Speech
const result = await client.tts.create({
  voice_id: 'YTpq7expH9539ERJ', // Emma's voice
  output_format: 'wav',
  text: 'Hello, world! Welcome to Gradium.',
});

await Bun.write('output.wav', result.raw_data);
```

## Configuration

### Client Options

```typescript
const client = new Gradium({
  apiKey: 'gd_your_api_key',  // Required (or set GRADIUM_API_KEY env var)
  region: 'eu',               // 'eu' or 'us' (default: 'eu')
  baseURL: 'https://...',     // Custom API URL (optional)
  timeout: 30000,             // Request timeout in ms (default: 30000)
});
```

### Environment Variables

```bash
# bash/zsh
export GRADIUM_API_KEY=gd_your_api_key_here

# fish
set -x GRADIUM_API_KEY gd_your_api_key_here
```

## Text-to-Speech (TTS)

### Basic Usage

```typescript
const result = await client.tts.create({
  voice_id: 'YTpq7expH9539ERJ',
  output_format: 'wav',
  text: 'I love confiture!',
});

console.log(`Sample rate: ${result.sample_rate}`);
console.log(`Request ID: ${result.request_id}`);
await Bun.write('output.wav', result.raw_data);
```

### Streaming TTS

```typescript
const stream = await client.tts.stream({
  voice_id: 'YTpq7expH9539ERJ',
  output_format: 'pcm',
});

await stream.waitReady();
stream.sendText('Hello, this is streamed audio.');
stream.sendEndOfStream();

for await (const chunk of stream) {
  console.log(`Received ${chunk.length} bytes`);
  // Process audio chunk...
}
```

### Streaming with Text Generator

```typescript
async function* textGenerator() {
  yield 'Hello, ';
  yield 'this is ';
  yield 'streamed ';
  yield 'text.';
}

const stream = await client.tts.streamText(
  { voice_id: 'YTpq7expH9539ERJ', output_format: 'pcm' },
  textGenerator()
);

for await (const chunk of stream) {
  // Process audio chunk...
}
```

### Speed Control

```typescript
// Slower speech (positive padding_bonus: 0.1 to 4.0)
const slower = await client.tts.create({
  voice_id: 'YTpq7expH9539ERJ',
  output_format: 'wav',
  text: 'This is slower speech.',
  json_config: { padding_bonus: 2.0 },
});

// Faster speech (negative padding_bonus: -4.0 to -0.1)
const faster = await client.tts.create({
  voice_id: 'YTpq7expH9539ERJ',
  output_format: 'wav',
  text: 'This is faster speech.',
  json_config: { padding_bonus: -2.0 },
});
```

### Adding Breaks/Pauses

```typescript
const result = await client.tts.create({
  voice_id: 'YTpq7expH9539ERJ',
  output_format: 'wav',
  text: 'First sentence. <break time="1.5s" /> Second sentence after a pause.',
});
```

### Output Formats

| Format | Description |
|--------|-------------|
| `wav` | Standard WAV file |
| `pcm` | Raw PCM (48kHz, 16-bit, mono) |
| `opus` | Opus codec |
| `ulaw_8000` | μ-law 8kHz |
| `alaw_8000` | A-law 8kHz |
| `pcm_16000` | PCM 16kHz |
| `pcm_24000` | PCM 24kHz |

## Speech-to-Text (STT)

### Basic Streaming

```typescript
const stream = await client.stt.stream({
  input_format: 'pcm',
  model_name: 'default',
});

const readyInfo = await stream.waitReady();
console.log(`Sample rate: ${readyInfo.sample_rate}`);

// Send audio chunks
stream.sendAudio(audioChunk1);
stream.sendAudio(audioChunk2);
stream.sendEndOfStream();

// Process transcription results
for await (const result of stream) {
  console.log(`${result.text} (at ${result.start_s}s)`);
}
```

### Transcribe Complete Audio

```typescript
const audioData = await Bun.file('audio.wav').arrayBuffer();
const text = await client.stt.transcribe(
  { input_format: 'wav' },
  new Uint8Array(audioData)
);

console.log(`Transcription: ${text}`);
```

### Voice Activity Detection (VAD)

```typescript
const stream = await client.stt.stream({ input_format: 'pcm' });
await stream.waitReady();

// Monitor VAD for turn-taking
for await (const vad of stream.iterVAD()) {
  const inactivityProb = vad.vad[2]?.inactivity_prob ?? 0;
  if (inactivityProb > 0.8) {
    console.log('Speaker likely finished');
  }
}
```

### Audio Format Requirements (PCM)

- **Sample Rate**: 24000 Hz (24kHz)
- **Bit Depth**: 16-bit signed integer (little-endian)
- **Channels**: Mono
- **Chunk Size**: 1920 samples (80ms) recommended

## Voices

### List Voices

```typescript
const voices = await client.voices.list();
console.log(voices);

// Include catalog voices
const allVoices = await client.voices.list({
  include_catalog: true,
  limit: 50,
});
```

### Get Voice

```typescript
const voice = await client.voices.get('voice_uid_here');
console.log(voice.name);
```

### Create Voice

```typescript
// From file path
const voice = await client.voices.create({
  audio_file: './my_voice_sample.wav',
  name: 'My Custom Voice',
  description: 'A voice created from my recording',
  language: 'en',
});

// From Blob
const blob = new Blob([audioData], { type: 'audio/wav' });
const voice = await client.voices.create({
  audio_file: blob,
  name: 'My Custom Voice',
});
```

### Update Voice

```typescript
await client.voices.update('voice_uid_here', {
  name: 'Updated Name',
  description: 'Updated description',
});
```

### Delete Voice

```typescript
await client.voices.delete('voice_uid_here');
```

## Credit Management

```typescript
const credits = await client.credits.get();
console.log(`Remaining: ${credits.remaining_credits}/${credits.allocated_credits}`);
console.log(`Plan: ${credits.plan_name}`);
console.log(`Next rollover: ${credits.next_rollover_date}`);
```

## Available Voices

### Flagship Voices

| Name | Voice ID | Language | Gender | Description |
|------|----------|----------|--------|-------------|
| Emma | `YTpq7expH9539ERJ` | en-US | Feminine | Pleasant and smooth, ready to assist |
| Kent | `LFZvm12tW_z0xfGo` | en-US | Masculine | Relaxed and authentic American |
| Sydney | `jtEKaLYNn6iif5PR` | en-US | Feminine | Joyful and airy |
| John | `KWJiFWu2O9nMPYcR` | en-US | Masculine | Warm, low-pitched broadcaster |
| Eva | `ubuXFxVQwVYnZQhy` | en-GB | Feminine | Joyful and dynamic British |
| Jack | `m86j6D7UZpGzHsNu` | en-GB | Masculine | Pleasant British |
| Elise | `b35yykvVppLXyw_l` | fr-FR | Feminine | Warm French |
| Leo | `axlOaUiFyOZhy4nv` | fr-FR | Masculine | Warm French |
| Mia | `-uP9MuGtBqAvEyxI` | de-DE | Feminine | Joyful German |
| Maximilian | `0y1VZjPabOBU3rWy` | de-DE | Masculine | Warm German |
| Valentina | `B36pbz5_UoWn4BDl` | es-MX | Feminine | Warm Mexican |
| Sergio | `xu7iJ_fn2ElcWp2s` | es-ES | Masculine | Warm Spanish |
| Alice | `pYcGZz9VOo4n2ynh` | pt-BR | Feminine | Warm Brazilian |
| Davi | `M-FvVo9c-jGR4PgP` | pt-BR | Masculine | Engaging Brazilian |

> 💡 You can also create your own [custom voices](#voices).

## Error Handling

```typescript
import { 
  GradiumError,
  AuthenticationError,
  ValidationError,
  RateLimitError,
  WebSocketError 
} from '@confiture-ai/gradium-sdk-js';

try {
  const result = await client.tts.create({ ... });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.errors);
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof WebSocketError) {
    console.error(`WebSocket error (${error.code}):`, error.message);
  } else if (error instanceof GradiumError) {
    console.error('Gradium error:', error.message);
  }
}
```

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import type {
  Voice,
  VoiceCreateParams,
  TTSSetupParams,
  TTSResult,
  STTSetupParams,
  CreditsSummary,
} from '@confiture-ai/gradium-sdk-js';
```

## Testing

Run the test suite with:

```bash
bun test
```

### Test Structure

Tests use mocked WebSocket and fetch — no real API calls are made:

- **WebSocket mocking** — TTS/STT streams are fully simulated
- **Fetch mocking** — REST API calls (voices, credits) use `spyOn(globalThis, "fetch")`

### Creating Test Audio Files

For integration tests requiring real audio files:

```bash
# Using ffmpeg - creates a 0.1 second silent WAV
ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t 0.1 -f wav test.wav
```

## License

MIT
