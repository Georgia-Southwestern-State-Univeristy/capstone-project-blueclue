# BlueClue - AI Powered IT Ticketing System


## System Overview
BlueClue is a next-generation IT ticketing system designed to deliver an outstanding user experience by leveraging advanced AI technology for automated ticket classification, real-time analytics, and intelligent support features.


## Contributors
- **Thomas Newcomb** - Project Manager / AI Engineer: Project coordination, AI development, documentation
- **Jacob Williams** - Frontend Developer: React UI, user experience, responsive design
- **Clayton McGough** - Backend Developer: Node.js API, database, deployment


## Quick Start Guide

### Option 1: Automated Setup with PowerShell (Recommended for Windows)

Navigate to the setup directory and run the automated script:
```bash
cd blueclue/docs/setup
.\start-dev.ps1
```

This script will:
- Install all dependencies for frontend and backend
- Prompt you to start development servers (Y/N)
- Launch both servers in separate terminal windows if you choose Yes

### Option 2: Using npm Scripts

**First time setup:**
```bash
npm install
npm run setup
```

**Start dev servers (after initial setup):**
```bash
npm run dev
```

### Option 3: Manual Setup

**Frontend:**
```bash
cd blueclue/frontend
npm install
npm run dev
```

**Backend:**
```bash
cd blueclue/backend
npm install
npm run dev
```

## Available npm Scripts

From the root directory:
- `npm run install:all` - Install dependencies for both frontend and backend
- `npm run dev` - Run both dev servers concurrently
- `npm run setup` - Install all dependencies and start dev servers
- `npm run frontend` - Run only the frontend dev server
- `npm run backend` - Run only the backend dev server

## Project Description
BlueClue is a next-generation IT ticketing system designed to deliver an outstanding user experience by leveraging advanced AI technology for automated ticket classification, real-time analytics, and intelligent support features.
