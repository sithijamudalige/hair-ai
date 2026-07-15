# Aura AI Face & Hair Analysis - Setup Guide

Welcome to the project! Follow these exact steps to clone the repository and get the application running on your machine with 0 errors.

## Prerequisites
Before you start, make sure you have the following installed on your machine:
- **Git**
- **Python 3.10+** (Make sure to add Python to your PATH during installation)
- **Node.js 18+** (Includes npm)

---

## Step 1: Clone the Repository
Open your terminal and clone the repository to your local machine:
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git
cd YOUR_REPOSITORY_NAME
```
*(Note: Replace the URL above with the actual GitHub repository URL)*

---

## Step 2: Set up the Python Backend

We need to create an isolated Python environment and install the AI/Machine Learning dependencies.

1. **Navigate to the backend folder**:
   ```bash
   cd backend
   ```

2. **Create a Virtual Environment**:
   ```bash
   python -m venv .venv
   ```

3. **Activate the Virtual Environment**:
   - **On Windows:**
     ```powershell
     .\.venv\Scripts\activate
     ```
   - **On Mac/Linux:**
     ```bash
     source .venv/bin/activate
     ```
   *(You should now see `(.venv)` at the beginning of your terminal line)*

4. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Set up the API Key (CRITICAL)**:
   The backend uses Groq AI for the smart assistant. You must configure the API key.
   - Create a file named `.env` inside the `backend` folder.
   - Add the following line to the file (replace with your actual Groq API key which starts with `gsk_`):
     ```env
     GROQ_API_KEY=gsk_your_api_key_here
     ```

6. **Go back to the main folder**:
   ```bash
   cd ..
   ```

---

## Step 3: Set up the Next.js Frontend

1. **Navigate to the frontend folder**:
   ```bash
   cd frontend
   ```

2. **Install Node dependencies**:
   ```bash
   npm install
   ```

3. **Go back to the main folder**:
   ```bash
   cd ..
   ```

---

## Step 4: Run the Application!

We have a convenient PowerShell script that starts both the backend and frontend simultaneously.

1. Make sure you are in the main project folder.
2. Run the start script:
   ```powershell
   .\start_app.ps1
   ```

The script will launch two processes:
- The **FastAPI Backend** on `http://localhost:8000`
- The **Next.js Frontend** on `http://localhost:3000`

Once you see the success message, open **http://localhost:3000** in your browser and you're good to go!

> If you are on Mac/Linux and cannot run the `.ps1` script, simply open two terminals:
> **Terminal 1 (Backend):** `cd backend` -> `source .venv/bin/activate` -> `python api.py`
> **Terminal 2 (Frontend):** `cd frontend` -> `npm run dev`
