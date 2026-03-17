# LM Studio REST API Reference

Complete API documentation for LM Studio v1 REST API endpoints.

**Source:** https://lmstudio.ai/docs/developer/rest

---

## Overview

LM Studio offers a powerful REST API with first-class support for local inference and model management. In addition to the native API, LM Studio provides:
- **OpenAI-compatible endpoints** (`/v1/*`)
- **Anthropic-compatible endpoints** (`/v1/messages`)
- **Native v1 REST API** (`/api/v1/*`)

## What's New in v1

With LM Studio 0.4.0+, the native v1 REST API at `/api/v1/*` endpoints is officially released and recommended.

**Enhanced features include:**
- MCP (Model Context Protocol) via API
- Stateful chats
- Authentication configuration with API tokens
- Model download, load, and unload endpoints

---

## Supported Endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/v1/chat` | POST | Chat with a model |
| `/api/v1/models` | GET | List available models |
| `/api/v1/models/load` | POST | Load a model into memory |
| `/api/v1/models/unload` | POST | Unload a model from memory |
| `/api/v1/models/download` | POST | Download a model |
| `/api/v1/models/download/status` | GET | Get download status |

---

## Inference Endpoint Comparison

| Feature | `/api/v1/chat` | `/v1/responses` | `/v1/chat/completions` | `/v1/messages` |
| --- | --- | --- | --- | --- |
| Streaming | ✅ | ✅ | ✅ | ✅ |
| Stateful chat | ✅ | ✅ | ❌ | ❌ |
| Remote MCPs | ✅ | ✅ | ❌ | ❌ |
| MCPs you have in LM Studio | ✅ | ✅ | ❌ | ❌ |
| Custom tools | ❌ | ✅ | ✅ | ✅ |
| Include assistant messages in the request | ❌ | ✅ | ✅ | ✅ |
| Model load streaming events | ✅ | ❌ | ❌ | ❌ |
| Prompt processing streaming events | ✅ | ❌ | ❌ | ❌ |
| Specify context length in the request | ✅ | ❌ | ❌ | ❌ |

---

## POST /api/v1/chat

Send a message to a model and receive a response. Supports MCP integration.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Unique identifier for the model to use |
| `input` | string \| array | Yes | Message to send to the model |
| `system_prompt` | string | No | System message that sets model behavior |
| `integrations` | array | No | List of integrations (plugins, MCP servers) |
| `stream` | boolean | No | Whether to stream via SSE (default: `false`) |
| `temperature` | number | No | Randomness in token selection [0,1] |
| `top_p` | number | No | Minimum cumulative probability [0,1] |
| `top_k` | integer | No | Limits to top-k most probable tokens |
| `min_p` | number | No | Minimum base probability [0,1] |
| `repeat_penalty` | number | No | Penalty for repeating tokens (1 = no penalty) |
| `max_output_tokens` | integer | No | Maximum tokens to generate |
| `reasoning` | string | No | Reasoning setting: "off", "low", "medium", "high", "on" |
| `context_length` | integer | No | Number of tokens for context (recommended for MCP) |
| `store` | boolean | No | Whether to store the chat (default: `true`) |
| `previous_response_id` | string | No | Response ID to append to (starts with "resp_") |

### Input Types

**Text Input:**
```json
{
  "type": "message",
  "content": "Your message text here"
}
```

**Image Input:**
```json
{
  "type": "image",
  "data_url": "data:image/png;base64,..."
}
```

### Integration Types

**Plugin:**
```json
{
  "type": "plugin",
  "id": "mcp/playwright",
  "allowed_tools": ["browser_navigate"]
}
```

**Ephemeral MCP Server:**
```json
{
  "type": "ephemeral_mcp",
  "server_label": "huggingface",
  "server_url": "https://huggingface.co/mcp",
  "allowed_tools": ["model_search"],
  "headers": {}
}
```

### Example Request

