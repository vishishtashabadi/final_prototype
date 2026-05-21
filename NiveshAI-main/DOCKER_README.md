# NiveshAI — Run with Docker (No Setup Needed!)

## Step 1: Install Docker Desktop

If you don't have Docker yet, download it from:
https://www.docker.com/products/docker-desktop/

Install and **open Docker Desktop** once (it runs in the background).

## Step 2: Start NiveshAI

**Double-click** the `start.cmd` file in this folder.

That's it! The script will:
1. Check Docker is installed
2. Start Docker Desktop if it's not running
3. Build the app and start it
4. Open your browser at http://localhost:8080

### Or run manually in terminal:

```bash
docker compose up -d --build
```

Then open http://localhost:8080

## Step 3: Stop the App

```bash
docker compose down
```

## What is NiveshAI?

A beginner-friendly stock portfolio tool built for the **Fidelity Hackathon 2026**. 
It helps first-time investors:
- Know how much to invest (50/30/20 rule)
- See BUY/SELL signals explained in plain language
- Build and track a virtual portfolio
- Learn from market replay (Time Machine)

## Demo Credentials

Just **register** with any email and password — the app works fully offline with mock data.
