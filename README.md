# Sahayak-AI

Sahayak is a full-stack, real-time platform designed to connect people in need with NGOs, volunteers, and donors efficiently. It bridges the gap between available resources and urgent needs using live updates, smart matching, and location-based insights.

## Live Demo

[https://sahayak-ai-mocha.vercel.app/](https://sahayak-ai-mocha.vercel.app/)

## Features

- Real-time updates using Socket.IO
- Live heatmaps for demand visualization
- Smart matching between requests and NGOs
- Analytics dashboard (`/api/analytics`)
- SMS-based request flow with OTP simulation
- Live stats and request tracking
- Demo data seeding script

## Problem Statement

Many people still struggle to access basic needs like food, shelter, and medical assistance, even when resources exist.

The core issue is lack of coordination and connectivity:

- NGOs and volunteers do not know who needs help or where
- People in need lack a simple way to request support
- Delays lead to inefficient resource usage

## Solution

Sahayak creates a real-time bridge between need and help.

- Users can easily raise requests
- NGOs and volunteers can instantly view and respond
- Location and urgency-based matching ensures efficiency

Result:

- Faster response
- Better coordination
- Reduced resource waste
- Greater impact

## Project Structure

```text
Sahayak-AI/
|-- client/
|   |-- src/
|   |   |-- components/
|   |   |-- hooks/
|   |   |-- pages/
|   |   `-- services/
|   `-- .env.example
|-- server/
|   |-- index.js
|   |-- package.json
|   `-- .env.example
|-- scripts/
|   `-- seed.js
`-- .env.example
```

## Setup Instructions

### 1. Install frontend dependencies

```bash
cd client
npm install
```

### 2. Install backend dependencies

```bash
cd ../server
npm install
```

### 3. Setup environment variables

```bash
cd ../client
cp .env.example .env

cd ../server
cp .env.example .env
```

## Run the Project

Run frontend and backend together:

```bash
npm run live
```

Or run separately.

Frontend:

```bash
cd client
npm run dev
```

Backend:

```bash
cd server
npm run dev
```

Backend only (production mode):

```bash
cd server
npm start
```

## API Endpoints

### Requests and Matching

- `POST /api/triage`
- `POST /api/requests`
- `GET /api/requests`
- `POST /api/match`
- `PATCH /api/requests/:id/status`

### NGOs

- `GET /api/ngos`
- `PATCH /api/ngos/:id/resources`

### SMS Simulation

- `POST /api/sms/simulate`
- `POST /api/sms/verify`

### Analytics and Insights

- `GET /api/heatmap`
- `GET /api/analytics`
- `GET /api/stats`

### Health Check

- `GET /health`

## Demo Data

To populate the app with sample data:

```bash
node scripts/seed.js
```

## Vision

Sahayak transforms scattered efforts into a connected, efficient support system that ensures:

- The right help
- Reaches the right person
- At the right time

Crafted with 🔥 by the team ASUR