```bash
curl http://localhost:1234/api/v1/chat \
  -H "Authorization: Bearer $LM_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ibm/granite-4-micro",
    "input": "Tell me about quantum computing",
    "context_length": 8000,
    "temperature": 0.7
  }'
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `model_instance_id` | string | Unique identifier for the loaded model instance |
| `output` | array | Array of output items (message, tool_call, reasoning) |
| `stats` | object | Token usage and performance metrics |
| `response_id` | string | Response ID for subsequent requests (when `store: true`) |

### Output Types

**Message:**
```json
{
  "type": "message",
  "content": "Response text here"
}
```

**Tool Call:**
```json
{
  "type": "tool_call",
  "tool": "model_search",
  "arguments": { "query": "", "limit": 1 },
  "output": "...",
  "provider_info": {
    "type": "ephemeral_mcp",
    "server_label": "huggingface"
  }
}
```

**Reasoning:**
```json
{
  "type": "reasoning",
  "content": "Internal reasoning text"
}
```

### Stats Object

```json
{
  "input_tokens": 646,
  "total_output_tokens": 586,
  "reasoning_output_tokens": 0,
  "tokens_per_second": 29.75,
  "time_to_first_token_seconds": 1.088,
  "model_load_time_seconds": 2.656
}
```

---

## GET /api/v1/models

Get a list of available models (both LLMs and embedding models).

### Request

```bash
curl http://localhost:1234/api/v1/models \
  -H "Authorization: Bearer $LM_API_TOKEN"
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `models` | array | List of available models |
| `type` | string | "llm" or "embedding" |
| `publisher` | string | Model publisher name |
| `key` | string | Unique identifier for the model |
| `display_name` | string | Human-readable model name |
| `architecture` | string | Model architecture (e.g., "llama", "mistral") |
| `quantization` | object | Quantization information |
| `size_bytes` | number | Size of the model in bytes |
| `params_string` | string | Human-readable parameter count (e.g., "7B") |
| `loaded_instances` | array | Currently loaded instances |
| `max_context_length` | number | Maximum context length in tokens |
| `format` | string | Model file format ("gguf", "mlx") |
| `capabilities` | object | Model capabilities |

### Example Response

```json
{
  "models": [
    {
      "type": "llm",
      "publisher": "lmstudio-community",
      "key": "gemma-3-270m-it-qat",
      "display_name": "Gemma 3 270m Instruct Qat",
      "architecture": "gemma3",
      "quantization": {
        "name": "Q4_0",
        "bits_per_weight": 4
      },
      "size_bytes": 241410208,
      "params_string": "270M",
      "loaded_instances": [
        {
          "id": "gemma-3-270m-it-qat",
          "config": {
            "context_length": 4096,
            "eval_batch_size": 512,
            "flash_attention": false
          }
        }
      ],
      "max_context_length": 32768,
      "format": "gguf",
      "capabilities": {
        "vision": false,
        "trained_for_tool_use": false
      }
    }
  ]
}
```

---

## POST /api/v1/models/load

Load an LLM or Embedding model into memory.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Unique identifier for the model to load |
| `context_length` | number | No | Maximum tokens to consider |
| `eval_batch_size` | number | No | Tokens to process in single batch |
| `flash_attention` | boolean | No | Optimize attention computation |
| `num_experts` | number | No | Number of experts for MoE models |
| `offload_kv_cache_to_gpu` | boolean | No | Offload KV cache to GPU |
| `echo_load_config` | boolean | No | Echo final load config in response |

### Example Request

```bash
curl http://localhost:1234/api/v1/models/load \
  -H "Authorization: Bearer $LM_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "context_length": 16384,
    "flash_attention": true,
    "echo_load_config": true
  }'
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | "llm" or "embedding" |
| `instance_id` | string | Unique identifier for the loaded instance |
| `load_time_seconds` | number | Time taken to load |
| `status` | string | "loaded" |
| `load_config` | object | Final configuration (if `echo_load_config: true`) |

### Example Response

```json
{
  "type": "llm",
  "instance_id": "openai/gpt-oss-20b",
  "load_time_seconds": 9.099,
  "status": "loaded",
  "load_config": {
    "context_length": 16384,
    "eval_batch_size": 512,
    "flash_attention": true,
    "offload_kv_cache_to_gpu": true,
    "num_experts": 4
  }
}
```

---

## POST /api/v1/models/unload

Unload a loaded model from memory.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance_id` | string | Yes | Unique identifier of the model instance |

