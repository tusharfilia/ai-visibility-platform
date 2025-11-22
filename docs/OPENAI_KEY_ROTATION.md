# OpenAI Key Rotation Setup

This document explains how to configure multiple OpenAI API keys for automatic rotation to handle rate limits and quota issues.

## Overview

The OpenAI provider now supports **automatic key rotation** with up to 10 keys. When a key hits a rate limit (429 error), the system automatically rotates to the next available key.

## Configuration Methods

You can configure multiple OpenAI keys in two ways:

### Method 1: Comma-Separated String (Recommended)

Set a single environment variable with all keys separated by commas:

```bash
OPENAI_API_KEY=sk-key1,sk-key2,sk-key3,sk-key4,sk-key5
```

### Method 2: Individual Environment Variables

Set individual environment variables for each key:

```bash
OPENAI_API_KEY_1=sk-key1
OPENAI_API_KEY_2=sk-key2
OPENAI_API_KEY_3=sk-key3
OPENAI_API_KEY_4=sk-key4
OPENAI_API_KEY_5=sk-key5
```

You can use up to `OPENAI_API_KEY_10` if needed.

## Railway Configuration

In your Railway project, add the keys to the **Variables** tab:

### Option A: Comma-Separated (Easier)
```
OPENAI_API_KEY=sk-xxx1,sk-xxx2,sk-xxx3,sk-xxx4,sk-xxx5
```

### Option B: Individual Variables
```
OPENAI_API_KEY_1=sk-xxx1
OPENAI_API_KEY_2=sk-xxx2
OPENAI_API_KEY_3=sk-xxx3
OPENAI_API_KEY_4=sk-xxx4
OPENAI_API_KEY_5=sk-xxx5
```

## How It Works

1. **Round-Robin Rotation**: Keys are rotated in order for each request
2. **Automatic Rate Limit Handling**: When a key receives a 429 (rate limit) error:
   - The key is marked as rate-limited
   - The system automatically switches to the next available key
   - Rate-limited keys are skipped for 1 minute, then retried
3. **Fallback**: If all keys are rate-limited, the system will still attempt requests (they may fail, but ensures we try)

## Benefits

- **Higher Throughput**: Distribute requests across multiple keys
- **Automatic Recovery**: No manual intervention needed when keys hit rate limits
- **Resilience**: If one key fails, others continue working
- **Quota Management**: Spread usage across multiple accounts/keys

## Monitoring

The system logs when keys are rate-limited:
```
OpenAI API key rate-limited, rotating to next key. Attempt 1/5
```

## Notes

- Keys are rotated in the order they're provided
- Rate-limited keys are automatically retried after 1 minute
- The system supports up to 10 keys (can be extended if needed)
- All keys must be valid OpenAI API keys

