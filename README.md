# Voice AI Agent Backend

A NestJS-based backend API for the Voice AI Agent HR application. This backend provides RESTful endpoints for managing voice agents, calls, contacts, dashboard analytics, and user settings.

## Features

- 🚀 **NestJS Framework** - Modern, scalable Node.js framework
- 🗄️ **MongoDB Database** - Mongoose for database management
- 📝 **TypeScript** - Full type safety
- ✅ **Validation** - Class-validator for request validation
- 📤 **File Upload** - Voice file upload support
- 🔍 **Global Search** - Search across agents, calls, and contacts
- 📊 **Analytics** - Dashboard statistics and analytics
- ⚙️ **Settings Management** - User profile, billing, API keys, webhooks

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- MongoDB database (local or MongoDB Atlas)

## Installation

1. **Clone the repository and navigate to the Backend directory:**

```bash
cd Backend
```

2. **Install dependencies:**

```bash
npm install
```

3. **Set up environment variables:**

Create a `.env` file in the root of the Backend directory:

```env
# Database Configuration
# Option 1: Use DATABASE_URL (recommended for MongoDB Atlas)
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/voice_ai_agent?retryWrites=true&w=majority

# Option 2: Use individual database config
DB_HOST=localhost
DB_PORT=27017
DB_USERNAME=admin
DB_PASSWORD=password
DB_NAME=voice_ai_agent

# CORS Configuration (comma-separated list of allowed origins)
# Example: ALLOWED_ORIGINS=http://localhost:8080,https://yourdomain.com
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080

# Application Settings
PORT=8000
NODE_ENV=development
```

**For MongoDB Atlas:**
- Get your connection string from: MongoDB Atlas → Connect → Connect your application
- Use the connection string format: `mongodb+srv://username:password@cluster.mongodb.net/database`
- Set it as `DATABASE_URL` in your `.env` file

**For Local MongoDB:**
- Use format: `mongodb://localhost:27017/voice_ai_agent`
- Or use individual config variables (DB_HOST, DB_PORT, etc.)

4. **Create upload directories:**

```bash
mkdir -p uploads/voices
```

## Running the Application

### Development Mode

```bash
npm run start:dev
```

The application will start on `http://localhost:8000` by default.

### Production Mode

```bash
npm run build
npm run start:prod
```

## API Endpoints

All endpoints are prefixed with `/api`.

### Dashboard

- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/agents` - Get all voice agents
- `GET /api/dashboard/analytics` - Get analytics data
- `GET /api/dashboard/live-call` - Get current live call
- `GET /api/dashboard/live-calls` - Get all live calls

### Voice Agents

- `GET /api/agents` - Get all agents
- `GET /api/agents/:id` - Get agent by ID
- `GET /api/agents/:id/calls` - Get calls for an agent
- `POST /api/agents` - Create a new agent
- `PUT /api/agents/:id` - Update an agent
- `PATCH /api/agents/:id/status` - Update agent status
- `DELETE /api/agents/:id` - Delete an agent

### Calls

- `GET /api/calls` - Get all calls (with optional filters)
- `GET /api/calls/:id` - Get call by ID
- `POST /api/calls` - Create a new call
- `PUT /api/calls/:id` - Update a call
- `DELETE /api/calls/:id` - Delete a call
- `POST /api/calls/:id/transfer` - Transfer a call
- `POST /api/calls/:id/hold` - Hold/resume a call
- `POST /api/calls/:id/whisper` - Send whisper to agent
- `POST /api/calls/:id/intervene` - Intervene in a call
- `PATCH /api/calls/:id/sentiment` - Update call sentiment
- `POST /api/calls/:id/end` - End a call
- `POST /api/calls/:id/mute` - Toggle call mute
- `GET /api/calls/:id/recording` - Get call recording
- `GET /api/calls/export/:format` - Export calls (csv/json)

### Contacts

- `GET /api/contacts` - Get all contacts (with optional search/status filters)
- `GET /api/contacts/:id` - Get contact by ID
- `GET /api/contacts/:id/calls` - Get calls for a contact
- `POST /api/contacts` - Create a new contact
- `PUT /api/contacts/:id` - Update a contact
- `DELETE /api/contacts/:id` - Delete a contact

### Settings

- `PUT /api/settings/profile` - Update user profile
- `PUT /api/settings/voice` - Update voice settings
- `PUT /api/settings/notifications` - Update notification settings
- `POST /api/settings/password` - Change password
- `POST /api/settings/2fa/enable` - Enable 2FA
- `POST /api/settings/2fa/disable` - Disable 2FA
- `POST /api/settings/2fa/verify` - Verify 2FA code
- `GET /api/settings/sessions` - Get active sessions
- `DELETE /api/settings/sessions/:id` - Revoke session
- `GET /api/settings/billing` - Get billing info
- `PUT /api/settings/billing/payment-method` - Update payment method
- `GET /api/settings/billing/invoices` - Get invoices
- `POST /api/settings/api-keys` - Create API key
- `GET /api/settings/api-keys` - Get all API keys
- `DELETE /api/settings/api-keys/:id` - Delete API key
- `POST /api/settings/webhooks` - Create webhook
- `GET /api/settings/webhooks` - Get all webhooks
- `PUT /api/settings/webhooks/:id` - Update webhook
- `DELETE /api/settings/webhooks/:id` - Delete webhook

### Upload

- `POST /api/upload/voice` - Upload voice file
- `POST /api/upload/voice/record` - Record voice

### Search

- `GET /api/search?q=query` - Global search across agents, calls, and contacts

## Database Schema

MongoDB collections are automatically created when documents are inserted. The schemas use Mongoose for validation and type safety.

### VoiceAgent Collection

- `_id` (ObjectId) - Primary key (automatically generated)
- `name` (string) - Agent name
- `description` (string) - Agent description
- `status` (enum: active, inactive, busy)
- `calls` (number) - Total calls
- `avgDuration` (string) - Average call duration
- `voice` (Object) - Voice configuration
- `greetingScript` (string) - Greeting script
- `faqs` (Array) - FAQ array
- `intents` (Array) - Intent configuration
- `callRules` (Object) - Call rules and business hours
- `leadCapture` (Object) - Lead capture configuration
- `notifications` (Object) - Notification settings
- `baseLogic` (Object) - Base receptionist logic
- `createdAt` (Date) - Auto-generated timestamp
- `updatedAt` (Date) - Auto-generated timestamp

### Contact Collection

- `_id` (ObjectId) - Primary key (automatically generated)
- `name` (string) - Contact name
- `email` (string) - Email address
- `phone` (string) - Phone number
- `company` (string) - Company name
- `totalCalls` (number) - Total calls
- `lastContact` (Date) - Last contact date
- `status` (enum: active, inactive, lead)
- `createdAt` (Date) - Auto-generated timestamp
- `updatedAt` (Date) - Auto-generated timestamp

### Call Collection

- `_id` (ObjectId) - Primary key (automatically generated)
- `contact` (string) - Contact name
- `phone` (string) - Phone number
- `agent` (string) - Agent name
- `agentId` (ObjectId) - Reference to VoiceAgent (optional)
- `type` (enum: inbound, outbound, missed)
- `duration` (string) - Call duration
- `date` (Date) - Call date
- `time` (string) - Call time
- `status` (enum: completed, missed, voicemail)
- `recording` (boolean) - Has recording
- `outcome` (enum: success, caller_hung_up, speech_not_recognized, other)
- `latency` (Object) - Latency metrics
- `transcript` (Array) - Call transcript
- `contactId` (ObjectId) - Reference to Contact (optional)
- `createdAt` (Date) - Auto-generated timestamp
- `updatedAt` (Date) - Auto-generated timestamp

## Project Structure

```
Backend/
├── src/
│   ├── schemas/           # Mongoose schemas
│   │   ├── voice-agent.schema.ts
│   │   ├── contact.schema.ts
│   │   └── call.schema.ts
│   ├── dto/               # Data Transfer Objects
│   │   ├── agent.dto.ts
│   │   ├── call.dto.ts
│   │   ├── contact.dto.ts
│   │   ├── settings.dto.ts
│   │   └── common.dto.ts
│   ├── modules/           # Feature modules
│   │   ├── dashboard/
│   │   ├── agents/
│   │   ├── calls/
│   │   ├── contacts/
│   │   ├── settings/
│   │   ├── upload/
│   │   └── search/
│   ├── app.module.ts      # Root module
│   └── main.ts            # Application entry point
├── uploads/               # Uploaded files
│   └── voices/
├── .env                   # Environment variables (create this)
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Code Style

The project uses ESLint and Prettier for code formatting. Run:

```bash
npm run lint
npm run format
```

### Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Database Management

MongoDB is schema-less, so Mongoose schemas define the structure and validation. Collections are automatically created when documents are inserted.

**Note:** MongoDB doesn't require migrations like SQL databases. Schema changes are handled through Mongoose schema updates and application code.

## CORS Configuration

CORS is configured to allow requests from:
- `http://localhost:3000`
- `http://localhost:5173`
- `http://localhost:8080`
- `http://127.0.0.1:3000`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:8080`

To add more origins, update `src/main.ts`.

## Frontend Integration

The frontend should be configured to use the API base URL:

```typescript
// In frontend .env
VITE_API_URL=http://localhost:8000/api
```

## Troubleshooting

### Database Connection Issues

1. **Check your DATABASE_URL format:**
   ```
   # MongoDB Atlas
   mongodb+srv://username:password@cluster.mongodb.net/database
   
   # Local MongoDB
   mongodb://localhost:27017/database
   ```

2. **For MongoDB Atlas:**
   - Ensure your IP address is whitelisted in Network Access
   - Verify the connection string from MongoDB Atlas dashboard
   - Check that your database user has proper permissions

3. **For Local MongoDB:**
   - Ensure MongoDB service is running: `mongod` or `brew services start mongodb-community`
   - Verify connection: `mongosh` or `mongo` (depending on version)

4. **Test connection:**
   ```bash
   # Using mongosh
   mongosh "mongodb://localhost:27017/voice_ai_agent"
   ```

### Port Already in Use

If port 8000 is already in use, change it in `.env`:
```env
PORT=8001
```

### File Upload Issues

- Ensure the `uploads/voices` directory exists and has write permissions
- Check file size limits (default: 10MB)
- Verify file type is audio

## License

MIT