### Example Request

```bash
curl http://localhost:1234/api/v1/models/unload \
  -H "Authorization: Bearer $LM_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "openai/gpt-oss-20b"
  }'
```

### Response

```json
{
  "instance_id": "openai/gpt-oss-20b"
}
```

---

## POST /api/v1/models/download

Download LLMs and embedding models.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model identifier or Hugging Face URL |
| `quantization` | string | No | Quantization level (e.g., "Q4_K_M") |

### Example Request

```bash
curl http://localhost:1234/api/v1/models/download \
  -H "Authorization: Bearer $LM_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ibm/granite-4-micro"
  }'
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | string | Unique identifier for the download job |
| `status` | string | "downloading", "paused", "completed", "failed", "already_downloaded" |
| `total_size_bytes` | number | Total size of the download |
| `started_at` | string | Download start time (ISO 8601) |
| `completed_at` | string | Download completion time (ISO 8601) |

### Example Response

```json
{
  "job_id": "job_493c7c9ded",
  "status": "downloading",
  "total_size_bytes": 2279145003,
  "started_at": "2025-10-03T15:33:23.496Z"
}
```

---

## GET /api/v1/models/download/status/:job_id

Get the status of model downloads.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `job_id` | string | Yes | The download job ID |

### Example Request

```bash
curl -H "Authorization: Bearer $LM_API_TOKEN" \
  http://localhost:1234/api/v1/models/download/status/job_493c7c9ded
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | string | Unique identifier for the download job |
| `status` | string | "downloading", "paused", "completed", "failed" |
| `bytes_per_second` | number | Current download speed |
| `estimated_completion` | string | Estimated completion time |
| `total_size_bytes` | number | Total download size |
| `downloaded_bytes` | number | Bytes downloaded so far |
| `started_at` | string | Download start time |
| `completed_at` | string | Download completion time |

### Example Response

```json
{
  "job_id": "job_493c7c9ded",
  "status": "completed",
  "total_size_bytes": 2279145003,
  "downloaded_bytes": 2279145003,
  "started_at": "2025-10-03T15:33:23.496Z",
  "completed_at": "2025-10-03T15:43:12.102Z"
}
```

---

## Authentication

LM Studio supports API token authentication. Set the `Authorization` header:

```
Authorization: Bearer YOUR_API_TOKEN
```

Configure API tokens in LM Studio's settings.

---

## Streaming Events

When `stream: true` is set, responses are sent via Server-Sent Events (SSE).

### Event Types

- `start` - Stream started
- `delta` - Token delta
- `tool_call` - Tool call event
- `model_loading` - Model loading progress (v1 only)
- `prompt_processing` - Prompt processing event (v1 only)
- `finish` - Stream finished
- `error` - Error occurred

---

## OpenAI Compatible Endpoints

For compatibility with existing OpenAI-based applications:

| Endpoint | Description |
|----------|-------------|
| `GET /v1/models` | List models |
| `POST /v1/chat/completions` | Chat completions |
| `POST /v1/completions` | Text completions (legacy) |
| `POST /v1/embeddings` | Generate embeddings |
| `POST /v1/responses` | Responses with tools support |

---

## Anthropic Compatible Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /v1/messages` | Anthropic Messages API compatible |

---

## Error Handling

All endpoints return standard HTTP status codes:

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |
| 500 | Internal Server Error |

Error responses include a JSON body:
```json
{
  "error": "Error message here"
}
```

---

## Bug Reports

Please report bugs by opening an issue on [GitHub](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues).
