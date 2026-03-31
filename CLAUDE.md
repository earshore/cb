# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeBuddy2API is a FastAPI-based proxy service that wraps the CodeBuddy official API and provides an OpenAI-compatible interface. It enables any OpenAI-compatible client to use CodeBuddy's AI models through a standardized `/v1/chat/completions` endpoint.

## Core Architecture

### Request Flow
1. Client sends OpenAI-format request to `/codebuddy/v1/chat/completions`
2. `codebuddy_router.py` validates request and retrieves credentials from `codebuddy_token_manager.py`
3. `codebuddy_api_client.py` converts OpenAI message format to CodeBuddy format
4. Request is forwarded to CodeBuddy API (always as stream=true, since CodeBuddy only supports streaming)
5. For non-streaming clients: `StreamResponseAggregator` collects all SSE chunks and returns a complete response
6. For streaming clients: SSE chunks are converted to OpenAI format and forwarded directly

### Key Components

**src/codebuddy_router.py** - Main API router
- Handles `/v1/chat/completions` endpoint
- `CodeBuddyStreamService`: Manages streaming and non-streaming responses
- `StreamResponseAggregator`: Converts CodeBuddy's streaming response to OpenAI's non-streaming format
- `OpenAICompatibilityConverter`: Fixes tool call ID format (tooluse_xxx → call_xxx) and index mapping
- Uses global HTTP client pool for connection reuse

**src/codebuddy_api_client.py** - CodeBuddy API client
- `convert_openai_to_codebuddy_messages()`: Converts message formats, handles tool calls/results
- `generate_codebuddy_headers()`: Creates required headers including conversation IDs and user agent
- Filters out error messages to prevent channel detection (11128)

**src/codebuddy_token_manager.py** - Credential management
- Loads credentials from `.codebuddy_creds/*.json` files
- Supports automatic rotation based on `CODEBUDDY_ROTATION_COUNT`
- Checks token expiration (created_at + expires_in)
- Persists state to `manager_state.json` for manual selection and rotation settings

**config.py** - Configuration system
- Multi-layer config: in-memory → config.json → .env → defaults
- Hot-reload support via `update_settings()`
- Persists to `config/config.json`

**src/auth.py** - Service authentication
- Bearer token authentication using `CODEBUDDY_PASSWORD`
- Required for all API endpoints

**web.py** - Application entry point
- FastAPI app with lifespan management
- Mounts all routers: frontend, auth, API, settings
- Uses Hypercorn as ASGI server

## Development Commands

### Start the service
```bash
# Windows
start.bat

# Linux/macOS
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python web.py
```

### Run directly (after venv activation)
```bash
python web.py
```

The service will start on `http://127.0.0.1:8001` by default.

## Configuration

All configuration is managed through `.env` file or environment variables:

- `CODEBUDDY_PASSWORD` (required) - Service access password
- `CODEBUDDY_HOST` - Server host (default: 127.0.0.1)
- `CODEBUDDY_PORT` - Server port (default: 8001)
- `CODEBUDDY_API_ENDPOINT` - CodeBuddy API URL (default: https://www.codebuddy.ai)
- `CODEBUDDY_CREDS_DIR` - Credentials directory (default: .codebuddy_creds)
- `CODEBUDDY_LOG_LEVEL` - Logging level (default: INFO)
- `CODEBUDDY_MODELS` - Comma-separated model list
- `CODEBUDDY_ROTATION_COUNT` - Credential rotation frequency (default: 1)
- `CODEBUDDY_SSL_VERIFY` - SSL verification (default: false)

## Important Implementation Details

### Tool Call Handling
- **Multi-tool call fix**: `StreamResponseAggregator` uses tool call ID as key (not index) because CodeBuddy sends all tool calls with index=0
- Tool call IDs are converted from `tooluse_xxx` to `call_xxx` format for OpenAI compatibility
- Tool results must have valid `toolUseId` matching regex `[a-zA-Z0-9_-]+`

### Message Format Conversion
- CodeBuddy requires at least 2 messages; single user messages get a system message prepended
- Tool role is converted to user role
- Structured content (tool_use, tool_result) is preserved; text content is flattened to strings
- Error messages containing "API error" are filtered to prevent channel detection

### Streaming vs Non-Streaming
- CodeBuddy API only supports streaming (stream=true)
- For non-streaming clients: backend collects all chunks via `StreamResponseAggregator` and returns complete response
- For streaming clients: chunks are forwarded with OpenAI format conversion

### Credential Management
- Credentials are JSON files in `.codebuddy_creds/` directory
- Automatic rotation when `CODEBUDDY_ROTATION_COUNT > 0` and `auto_rotation_enabled = true`
- Manual selection overrides automatic rotation
- Expired tokens (based on created_at + expires_in) are automatically skipped

### HTTP Client Pool
- Global `httpx.AsyncClient` instance shared across requests
- Configured with 300s timeout, 20 keepalive connections, 100 max connections
- Properly cleaned up on application shutdown via lifespan manager

## Testing the API

```bash
# Non-streaming request
curl -X POST "http://127.0.0.1:8001/codebuddy/v1/chat/completions" \
  -H "Authorization: Bearer your_password" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto-chat",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Streaming request
curl -X POST "http://127.0.0.1:8001/codebuddy/v1/chat/completions" \
  -H "Authorization: Bearer your_password" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto-chat",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

## Web Management Interface

Access the admin panel at `http://127.0.0.1:8001/` to:
- Manage credentials (add, delete, view status)
- Auto-authenticate via OAuth2 flow
- View credential expiration status
- Toggle automatic rotation
- Manually select specific credentials

## Code Style Notes

- All user-facing text and comments are in Chinese
- Async/await pattern used throughout for high concurrency
- Comprehensive error handling with HTTPException
- Structured logging with context information
- Type hints used for function signatures
