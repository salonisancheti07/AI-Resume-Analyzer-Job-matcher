# AI Resume Analyzer & Job Matcher

A full-stack AI-powered platform that helps users analyze resumes, improve ATS compatibility, discover skill gaps, and find suitable job opportunities.

This project was built as a final-year academic project to demonstrate the integration of modern web development, AI/ML-based resume analysis, and cloud deployment.

## 🌟 Project Overview

The platform provides users with:
- Resume analysis and ATS score evaluation
- AI-based feedback and rewrite suggestions
- Skill gap identification
- Job matching and career recommendations
- AI chat support for resume and career guidance
- Recruiter and dashboard features

## ✨ Key Features

- Upload and analyze resumes
- Detect missing keywords and ATS issues
- Generate personalized improvement suggestions
- Match resumes with relevant job roles
- Provide AI-driven career assistance
- Build a modern responsive user interface

## 🛠️ Tech Stack

### Frontend
- React
- Vite
- Tailwind CSS
- React Router

### Backend
- FastAPI
- Python
- Pydantic
- Sentence Transformers
- FAISS

### Additional Services
- MongoDB
- OpenAI API
- Vercel for frontend deployment
- Render for backend deployment

## 📁 Project Structure

```bash
backend/      # FastAPI backend for AI resume analysis
client/       # React frontend application
server/       # Express server for auth and dashboard features
```

## 🚀 Getting Started

### Prerequisites
- Node.js and npm
- Python 3.10+
- MongoDB
- OpenAI API key

### 1. Clone the repository

```bash
git clone https://github.com/salonisancheti07/AI-Resume-Analyzer-Job-matcher.git
cd AI-Resume-Analyzer-Job-matcher
```

### 2. Frontend setup

```bash
cd client
npm install
npm run dev
```

### 3. Backend setup

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 4. Optional server setup

```bash
cd server
npm install
npm run dev
```

## 🌐 Deployment

This project is configured for deployment using:
- Vercel for the frontend
- Render for the backend API
- MongoDB Atlas for the database

## 🔐 Environment Variables

Set up the required environment variables for:
- OpenAI API key
- MongoDB connection string
- Frontend API base URL
- Allowed origins

## 📌 Why This Project Matters

This project showcases:
- Full-stack development
- AI integration
- Cloud deployment
- Resume optimization workflows
- Real-world problem solving

## 👩‍💻 Author

Saloni Sancheti

## 📄 License

This project is intended for academic, portfolio, and demonstration purposes.
