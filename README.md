# Document Assistant Agent Backend

A powerful AI-powered document processing and search system built with the Smythos SDK, featuring vector database integration, natural language processing, and RESTful API endpoints.

## 🚀 Features

- **Document Indexing**: Upload and index PDF documents using vector embeddings
- **Semantic Search**: Search through documents using natural language queries
- **AI Agent Integration**: Powered by Google's Gemini AI for intelligent responses
- **Vector Database**: Pinecone integration for scalable document storage and retrieval
- **RESTful API**: Complete API for programmatic access
- **Chat Interface**: Interactive terminal chat mode
- **Production Ready**: Deployed on Render with environment configuration

## 📋 Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Usage Examples](#usage-examples)
- [Chat Mode](#chat-mode)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Development](#development)

## 🛠️ Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Pinecone account
- Google AI API key

### Local Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/agentbackend.git
   cd agentbackend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Start the server**
   ```bash
   # API mode (default)
   npm run start:api
   
   # Chat mode
   npm run start:chat
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here

# Google AI Configuration  
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
googleai=your_google_ai_api_key_here

# Server Configuration (optional)
PORT=5000
NODE_ENV=development
```

### API Keys Setup

1. **Pinecone**: Get your API key from [Pinecone Console](https://app.pinecone.io/)
2. **Google AI**: Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

## 🔗 API Endpoints

### Base URL
- **Local**: `http://localhost:5000`
- **Production**: `https://your-app.render.com`

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-09-23T07:00:00.000Z"
}
```

### List Skills
```http
GET /api/agent/skills
```

**Response:**
```json
{
  "success": true,
  "data": {
    "agentId": "document-assistant",
    "agentName": "Document Assistant", 
    "skills": [
      {
        "name": "index_document",
        "description": "Index a document in the vector database",
        "inputs": {
          "document_path": {
            "description": "Path to the PDF document file",
            "required": true
          }
        }
      }
    ]
  }
}
```

### Execute Individual Skills

#### 1. Index Document
```http
POST /api/agent/skills/index_document
Content-Type: application/json

{
  "document_path": "data/bitcoin.pdf"
}
```

#### 2. Search Documents  
```http
POST /api/agent/skills/lookup_document
Content-Type: application/json

{
  "user_query": "What is Bitcoin?"
}
```

#### 3. Get Document Info
```http
POST /api/agent/skills/get_document_info
Content-Type: application/json

{
  "document_name": "Bitcoin"
}
```

#### 4. Purge All Documents
```http
POST /api/agent/skills/purge_documents
Content-Type: application/json

{
  "confirmation": "yes"
}
```

### Natural Language Prompt
```http
POST /api/agent/prompt
Content-Type: application/json

{
  "message": "Index the Bitcoin whitepaper and then tell me about its main concepts"
}
```

### Execute Multiple Skills
```http
POST /api/agent/skills/execute-all
Content-Type: application/json

{
  "skillsToExecute": [
    {
      "skillName": "index_document",
      "parameters": {
        "document_path": "data/bitcoin.pdf"
      }
    },
    {
      "skillName": "lookup_document", 
      "parameters": {
        "user_query": "What is the main purpose of Bitcoin?"
      }
    }
  ]
}
```

## 📚 Usage Examples

### Curl Examples

1. **Health Check**
   ```bash
   curl http://localhost:5000/health
   ```

2. **List Available Skills**
   ```bash
   curl http://localhost:5000/api/agent/skills | jq
   ```

3. **Index a Document**
   ```bash
   curl -X POST http://localhost:5000/api/agent/skills/index_document \
     -H "Content-Type: application/json" \
     -d '{"document_path": "data/bitcoin.pdf"}' | jq
   ```

4. **Search Documents**
   ```bash
   curl -X POST http://localhost:5000/api/agent/skills/lookup_document \
     -H "Content-Type: application/json" \
     -d '{"user_query": "What is Bitcoin?"}' | jq
   ```

5. **Natural Language Query**
   ```bash
   curl -X POST http://localhost:5000/api/agent/prompt \
     -H "Content-Type: application/json" \
     -d '{"message": "Search for information about blockchain technology"}' | jq
   ```

### JavaScript/Node.js Examples

```javascript
const API_BASE = 'http://localhost:5000';

// Index a document
async function indexDocument(filePath) {
  const response = await fetch(`${API_BASE}/api/agent/skills/index_document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_path: filePath })
  });
  return response.json();
}

// Search documents
async function searchDocuments(query) {
  const response = await fetch(`${API_BASE}/api/agent/skills/lookup_document`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_query: query })
  });
  return response.json();
}

// Usage
(async () => {
  // Index document
  const indexResult = await indexDocument('data/bitcoin.pdf');
  console.log('Index Result:', indexResult);
  
  // Search  
  const searchResult = await searchDocuments('What is Bitcoin?');
  console.log('Search Result:', searchResult);
})();
```

### Python Examples

```python
import requests
import json

API_BASE = 'http://localhost:5000'

def index_document(file_path):
    response = requests.post(
        f'{API_BASE}/api/agent/skills/index_document',
        json={'document_path': file_path}
    )
    return response.json()

def search_documents(query):
    response = requests.post(
        f'{API_BASE}/api/agent/skills/lookup_document', 
        json={'user_query': query}
    )
    return response.json()

# Usage
if __name__ == '__main__':
    # Index document
    index_result = index_document('data/bitcoin.pdf')
    print('Index Result:', json.dumps(index_result, indent=2))
    
    # Search
    search_result = search_documents('What is Bitcoin?') 
    print('Search Result:', json.dumps(search_result, indent=2))
```

## 💬 Chat Mode

Start interactive chat mode:

```bash
npm run start:chat
```

Chat commands:
- Type natural language queries
- Use `/help` for available commands
- Use `/quit` to exit

Example chat session:
```
Document Assistant > Index the Bitcoin whitepaper
✅ Document indexed successfully!

Document Assistant > What is the main purpose of Bitcoin?
Based on the Bitcoin whitepaper, the main purpose of Bitcoin is to create a purely peer-to-peer version of electronic cash that allows online payments to be sent directly between parties without going through financial institutions...
```

## 🚀 Deployment

### Render Deployment

This project is configured for deployment on [Render](https://render.com).

1. **Fork/Clone** this repository
2. **Connect** to Render
3. **Set Environment Variables** in Render dashboard:
   - `GOOGLE_AI_API_KEY`
   - `PINECONE_API_KEY`
4. **Deploy** using the included `render.yaml`

The `render.yaml` configuration includes:
- Automatic builds
- Environment setup
- Health checks
- Production optimizations

### Manual Deployment

1. **Build for production**
   ```bash
   npm run build
   ```

2. **Set environment variables**
   ```bash
   export GOOGLE_AI_API_KEY=your_key
   export PINECONE_API_KEY=your_key
   export NODE_ENV=production
   ```

3. **Start production server**
   ```bash
   npm run start:production
   ```

## 🔧 Development

### Project Structure

```
agentbackend/
├── src/
│   ├── agents/              # AI agent definitions
│   │   └── BookAssistant.agent.ts
│   ├── api/                 # Express API server
│   │   └── server.ts
│   ├── utils/               # Utility functions
│   │   ├── SkillGate.ts
│   │   └── TerminalChat.ts
│   └── index.ts             # Main entry point
├── scripts/                 # Build and deployment scripts
├── data/                    # Sample documents
├── dist/                    # Built output
├── render.yaml              # Render deployment config
├── package.json
└── README.md
```

### Available Scripts

```bash
# Development
npm run dev              # Build and start in development
npm run dev:chat         # Start in chat mode

# Production  
npm run build            # Build TypeScript
npm run start            # Start API server
npm run start:api        # Start API server explicitly
npm run start:chat       # Start chat mode
npm run start:production # Production server with setup

# Utilities
npm run setup:production # Setup production environment
```

### Key Technologies

- **Smythos SDK**: AI agent framework
- **Express.js**: Web server
- **Pinecone**: Vector database
- **Google AI**: Language model
- **TypeScript**: Type safety
- **Rollup**: Module bundler

## 📖 API Skills Reference

### index_document
- **Purpose**: Index PDF documents into vector database
- **Input**: `document_path` (string) - Path to PDF file
- **Output**: Success/error message with indexing status

### lookup_document  
- **Purpose**: Search indexed documents using natural language
- **Input**: `user_query` (string) - Search query
- **Output**: Relevant document content with source

### get_document_info
- **Purpose**: Get metadata about documents via OpenLibrary API
- **Input**: `document_name` (string) - Document/book name
- **Output**: Document metadata (author, year, etc.)

### purge_documents
- **Purpose**: Delete all indexed documents from vector database
- **Input**: `confirmation` (string, optional) - "yes" to confirm
- **Output**: Confirmation of deletion

## 🔒 Security Notes

- API keys are stored in environment variables
- No authentication currently implemented (add as needed)
- CORS enabled for cross-origin requests
- Input validation on all endpoints

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
- Open an issue on GitHub
- Check the documentation
- Review the example code

## 🎯 Roadmap

- [ ] Authentication system
- [ ] Multiple file format support
- [ ] Batch document processing
- [ ] Advanced search filters
- [ ] Document summarization
- [ ] Multi-language support
- [ ] WebSocket for real-time updates