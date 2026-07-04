const RESUME_TEMPLATES = [
  { id: "standard", name: "ATS Standard", layout: "single-column", font: "Arial", style: "minimal" },
  { id: "modern", name: "Modern Professional", layout: "balanced", font: "Inter", style: "sidebar" },
  { id: "executive", name: "Executive Classic", layout: "serif", font: "Merriweather", style: "bold" },
];

const RESUME_EXAMPLES = [
  { id: "ex1", role: "AI Engineer", content: "Expert in Python, LLMs, and RAG architectures..." },
  { id: "ex2", role: "Product Manager", content: "Led 3 cross-functional teams to deliver SaaS products..." },
];

function runAtsScoringEngine(text, sectionsPresent, resumeSkills, jobSkills) {
  const matchedSkillCount = getMatchingSkills(jobSkills, resumeSkills).length;
  const rules = [
    { id: "r1", label: "Contact Info", status: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text), weight: 5 },
    { id: "r2", label: "Summary Section", status: !!sectionsPresent.summary, weight: 10 },
    { id: "r3", label: "Work Experience", status: !!sectionsPresent.experience, weight: 15 },
    { id: "r4", label: "Skills Cluster", status: !!sectionsPresent.skills, weight: 10 },
    { id: "r5", label: "Education Records", status: !!sectionsPresent.education, weight: 5 },
    { id: "r6", label: "No Tables/Images", status: !/[|]{2,}/.test(text) && !/img|image/i.test(text), weight: 10 },
    { id: "r7", label: "Keyword Density", status: (matchedSkillCount / Math.max(jobSkills.length, 1)) > 0.35, weight: 20 },
    { id: "r8", label: "Action Verbs", status: /(Led|Built|Managed|Optimized|Designed)/i.test(text), weight: 10 },
    { id: "r9", label: "Measurable Impact", status: /\d+%|\d+k|\$\d+/i.test(text), weight: 10 },
    { id: "r10", label: "Bullet Formats", status: /^[-*•]/m.test(text), weight: 5 },
  ];
  
  const score = rules.reduce((acc, r) => acc + (r.status ? r.weight : 0), 0);
  return { score: Math.round(score), checklist: rules };
}

function buildLocalSkillGapInsights({
  role = "target role",
  industry = "your industry",
  matchedSkills = [],
  topPriorities = [],
  benchmarkCoverage = 0,
  jdCoverage = 0,
} = {}) {
  const safeMatched = Array.isArray(matchedSkills) ? matchedSkills : [];
  const safePriorities = Array.isArray(topPriorities) ? topPriorities : [];
  const focusSkills = safePriorities
    .map((item) => (typeof item === "string" ? item : item?.skill))
    .filter(Boolean)
    .slice(0, 3);

  return {
    summary:
      focusSkills.length > 0
        ? `Your profile is closest to ${role}. Focus next on ${focusSkills.join(", ")} to improve shortlist chances.`
        : `Your profile already covers the core ${role} benchmark fairly well.`,
    recruiter_view:
      safeMatched.length > 0
        ? `Recruiters will notice strength in ${safeMatched.slice(0, 4).join(", ")}.`
        : "Recruiters may need clearer proof of role-specific depth in the resume.",
    action_plan: [
      `Benchmark coverage is ${benchmarkCoverage}%. Close the top missing skills first.`,
      `JD coverage is ${jdCoverage}%. Mirror the job description language more closely in skills and projects.`,
      focusSkills.length > 0
        ? `Priority order: ${focusSkills.join(" -> ")}.`
        : "Add more measurable outcomes and role-specific keywords.",
    ],
    industry_note: `${industry} hiring teams usually look for execution proof, tooling familiarity, and measurable impact.`,
  };
}

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import pdfParse from "pdf-parse";
import compression from "compression";
import cookieParser from "cookie-parser";
import passport from "passport";
import session from "express-session";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { OpenAI } from "openai";
import { User } from "./models/User.js";
import { RecruiterWorkspace } from "./models/RecruiterWorkspace.js";
import { ContactSubmission } from "./models/ContactSubmission.js";
import { configurePassport } from "./auth/passport.js";
import { createRequireAuth } from "./middleware/auth.js";
import { createAuthRouter } from "./routes/auth.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_BUILD_PATH = path.resolve(__dirname, "../client/dist");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai-resume-analyzer";
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-3-small";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-jwt-secret";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-session-secret";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, sameSite: "lax" },
  })
);
app.use(passport.initialize());
app.use(passport.session());

configurePassport();
const requireAuth = createRequireAuth(JWT_SECRET);
const authRouter = createAuthRouter({ jwtSecret: JWT_SECRET, frontendUrl: FRONTEND_URL, requireAuth });
app.use("/api/auth", authRouter);
app.use("/auth", authRouter);

if (process.env.NODE_ENV === "production") {
  if (fs.existsSync(CLIENT_BUILD_PATH)) {
    app.use(express.static(CLIENT_BUILD_PATH, { maxAge: "30d" }));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/auth")) {
        return res.status(404).send("Not found");
      }
      res.sendFile(path.join(CLIENT_BUILD_PATH, "index.html"));
    });
  } else {
    console.warn("Client build not found at:", CLIENT_BUILD_PATH);
  }
}

async function findDashboardUser(req) {
  if (req.authUser?._id) return req.authUser;

  const email = String(req.headers["x-user-email"] || "").trim().toLowerCase();
  if (email) {
    const userByEmail = await User.findOne({ email });
    if (userByEmail) return userByEmail;
  }

  const userId = String(req.headers["x-user-id"] || "").trim();
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    const userById = await User.findById(userId);
    if (userById) return userById;
  }

  return null;
}

async function appendDashboardNotification(req, notification = {}) {
  try {
    const user = await findDashboardUser(req);
    if (!user) return;

    const currentState = user.dashboardState || {};
    const currentNotifications = Array.isArray(currentState.customNotifications)
      ? currentState.customNotifications
      : [];

    user.dashboardState = {
      applicationBoard: currentState.applicationBoard || {},
      learningProgress: currentState.learningProgress || {},
      hiddenNotifications: Array.isArray(currentState.hiddenNotifications)
        ? currentState.hiddenNotifications
        : [],
      customNotifications: [
        {
          id: notification.id || `auto-${Date.now()}`,
          type: notification.type || "general",
          priority: notification.priority || "medium",
          title: notification.title || "New activity update",
          message: notification.message || "A new platform event needs your attention.",
          cta: notification.cta || "Open Dashboard",
          createdAt: notification.createdAt || new Date().toISOString(),
        },
        ...currentNotifications,
      ].slice(0, 20),
    };

    await user.save();
  } catch (error) {
    console.error("Dashboard notification append failed", error.message);
  }
}

// --- Mongo setup ---
const jobSchema = new mongoose.Schema(
  {
    title: String,
    company: String,
    location: String,
    salary: String,
    role: String,
    description: String,
    source: String,
    applyUrl: String,
    postedAt: Date,
    tags: [String],
    embedding: { type: [Number], default: [] },
  },
  { timestamps: true }
);

const Job = mongoose.model("Job", jobSchema);

const feedbackSchema = new mongoose.Schema(
  {
    jobId: String,
    action: String, // save, apply, skip, view
    score: Number,
    user: String,
    filters: Object,
    title: String,
    company: String,
    location: String,
    salary: String,
    source: String,
  },
  { timestamps: true }
);

const Feedback = mongoose.model("Feedback", feedbackSchema);

const interviewActivitySchema = new mongoose.Schema(
  {
    type: String, // question_bank, evaluation, mock_turn
    role: String,
    company: String,
    detail: String,
    score: Number,
    answersCount: Number,
    user: String,
  },
  { timestamps: true }
);

const InterviewActivity = mongoose.model("InterviewActivity", interviewActivitySchema);

const CANON = [
  "python",
  "javascript",
  "typescript",
  "java",
  "aws",
  "gcp",
  "azure",
  "docker",
  "kubernetes",
  "react",
  "node",
  "express",
  "mongodb",
  "sql",
  "nosql",
  "nlp",
  "ml",
  "pytorch",
  "tensorflow",
  "fastapi",
];

const SAMPLE_JOBS = [
  {
    title: "Backend Engineer (Node/Express)",
    skills: ["node", "express", "mongodb", "docker"],
    company: "Acme",
    location: "Remote",
    salary: "120k+",
    role: "SDE",
    applyUrl: "https://www.indeed.com/jobs?q=backend+engineer+node+express",
  },
  {
    title: "Full-Stack Engineer (React)",
    skills: ["javascript", "react", "node", "sql"],
    company: "Northwind",
    location: "Hybrid",
    salary: "110k+",
    role: "SDE",
    applyUrl: "https://www.indeed.com/jobs?q=full+stack+react+node",
  },
  {
    title: "Data Engineer (AWS)",
    skills: ["python", "aws", "sql", "docker"],
    company: "DataWorks",
    location: "Remote",
    salary: "130k+",
    role: "Data Engineer",
    applyUrl: "https://www.indeed.com/jobs?q=data+engineer+aws",
  },
  {
    title: "ML Engineer",
    skills: ["python", "ml", "pytorch", "aws"],
    company: "VisionAI",
    location: "Onsite",
    salary: "140k+",
    role: "ML Engineer",
    applyUrl: "https://www.indeed.com/jobs?q=machine+learning+engineer",
  },
  {
    title: "DevOps Engineer",
    skills: ["kubernetes", "docker", "gcp", "ci/cd"],
    company: "CloudOps",
    location: "Remote",
    salary: "125k+",
    role: "DevOps",
    applyUrl: "https://www.indeed.com/jobs?q=devops+engineer",
  },
];

const EXTRA_JOBS = [
  {
    title: "Full Stack Developer (React/Node)",
    company: "BuildSpace",
    location: "Hybrid",
    salary: "125k",
    role: "SDE",
    applyUrl: "https://www.indeed.com/jobs?q=full+stack+developer+react+node",
    description:
      "Ship end-to-end features across React frontends and Node/Express backends. Experience with REST/GraphQL, CI/CD, and cloud (AWS/GCP).",
    tags: ["react", "node", "express", "graphql", "aws", "ci/cd"],
  },
  {
    title: "Frontend Engineer (React + TypeScript)",
    company: "UI Labs",
    location: "Remote",
    salary: "115k",
    role: "Frontend",
    applyUrl: "https://www.indeed.com/jobs?q=frontend+engineer+react+typescript",
    description:
      "Build performant React/TypeScript interfaces, design systems, accessibility, and testing with Jest/RTL. Bonus: Next.js.",
    tags: ["react", "typescript", "accessibility", "jest", "rtl", "nextjs"],
  },
  {
    title: "Software Engineer (Internship)",
    company: "Starter",
    location: "Remote",
    salary: "40k",
    role: "Intern",
    applyUrl: "https://internshala.com/internships/software-development-internship",
    description:
      "Assist in building microservices, writing tests, and improving documentation. Familiarity with Git, APIs, and JavaScript/TypeScript.",
    tags: ["javascript", "typescript", "apis", "testing", "git"],
  },
];

const INDEED_SEED = [
  {
    title: "Software Engineer - Backend (Node.js)",
    company: "Indeed",
    location: "Remote",
    salary: "140k",
    role: "SDE",
    source: "Indeed",
    applyUrl: "https://www.indeed.com/jobs?q=software+engineer+backend+nodejs",
    description:
      "Design scalable APIs in Node.js, optimize Postgres queries, build observability, and deploy on AWS. Experience with Docker and CI/CD required.",
    tags: ["node", "aws", "postgres", "docker", "ci/cd"],
  },
  {
    title: "Machine Learning Engineer",
    company: "Indeed",
    location: "Hybrid",
    salary: "150k",
    role: "ML Engineer",
    source: "Indeed",
    applyUrl: "https://www.indeed.com/jobs?q=machine+learning+engineer",
    description:
      "Own ML pipelines, model deployment, feature stores, monitoring. Python, PyTorch, Airflow, and AWS Sagemaker experience preferred.",
    tags: ["python", "pytorch", "airflow", "aws", "mlops"],
  },
  {
    title: "Data Analyst",
    company: "Indeed",
    location: "Remote",
    salary: "110k",
    role: "Data Analyst",
    source: "Indeed",
    applyUrl: "https://www.indeed.com/jobs?q=data+analyst",
    description:
      "Build dashboards, run A/B tests, and deliver insights. SQL, Tableau/Looker, Python/R, and experimentation skills needed.",
    tags: ["sql", "tableau", "ab testing", "python", "looker"],
  },
  {
    title: "DevOps Engineer",
    company: "Indeed",
    location: "Remote",
    salary: "135k",
    role: "DevOps",
    source: "Indeed",
    applyUrl: "https://www.indeed.com/jobs?q=devops+engineer",
    description:
      "Kubernetes, Terraform, CI/CD, observability, and cost optimization. Experience with GCP or AWS.",
    tags: ["kubernetes", "terraform", "ci/cd", "observability", "gcp"],
  },
];

const INTERNSHALA_SEED = [
  {
    title: "Data Science Intern",
    company: "Internshala Partner Startup",
    location: "Remote",
    salary: "25k stipend",
    role: "Data Analyst",
    source: "Internshala",
    applyUrl: "https://internshala.com/internships/data-science-internship",
    description:
      "Support analytics dashboards, Python notebooks, SQL reporting, and simple ML experimentation. Great fit for early-career applicants.",
    tags: ["python", "sql", "ml", "excel", "dashboards"],
  },
  {
    title: "Full Stack Developer Intern",
    company: "Internshala Partner Startup",
    location: "Hybrid",
    salary: "30k stipend",
    role: "SDE",
    source: "Internshala",
    applyUrl: "https://internshala.com/internships/full-stack-development-internship",
    description:
      "Build React pages and Node APIs, fix bugs, and collaborate on product features. Strong JavaScript fundamentals preferred.",
    tags: ["react", "node", "javascript", "apis", "mongodb"],
  },
];

const UNSTOP_SEED = [
  {
    title: "Software Engineer Challenge Track",
    company: "Unstop Hiring Challenge",
    location: "Remote",
    salary: "8 LPA",
    role: "SDE",
    source: "Unstop",
    applyUrl: "https://unstop.com/jobs",
    description:
      "Coding challenge based hiring for backend and full stack roles. DSA, JavaScript or Java, APIs, and debugging expected.",
    tags: ["javascript", "java", "apis", "sql", "dsa"],
  },
  {
    title: "Machine Learning Hackathon Finalist Role",
    company: "Unstop Talent Program",
    location: "Hybrid",
    salary: "10 LPA",
    role: "ML Engineer",
    source: "Unstop",
    applyUrl: "https://unstop.com/jobs",
    description:
      "ML-focused opportunity for candidates with Python, model training, experimentation, and presentation skills.",
    tags: ["python", "ml", "pytorch", "tensorflow", "experimentation"],
  },
];

const ALL_SEED_JOBS = [...SAMPLE_JOBS, ...INDEED_SEED, ...INTERNSHALA_SEED, ...UNSTOP_SEED, ...EXTRA_JOBS];

async function embedText(text) {
  const res = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: text.slice(0, 6000),
  });
  return res.data[0].embedding;
}

function cosine(a, b) {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (na * nb + 1e-9);
}

async function extractTextFromPdf(buffer) {
  const data = await pdfParse(buffer);
  return (data.text || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function extractTextFromBuffer(buffer = Buffer.from(""), encoding = "utf8") {
  return String(buffer.toString(encoding) || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function tokenizeForRetrieval(text = "") {
  return String(text || "")
    .toLowerCase()
    .match(/[a-z0-9+#.-]{3,}/g) || [];
}

function retrieveRelevantContext({ question = "", resumeText = "", extraContextText = "", limit = 4 }) {
  const corpus = [resumeText, extraContextText]
    .filter(Boolean)
    .join("\n\n")
    .split(/\n{2,}|---/g)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 30);

  if (!corpus.length) return [];

  const queryTokens = tokenizeForRetrieval(question);
  const scored = corpus.map((chunk) => {
    const lowerChunk = chunk.toLowerCase();
    const score = queryTokens.reduce((sum, token) => sum + (lowerChunk.includes(token) ? 1 : 0), 0);
    return { chunk, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || b.chunk.length - a.chunk.length)
    .slice(0, limit)
    .map((item) => item.chunk.slice(0, 1200));
}

async function summarizeContextFiles(files = []) {
  if (!Array.isArray(files) || !files.length) {
    return {
      contextText: "",
      files: [],
      supportedCount: 0,
      unsupportedCount: 0,
      videoCount: 0,
    };
  }

  const textExtensions = new Set([
    ".txt", ".md", ".json", ".csv", ".js", ".jsx", ".ts", ".tsx", ".py", ".java",
    ".html", ".css", ".scss", ".yml", ".yaml", ".xml", ".log", ".sql",
  ]);
  const contextChunks = [];
  const summaries = [];
  let supportedCount = 0;
  let unsupportedCount = 0;
  let videoCount = 0;

  for (const file of files.slice(0, 30)) {
    const originalName = file.originalname || "uploaded-file";
    const lowerName = originalName.toLowerCase();
    const extension = lowerName.includes(".") ? lowerName.slice(lowerName.lastIndexOf(".")) : "";
    const mime = (file.mimetype || "").toLowerCase();
    let extractedText = "";
    let kind = "unsupported";
    let note = "This file type is not yet parsed for AI context.";

    try {
      if (mime === "application/pdf" || extension === ".pdf") {
        extractedText = await extractTextFromPdf(file.buffer);
        kind = "pdf";
        note = extractedText
          ? "PDF text extracted successfully."
          : "PDF uploaded, but very little text could be extracted.";
      } else if (textExtensions.has(extension) || mime.startsWith("text/") || mime.includes("json")) {
        extractedText = extractTextFromBuffer(file.buffer);
        kind = "text";
        note = extractedText
          ? "Text file ingested for AI context."
          : "Text file uploaded, but it appears empty.";
      } else if (mime.startsWith("video/") || [".mp4", ".mov", ".avi", ".mkv", ".webm"].includes(extension)) {
        kind = "video";
        videoCount += 1;
        note = "Video file detected. I can track its name and metadata, but I still need a transcript, captions, or notes to reason about its content.";
      }
    } catch (_error) {
      extractedText = "";
      kind = "unsupported";
      note = "The file was uploaded, but parsing failed.";
    }

    if (extractedText) {
      supportedCount += 1;
      const clipped = extractedText.slice(0, 4000);
      contextChunks.push(`File: ${originalName}\n${clipped}`);
    } else if (kind === "video") {
      unsupportedCount += 1;
      contextChunks.push(
        `File: ${originalName}\nVideo metadata only. Add a transcript, summary, captions, or issue notes if you want AI answers based on this video.`
      );
    } else {
      unsupportedCount += 1;
    }

    summaries.push({
      name: originalName,
      type: kind,
      size: file.size || 0,
      note,
    });
  }

  return {
    contextText: contextChunks.join("\n\n---\n\n").slice(0, 16000),
    files: summaries,
    supportedCount,
    unsupportedCount,
    videoCount,
  };
}

function keywordSkills(text) {
  const lower = ` ${(text || "").toLowerCase()} `;
  const canonMatches = CANON.filter((skill) => {
    const regex = new RegExp(`\\b${escapeRegex(skill.toLowerCase())}\\b`, "i");
    return regex.test(lower);
  });
  return normalizeSkillList([...canonMatches, ...detectSkills(text)]);
}

const SKILL_LIBRARY = [
  {
    name: "python",
    aliases: ["python"],
    category: "Programming",
    weeks: 4,
    benchmarkLevel: 4,
    certifications: ["PCAP Python Certification"],
    courses: [
      { title: "Python for Everybody", provider: "Coursera", url: "https://www.coursera.org/specializations/python" },
      { title: "Python Full Course", provider: "YouTube", url: "https://www.youtube.com/results?search_query=python+full+course" },
    ],
  },
  {
    name: "javascript",
    aliases: ["javascript", "js"],
    category: "Programming",
    weeks: 4,
    benchmarkLevel: 4,
    certifications: ["Meta Front-End Developer Certificate"],
    courses: [
      { title: "JavaScript Algorithms and Data Structures", provider: "Coursera", url: "https://www.coursera.org/search?query=javascript" },
      { title: "JavaScript Crash Course", provider: "YouTube", url: "https://www.youtube.com/results?search_query=javascript+crash+course" },
    ],
  },
  {
    name: "typescript",
    aliases: ["typescript", "ts"],
    category: "Programming",
    weeks: 3,
    benchmarkLevel: 4,
    certifications: ["Meta Front-End Developer Certificate"],
    courses: [
      { title: "TypeScript for Beginners", provider: "Coursera", url: "https://www.coursera.org/search?query=typescript" },
      { title: "TypeScript Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=typescript+tutorial" },
    ],
  },
  {
    name: "java",
    aliases: ["java"],
    category: "Programming",
    weeks: 5,
    benchmarkLevel: 4,
    certifications: ["Oracle Java Foundations"],
    courses: [
      { title: "Java Programming", provider: "Coursera", url: "https://www.coursera.org/search?query=java%20programming" },
      { title: "Java Full Course", provider: "YouTube", url: "https://www.youtube.com/results?search_query=java+full+course" },
    ],
  },
  {
    name: "sql",
    aliases: ["sql", "postgres", "mysql", "postgresql"],
    category: "Data",
    weeks: 3,
    benchmarkLevel: 4,
    certifications: ["Google Data Analytics Certificate"],
    courses: [
      { title: "SQL for Data Science", provider: "Coursera", url: "https://www.coursera.org/search?query=sql" },
      { title: "SQL Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=sql+tutorial" },
    ],
  },
  {
    name: "mongodb",
    aliases: ["mongodb", "mongo"],
    category: "Data",
    weeks: 2,
    benchmarkLevel: 3,
    certifications: ["MongoDB Associate Developer"],
    courses: [
      { title: "MongoDB Basics", provider: "Coursera", url: "https://www.coursera.org/search?query=mongodb" },
      { title: "MongoDB Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=mongodb+tutorial" },
    ],
  },
  {
    name: "react",
    aliases: ["react", "react.js"],
    category: "Frontend",
    weeks: 4,
    benchmarkLevel: 4,
    certifications: ["Meta Front-End Developer Certificate"],
    courses: [
      { title: "React Basics", provider: "Coursera", url: "https://www.coursera.org/search?query=react" },
      { title: "React Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=react+tutorial" },
    ],
  },
  {
    name: "node",
    aliases: ["node", "node.js", "nodejs"],
    category: "Backend",
    weeks: 4,
    benchmarkLevel: 4,
    certifications: ["Node.js Services Developer"],
    courses: [
      { title: "Server-side Development with NodeJS", provider: "Coursera", url: "https://www.coursera.org/search?query=nodejs" },
      { title: "Node.js Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=nodejs+tutorial" },
    ],
  },
  {
    name: "express",
    aliases: ["express", "express.js"],
    category: "Backend",
    weeks: 2,
    benchmarkLevel: 3,
    certifications: ["Node.js Services Developer"],
    courses: [
      { title: "ExpressJS Guided Project", provider: "Coursera", url: "https://www.coursera.org/search?query=expressjs" },
      { title: "Express.js Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=expressjs+tutorial" },
    ],
  },
  {
    name: "fastapi",
    aliases: ["fastapi"],
    category: "Backend",
    weeks: 2,
    benchmarkLevel: 3,
    certifications: ["Backend API Portfolio Project"],
    courses: [
      { title: "FastAPI Courses", provider: "Coursera", url: "https://www.coursera.org/search?query=fastapi" },
      { title: "FastAPI Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=fastapi+tutorial" },
    ],
  },
  {
    name: "aws",
    aliases: ["aws", "amazon web services", "s3", "ec2", "lambda"],
    category: "Cloud",
    weeks: 6,
    benchmarkLevel: 4,
    certifications: ["AWS Certified Cloud Practitioner", "AWS Certified Developer Associate"],
    courses: [
      { title: "AWS Fundamentals", provider: "Coursera", url: "https://www.coursera.org/search?query=aws" },
      { title: "AWS for Beginners", provider: "YouTube", url: "https://www.youtube.com/results?search_query=aws+for+beginners" },
    ],
  },
  {
    name: "docker",
    aliases: ["docker", "containerization", "containers"],
    category: "DevOps",
    weeks: 3,
    benchmarkLevel: 4,
    certifications: ["Docker Certified Associate"],
    courses: [
      { title: "Docker Essentials", provider: "Coursera", url: "https://www.coursera.org/search?query=docker" },
      { title: "Docker Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=docker+tutorial" },
    ],
  },
  {
    name: "kubernetes",
    aliases: ["kubernetes", "k8s"],
    category: "DevOps",
    weeks: 6,
    benchmarkLevel: 4,
    certifications: ["CKA: Certified Kubernetes Administrator"],
    courses: [
      { title: "Kubernetes for Developers", provider: "Coursera", url: "https://www.coursera.org/search?query=kubernetes" },
      { title: "Kubernetes Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=kubernetes+tutorial" },
    ],
  },
  {
    name: "ci/cd",
    aliases: ["ci/cd", "cicd", "continuous integration", "continuous delivery"],
    category: "DevOps",
    weeks: 3,
    benchmarkLevel: 4,
    certifications: ["GitHub Actions Certification Prep"],
    courses: [
      { title: "CI/CD Concepts", provider: "Coursera", url: "https://www.coursera.org/search?query=ci%2Fcd" },
      { title: "CI/CD Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=ci+cd+tutorial" },
    ],
  },
  {
    name: "terraform",
    aliases: ["terraform"],
    category: "DevOps",
    weeks: 4,
    benchmarkLevel: 4,
    certifications: ["HashiCorp Terraform Associate"],
    courses: [
      { title: "Terraform Basics", provider: "Coursera", url: "https://www.coursera.org/search?query=terraform" },
      { title: "Terraform Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=terraform+tutorial" },
    ],
  },
  {
    name: "ml",
    aliases: ["machine learning", "ml"],
    category: "AI/ML",
    weeks: 8,
    benchmarkLevel: 4,
    certifications: ["Machine Learning Specialization"],
    courses: [
      { title: "Machine Learning Specialization", provider: "Coursera", url: "https://www.coursera.org/specializations/machine-learning-introduction" },
      { title: "Machine Learning Full Course", provider: "YouTube", url: "https://www.youtube.com/results?search_query=machine+learning+full+course" },
    ],
  },
  {
    name: "nlp",
    aliases: ["nlp", "natural language processing"],
    category: "AI/ML",
    weeks: 6,
    benchmarkLevel: 3,
    certifications: ["NLP Specialization"],
    courses: [
      { title: "Natural Language Processing", provider: "Coursera", url: "https://www.coursera.org/search?query=natural%20language%20processing" },
      { title: "NLP Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=nlp+tutorial" },
    ],
  },
  {
    name: "pytorch",
    aliases: ["pytorch", "torch"],
    category: "AI/ML",
    weeks: 4,
    benchmarkLevel: 4,
    certifications: ["Deep Learning Specialization"],
    courses: [
      { title: "Deep Learning with PyTorch", provider: "Coursera", url: "https://www.coursera.org/search?query=pytorch" },
      { title: "PyTorch Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=pytorch+tutorial" },
    ],
  },
  {
    name: "tensorflow",
    aliases: ["tensorflow"],
    category: "AI/ML",
    weeks: 4,
    benchmarkLevel: 4,
    certifications: ["TensorFlow Developer Certificate"],
    courses: [
      { title: "TensorFlow in Practice", provider: "Coursera", url: "https://www.coursera.org/search?query=tensorflow" },
      { title: "TensorFlow Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=tensorflow+tutorial" },
    ],
  },
  {
    name: "data structures",
    aliases: ["data structures", "algorithms", "dsa"],
    category: "Foundations",
    weeks: 5,
    benchmarkLevel: 4,
    certifications: ["Coding Interview Foundations"],
    courses: [
      { title: "Data Structures and Algorithms", provider: "Coursera", url: "https://www.coursera.org/search?query=data%20structures%20and%20algorithms" },
      { title: "DSA Course", provider: "YouTube", url: "https://www.youtube.com/results?search_query=data+structures+algorithms+course" },
    ],
  },
  {
    name: "system design",
    aliases: ["system design", "scalability", "distributed systems"],
    category: "Architecture",
    weeks: 6,
    benchmarkLevel: 4,
    certifications: ["System Design Portfolio Preparation"],
    courses: [
      { title: "Cloud Architecture and System Design", provider: "Coursera", url: "https://www.coursera.org/search?query=system%20design" },
      { title: "System Design Interview", provider: "YouTube", url: "https://www.youtube.com/results?search_query=system+design+interview" },
    ],
  },
  {
    name: "rest apis",
    aliases: ["rest api", "restful api", "apis", "api development"],
    category: "Backend",
    weeks: 2,
    benchmarkLevel: 4,
    certifications: ["API Design Fundamentals"],
    courses: [
      { title: "API Design", provider: "Coursera", url: "https://www.coursera.org/search?query=api%20design" },
      { title: "REST API Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=rest+api+tutorial" },
    ],
  },
  {
    name: "testing",
    aliases: ["testing", "unit test", "jest", "pytest", "automation testing"],
    category: "Quality",
    weeks: 3,
    benchmarkLevel: 4,
    certifications: ["Software Testing Fundamentals"],
    courses: [
      { title: "Software Testing and Automation", provider: "Coursera", url: "https://www.coursera.org/search?query=software%20testing" },
      { title: "Testing Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=software+testing+tutorial" },
    ],
  },
  {
    name: "git",
    aliases: ["git", "github"],
    category: "Collaboration",
    weeks: 1,
    benchmarkLevel: 4,
    certifications: ["GitHub Foundations"],
    courses: [
      { title: "Version Control with Git", provider: "Coursera", url: "https://www.coursera.org/search?query=git" },
      { title: "Git and GitHub Tutorial", provider: "YouTube", url: "https://www.youtube.com/results?search_query=git+github+tutorial" },
    ],
  },
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectSkills(text) {
  const lower = ` ${(text || "").toLowerCase()} `;
  const found = [];
  for (const skill of SKILL_LIBRARY) {
    const matched = skill.aliases.some((alias) => {
      if (/[^a-z0-9 ]/i.test(alias)) {
        return lower.includes(alias.toLowerCase());
      }
      const regex = new RegExp(`\\b${escapeRegex(alias.toLowerCase())}\\b`, "i");
      return regex.test(lower);
    });
    if (matched) found.push(skill.name);
  }
  return found;
}

const SKILL_ALIAS_LOOKUP = new Map();

function buildSkillLookupVariants(value = "") {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const alphanumeric = normalized.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  return Array.from(new Set([normalized, alphanumeric, compact].filter(Boolean)));
}

for (const skill of SKILL_LIBRARY) {
  for (const alias of [skill.name, ...(skill.aliases || [])]) {
    for (const variant of buildSkillLookupVariants(alias)) {
      SKILL_ALIAS_LOOKUP.set(variant, skill.name);
    }
  }
}

for (const skill of CANON) {
  for (const variant of buildSkillLookupVariants(skill)) {
    if (!SKILL_ALIAS_LOOKUP.has(variant)) {
      SKILL_ALIAS_LOOKUP.set(variant, skill);
    }
  }
}

function canonicalizeSkill(skill = "") {
  for (const variant of buildSkillLookupVariants(skill)) {
    if (SKILL_ALIAS_LOOKUP.has(variant)) {
      return SKILL_ALIAS_LOOKUP.get(variant);
    }
  }
  return String(skill || "").toLowerCase().trim();
}

function normalizeSkillList(skills = []) {
  return Array.from(
    new Set(
      (Array.isArray(skills) ? skills : [])
        .map((skill) => canonicalizeSkill(skill))
        .filter(Boolean)
    )
  );
}

function getMatchingSkills(requiredSkills = [], availableSkills = []) {
  const available = new Set(normalizeSkillList(availableSkills));
  return normalizeSkillList(requiredSkills).filter((skill) => available.has(skill));
}

function getMissingSkills(requiredSkills = [], availableSkills = []) {
  const available = new Set(normalizeSkillList(availableSkills));
  return normalizeSkillList(requiredSkills).filter((skill) => !available.has(skill));
}

function getExtraSkills(baseSkills = [], comparisonSkills = []) {
  const comparison = new Set(normalizeSkillList(comparisonSkills));
  return normalizeSkillList(baseSkills).filter((skill) => !comparison.has(skill));
}

function inferSkillGapRoleFromText(text) {
  const lower = (text || "").toLowerCase();
  if (/(machine learning|ml engineer|ai engineer|deep learning|llm)/i.test(lower)) return "AI Engineer";
  if (/(data engineer|etl|data pipeline|warehouse|spark|airflow)/i.test(lower)) return "Data Engineer";
  if (/(frontend|react|ui engineer)/i.test(lower)) return "Frontend Engineer";
  if (/(backend|node|api|microservice)/i.test(lower)) return "Backend Engineer";
  if (/(devops|sre|platform engineer|terraform|kubernetes)/i.test(lower)) return "DevOps Engineer";
  if (/(full stack|fullstack)/i.test(lower)) return "Full Stack Engineer";
  return "Software Engineer";
}

function benchmarkSkillsForRole(role) {
  const lower = (role || "").toLowerCase();
  if (lower.includes("ai") || lower.includes("ml")) {
    return ["python", "ml", "pytorch", "tensorflow", "sql", "aws", "docker", "rest apis"];
  }
  if (lower.includes("data")) {
    return ["python", "sql", "aws", "docker", "terraform", "git", "testing"];
  }
  if (lower.includes("frontend")) {
    return ["javascript", "typescript", "react", "testing", "git", "rest apis"];
  }
  if (lower.includes("backend")) {
    return ["node", "express", "sql", "mongodb", "aws", "docker", "rest apis", "testing"];
  }
  if (lower.includes("devops")) {
    return ["aws", "docker", "kubernetes", "ci/cd", "terraform", "git", "testing"];
  }
  if (lower.includes("full stack")) {
    return ["javascript", "typescript", "react", "node", "express", "sql", "docker", "git"];
  }
  return ["javascript", "python", "sql", "git", "testing", "rest apis"];
}

function levelFromResumeText(text, skill) {
  const lower = (text || "").toLowerCase();
  const aliases = SKILL_LIBRARY.find((item) => item.name === skill)?.aliases || [skill];
  const hits = aliases.reduce((count, alias) => count + (lower.match(new RegExp(escapeRegex(alias.toLowerCase()), "g")) || []).length, 0);
  if (hits >= 5) return 4;
  if (hits >= 3) return 3;
  if (hits >= 1) return 2;
  return 1;
}

function buildSkillGapPayload(resumeText, jobDescription) {
  const resumeSkills = normalizeSkillList(detectSkills(resumeText));
  const jobSkills = normalizeSkillList([...detectSkills(jobDescription), ...benchmarkSkillsForRole(inferSkillGapRoleFromText(jobDescription))]);
  const matchedSkills = getMatchingSkills(jobSkills, resumeSkills);
  const missingSkills = getMissingSkills(jobSkills, resumeSkills);
  const targetRole = inferSkillGapRoleFromText(jobDescription);

  const prioritySkills = missingSkills
    .map((skill, index) => {
      const meta = SKILL_LIBRARY.find((item) => item.name === skill) || {
        name: skill,
        category: "Core",
        weeks: 4,
        benchmarkLevel: 4,
        certifications: [],
        courses: [],
      };
      const requiredWeight = Math.max(jobSkills.length - index, 1);
      const priorityScore = Number((requiredWeight * 12 + meta.benchmarkLevel * 8 + Math.max(meta.weeks, 1)).toFixed(1));
      const currentLevel = levelFromResumeText(resumeText, skill) - 1;
      return {
        skill,
        category: meta.category,
        priority: index + 1,
        priority_score: priorityScore,
        importance: Number((Math.max(0.45, 1 - index * 0.08)).toFixed(2)),
        time_to_learn_weeks: meta.weeks,
        current_level: Math.max(currentLevel, 0),
        benchmark_level: meta.benchmarkLevel,
        rationale: `${skill} appears in the target job profile but is not visible in the resume evidence yet.`,
      };
    })
    .sort((a, b) => b.priority_score - a.priority_score)
    .map((item, index) => ({ ...item, priority: index + 1 }));

  const skillProgress = jobSkills.map((skill) => {
    const meta = SKILL_LIBRARY.find((item) => item.name === skill) || { category: "Core", benchmarkLevel: 4, weeks: 4 };
    return {
      skill,
      category: meta.category,
      current_level: matchedSkills.includes(skill) ? levelFromResumeText(resumeText, skill) : 0,
      target_level: meta.benchmarkLevel,
      status: matchedSkills.includes(skill) ? "On track" : "Gap",
      estimated_weeks_to_close: matchedSkills.includes(skill) ? Math.max(1, Math.ceil(meta.weeks / 2)) : meta.weeks,
    };
  });

  const topCourses = prioritySkills.slice(0, 6).flatMap((item) => {
    const meta = SKILL_LIBRARY.find((skill) => skill.name === item.skill);
    return (meta?.courses || []).map((course) => ({
      skill: item.skill,
      title: course.title,
      provider: course.provider,
      url: course.url,
      duration: `${meta.weeks} weeks`,
    }));
  });

  const certifications = Array.from(
    new Map(
      prioritySkills.slice(0, 5).flatMap((item) => {
        const meta = SKILL_LIBRARY.find((skill) => skill.name === item.skill);
        return (meta?.certifications || []).map((cert) => [
          `${item.skill}-${cert}`,
          {
            skill: item.skill,
            title: cert,
            reason: `Strong signal for ${item.skill} in ${targetRole} hiring loops.`,
          },
        ]);
      })
    ).values()
  );

  const benchmarkComparison = jobSkills.map((skill) => {
    const meta = SKILL_LIBRARY.find((item) => item.name === skill) || { benchmarkLevel: 4, category: "Core" };
    const currentLevel = matchedSkills.includes(skill) ? levelFromResumeText(resumeText, skill) : 0;
    return {
      skill,
      category: meta.category,
      your_level: currentLevel,
      benchmark_level: meta.benchmarkLevel,
      delta: meta.benchmarkLevel - currentLevel,
    };
  });

  const averageCoverage = jobSkills.length ? Math.round((matchedSkills.length / jobSkills.length) * 100) : 0;
  const averageWeeks = prioritySkills.length
    ? Math.round(prioritySkills.reduce((sum, skill) => sum + skill.time_to_learn_weeks, 0) / prioritySkills.length)
    : 0;

  return {
    target_role: targetRole,
    summary: {
      coverage_score: averageCoverage,
      missing_skills_count: missingSkills.length,
      strongest_area: matchedSkills[0] || "No mapped strengths yet",
      next_best_focus: prioritySkills[0]?.skill || "Add a job description to identify the next gap",
      estimated_weeks_to_close_top_gaps: averageWeeks,
    },
    resume_skills: resumeSkills,
    job_skills: jobSkills,
    matched_skills: matchedSkills,
    missing_skills: missingSkills,
    priority_skills: prioritySkills,
    courses: topCourses,
    certifications,
    benchmark_comparison: benchmarkComparison,
    skill_progress: skillProgress,
    learning_plan: prioritySkills.slice(0, 4).map((item, index) => ({
      phase: `Phase ${index + 1}`,
      focus: item.skill,
      timeline: `${item.time_to_learn_weeks} weeks`,
      action: `Build one visible project bullet and one interview story around ${item.skill}.`,
    })),
  };
}

function buildHeuristicSkillGapInsights(payload = {}) {
  const strongest = payload.summary?.strongest_area || "your current strengths";
  const nextFocus = payload.summary?.next_best_focus || "the top missing skill";
  const missing = payload.missing_skills || [];
  const matched = payload.matched_skills || [];
  return {
    headline: `You already show evidence of ${strongest}, but the biggest hiring gap is ${nextFocus}.`,
    summary:
      payload.summary?.coverage_score >= 70
        ? "Your resume is directionally aligned with the target role, but a few missing skills are still limiting fit."
        : "Your resume shows partial alignment, but the target job still expects stronger evidence across several core skills.",
    strengths: matched.slice(0, 3).map((skill) => `Your resume already signals ${skill}, which gives you a base to build on.`),
    risks: missing.slice(0, 3).map((skill) => `${skill} is expected by the job but not clearly visible in your resume evidence yet.`),
    next_steps: (payload.priority_skills || []).slice(0, 3).map((item) => `In the next ${item.time_to_learn_weeks} weeks, add ${item.skill} through one project, one resume bullet, and one interview story.`),
  };
}

async function buildAiSkillGapInsights({ payload, resumeText, jobDescription }) {
  if (!openai) {
    return buildHeuristicSkillGapInsights(payload);
  }

  try {
    const response = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert resume strategist and career coach. Analyze the skill gap between a resume and a job description. Return JSON only with this shape: {\"headline\": string, \"summary\": string, \"strengths\": string[], \"risks\": string[], \"next_steps\": string[]}. Make it specific, practical, and grounded in the provided skills. Do not repeat generic advice.",
        },
        {
          role: "user",
          content: JSON.stringify({
            target_role: payload.target_role,
            summary: payload.summary,
            matched_skills: payload.matched_skills,
            missing_skills: payload.missing_skills,
            priority_skills: payload.priority_skills?.slice(0, 5),
            benchmark_comparison: payload.benchmark_comparison?.slice(0, 5),
            resume_excerpt: String(resumeText || "").slice(0, 1800),
            job_description_excerpt: String(jobDescription || "").slice(0, 1800),
          }),
        },
      ],
    });

    return parseAiJson(response.choices?.[0]?.message?.content || "");
  } catch (error) {
    const isQuotaError =
      error?.status === 429 ||
      error?.code === "insufficient_quota" ||
      error?.type === "insufficient_quota";

    if (isQuotaError) {
      console.warn(
        "skill gap ai insight falling back to local insights because OpenAI quota is unavailable."
      );
      return buildLocalSkillGapInsights(arguments?.[0] || {});
    }

    console.error("skill gap ai insight failed", error);
    return buildHeuristicSkillGapInsights(payload);
  }
}

function extractSectionBlock(text, patterns) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const start = lines.findIndex((line) => patterns.some((pattern) => pattern.test(line)));
  if (start === -1) return [];
  const block = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^(education|experience|work history|professional experience|projects?|project experience|academic projects|skills|technical skills|certifications|licenses|summary|professional summary|profile)$/i.test(line)) break;
    block.push(line.replace(/^[•\-]\s*/, ""));
    if (block.length >= 8) break;
  }
  return block;
}

function parseResumeDetails(text) {
  const rawLines = (text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const cleanText = rawLines.join(" ").replace(/\s+/g, " ").trim();
  const education = extractSectionBlock(text, [/^education$/i, /^academic/i]);
  const experience = extractSectionBlock(text, [/^experience$/i, /^work history$/i, /^professional experience$/i]);
  const projects = extractSectionBlock(text, [/^projects?$/i, /^project experience$/i, /^academic projects$/i, /^key projects$/i]);
  const certifications = extractSectionBlock(text, [/^certifications?$/i, /^licenses?$/i]);
  const firstReadableLine =
    rawLines.find((line) => !/@/.test(line) && !/\+?\d[\d\-\s]{7,}\d/.test(line) && line.length > 4 && line.length < 50) || "";

  return {
    name: firstReadableLine || cleanText.split(/\s+/).slice(0, 2).join(" "),
    email: (cleanText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0],
    phone: (cleanText.match(/(\+?\d[\d\-\s]{7,}\d)/) || [""])[0],
    education,
    experience,
    projects,
    certifications,
  };
}

function detectChatFocus(prompt = "", mode = "") {
  const lower = String(prompt || "").toLowerCase();
  if (lower.includes("project")) return "projects";
  if (lower.includes("ats") || lower.includes("score") || lower.includes("keyword")) return "ats";
  if (lower.includes("summary")) return "summary";
  if (lower.includes("skill")) return "skills";
  if (lower.includes("experience") || lower.includes("work")) return "experience";
  if (lower.includes("job description") || lower.includes("jd")) return "job-match";
  if (mode === "ai-mode") return "general";
  return "general";
}

function buildFocusedChatContext({ focus = "general", resumeContext = null, jobContext = null, resumeText = "", extraContextText = "" }) {
  const sections = [];
  if (focus === "projects") {
    sections.push(`Project highlights: ${(resumeContext?.projectHighlights || []).join(" | ") || "No clear projects extracted."}`);
    sections.push(`Experience highlights: ${(resumeContext?.experienceHighlights || []).join(" | ") || "No clear experience extracted."}`);
  } else if (focus === "experience") {
    sections.push(`Experience highlights: ${(resumeContext?.experienceHighlights || []).join(" | ") || "No clear experience extracted."}`);
    sections.push(`Project highlights: ${(resumeContext?.projectHighlights || []).join(" | ") || "No clear projects extracted."}`);
  } else if (focus === "ats") {
    sections.push(`Top skills: ${(resumeContext?.topSkills || []).join(", ") || "None extracted"}`);
    sections.push(`Metric count: ${resumeContext?.metricCount || 0}`);
    sections.push(`Missing JD skills: ${(jobContext?.missingSkills || []).join(", ") || "No JD gaps available"}`);
  } else {
    sections.push(`Top skills: ${(resumeContext?.topSkills || []).join(", ") || "None extracted"}`);
    sections.push(`Experience highlights: ${(resumeContext?.experienceHighlights || []).join(" | ") || "None extracted"}`);
    sections.push(`Project highlights: ${(resumeContext?.projectHighlights || []).join(" | ") || "None extracted"}`);
  }

  if (extraContextText.trim()) {
    sections.push(`Extra uploaded context: ${extraContextText.slice(0, 3000)}`);
  } else if (resumeText.trim()) {
    sections.push(`Resume excerpt: ${resumeText.slice(0, 3000)}`);
  }

  return sections.join("\n");
}

function buildAutoSummary({
  skills = [],
  missing = [],
  score = 0,
  metricCount = 0,
  sectionsPresent = {},
  jobSkills = [],
  keywordCoverage = 0,
  inferredRole = "",
}) {
  const topSkills = skills.slice(0, 4);
  const topMissing = missing.slice(0, 3);
  const presentSections = Object.entries(sectionsPresent)
    .filter(([, present]) => present)
    .map(([name]) => name);
  const missingSections = Object.entries(sectionsPresent)
    .filter(([, present]) => !present)
    .map(([name]) => name);
  const coveragePct = Math.round((keywordCoverage || 0) * 100);

  const lines = [];
  if (score >= 85) {
    lines.push(`Strong profile for ${inferredRole || "the target role"} with clear evidence in ${topSkills.join(", ") || "the core stack"}.`);
  } else if (score >= 70) {
    lines.push(`Moderate fit for ${inferredRole || "the target role"}: relevant signal exists in ${topSkills.join(", ") || "several core skills"}, but the resume still needs sharper proof.`);
  } else {
    lines.push(`The resume is not yet convincing for ${inferredRole || "this target role"} because the strongest evidence is still too thin or too generic.`);
  }

  if (jobSkills.length) {
    lines.push(
      coveragePct >= 70
        ? `Keyword alignment is solid at ${coveragePct}% against the job requirements.`
        : `Keyword alignment is only ${coveragePct}%, with the biggest gaps in ${topMissing.join(", ") || "role-specific keywords"}.`
    );
  }

  if (metricCount >= 3) {
    lines.push(`Impact proof is helping because the resume already shows ${metricCount} measurable results.`);
  } else {
    lines.push("Impact proof is weak right now, so add more metrics, scale, or outcome language to the most relevant bullets.");
  }

  if (missingSections.length) {
    lines.push(`The structure is incomplete: add or strengthen ${missingSections.slice(0, 2).join(", ")}.`);
  } else if (presentSections.length) {
    lines.push(`The core structure is present across ${presentSections.slice(0, 4).join(", ")}.`);
  }

  return lines.join(" ");
}

function buildHeuristicCoverLetter({
  resumeText = "",
  jobDescription = "",
  companyName = "",
}) {
  const details = parseResumeDetails(resumeText);
  const resumeContext = buildResumeChatContext(resumeText) || {};
  const inferredRole = inferRoleFromText(`${resumeText}\n${jobDescription}`);
  const matchedSkills = getMatchingSkills(
    normalizeSkillList(keywordSkills(jobDescription)),
    normalizeSkillList(keywordSkills(resumeText))
  );
  const missingSkills = getMissingSkills(
    normalizeSkillList(keywordSkills(jobDescription)),
    normalizeSkillList(keywordSkills(resumeText))
  );
  const topSkills = (resumeContext.topSkills || []).slice(0, 4);
  const experienceProof = (resumeContext.experienceHighlights || []).slice(0, 2);
  const projectProof = (resumeContext.projectHighlights || []).slice(0, 2);
  const metricCount = resumeContext.metricCount || 0;
  const candidateName = details.name || "Candidate";
  const targetCompany = companyName || "your team";
  const opening = companyName
    ? `Dear Hiring Team at ${companyName},`
    : "Dear Hiring Manager,";

  const fitLine = matchedSkills.length
    ? `My background aligns well with this ${inferredRole} opportunity, especially across ${matchedSkills.slice(0, 3).join(", ")}.`
    : `My background is best suited to ${inferredRole} work, and I see a strong opportunity to contribute in this role.`;

  const proofLine = experienceProof.length
    ? `In recent work, I have contributed on ${experienceProof.join(" and ")}, which reflects the kind of ownership and execution this role calls for.`
    : projectProof.length
      ? `My project work includes ${projectProof.join(" and ")}, giving me hands-on experience with the tools and problem spaces relevant to this role.`
      : `I have been building experience through practical work that emphasizes implementation, problem-solving, and role-relevant technical depth.`;

  const metricLine = metricCount >= 2
    ? `I also make a point of tying my work to outcomes, and my resume already reflects measurable impact across multiple bullets.`
    : `One of my strengths is turning technical work into practical results, and I would bring that same outcome-focused approach to this role.`;

  const stackLine = topSkills.length
    ? `The strongest parts of my current profile include ${topSkills.join(", ")}, and I would be excited to apply that foundation at ${targetCompany}.`
    : `I am especially interested in contributing at ${targetCompany} and growing deeper in the skills this position prioritizes.`;

  const closeLine = missingSkills.length
    ? `I am also actively sharpening adjacent areas such as ${missingSkills.slice(0, 2).join(", ")}, which would help me ramp even faster in this position.`
    : `Because my background already overlaps well with the role requirements, I believe I can contribute quickly while continuing to grow with the team.`;

  return [
    opening,
    "",
    `I am writing to apply for this ${inferredRole} opportunity. ${fitLine}`,
    "",
    `${proofLine} ${metricLine}`,
    "",
    `${stackLine} ${closeLine}`,
    "",
    `Thank you for your time and consideration. I would welcome the chance to discuss how my background can support ${targetCompany}.`,
    "",
    `Sincerely,`,
    candidateName,
  ].join("\n");
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function countOccurrences(text, term) {
  if (!term) return 0;
  const regex = new RegExp(`\\b${escapeRegex(term.toLowerCase())}\\b`, "gi");
  return (String(text || "").toLowerCase().match(regex) || []).length;
}

function analyzeResumeSections(text = "") {
  const tests = {
    summary: [/^summary$/i, /^professional summary$/i, /^profile$/i],
    experience: [/^experience$/i, /^work history$/i, /^professional experience$/i],
    education: [/^education$/i, /^academic/i],
    skills: [/^skills$/i, /^technical skills$/i],
    projects: [/^projects?$/i, /^project experience$/i],
    certifications: [/^certifications?$/i, /^licenses?$/i],
  };

  return Object.fromEntries(
    Object.entries(tests).map(([key, patterns]) => [
      key,
      patterns.some((pattern) => pattern.test(text)),
    ])
  );
}

function buildKeywordDensity(text = "", skills = []) {
  return skills
    .map((skill) => ({ keyword: skill, freq: countOccurrences(text, skill) }))
    .sort((a, b) => b.freq - a.freq);
}

function buildImprovementSuggestions({ sectionsPresent, missingSkills, metricCount, bulletLines, jobSkills }) {
  const suggestions = [];
  if (missingSkills.length) {
    suggestions.push({
      priority: "High",
      action: `Add evidence-backed keywords like ${missingSkills.slice(0, 3).join(", ")}`,
      impact: "+12 ATS points",
    });
  }
  if (!sectionsPresent.summary) {
    suggestions.push({
      priority: "High",
      action: "Add a short professional summary aligned to the target role",
      impact: "+8 ATS points",
    });
  }
  if (!sectionsPresent.projects) {
    suggestions.push({
      priority: "Medium",
      action: "Add a projects section with tools, outcomes, and business impact",
      impact: "+7 ATS points",
    });
  }
  if (metricCount < 3) {
    suggestions.push({
      priority: "High",
      action: "Add more measurable results using %, counts, revenue, latency, or time saved",
      impact: "+10 ATS points",
    });
  }
  if (bulletLines < 4) {
    suggestions.push({
      priority: "Medium",
      action: "Use concise bullet points instead of dense paragraphs in experience",
      impact: "+6 ATS points",
    });
  }
  if (jobSkills.length && !missingSkills.length) {
    suggestions.push({
      priority: "Medium",
      action: "Reorder your strongest matching skills and projects closer to the top",
      impact: "+4 ATS points",
    });
  }
  return suggestions.slice(0, 5);
}

function buildBulletSuggestions(text = "", missingSkills = []) {
  const bulletLines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*•]/.test(line))
    .slice(0, 5);

  if (!bulletLines.length) {
    return [
      {
        original: "Built and improved features for the product.",
        improved: `Built and shipped recruiter-facing product improvements, improving usability and aligning the resume more closely with ${missingSkills[0] || "target-role"} expectations.`,
      },
    ];
  }

  return bulletLines.map((line, index) => {
    const cleaned = line.replace(/^[-*•]\s*/, "");
    const skillHint = missingSkills[index] || missingSkills[0] || "target job keywords";
    return {
      original: cleaned,
      improved: `${cleaned} Add a clear action, one metric, and where relevant mention ${skillHint} to strengthen ATS relevance.`,
    };
  });
}

function buildFormattingInsights(text = "", sectionsPresent = {}) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim());
  const bulletLines = lines.filter((line) => /^[-*•]/.test(line)).length;
  const longLines = lines.filter((line) => line.length > 150).length;
  const issues = [];
  if (bulletLines >= 4) issues.push("✓ Good use of bullet points for scannability");
  else issues.push("⚠ Add more bullet points in experience and projects");
  if (longLines <= 2) issues.push("✓ Most lines are short enough for recruiter scanning");
  else issues.push("⚠ Shorten long lines and dense paragraphs");
  if (sectionsPresent.experience && sectionsPresent.skills && sectionsPresent.education) issues.push("✓ Core ATS sections are present");
  else issues.push("⚠ Add all core ATS sections: Experience, Skills, Education");
  if (/\|/.test(text) || /\t/.test(text)) issues.push("⚠ Simplify complex separators to plain text");
  else issues.push("✓ Plain-text formatting looks ATS-friendly");

  const score = clamp(78 + (bulletLines >= 4 ? 8 : -8) + (longLines <= 2 ? 6 : -6) + (sectionsPresent.experience ? 4 : -6));
  return { score, issues };
}

function buildAtsCompatibility(text = "", sectionsPresent = {}) {
  const lower = String(text || "").toLowerCase();
  const hasCoreSections = sectionsPresent.experience && sectionsPresent.skills && sectionsPresent.education;
  const details = [
    hasCoreSections ? "✓ Core ATS sections are present" : "⚠ Add Experience, Skills, and Education headings",
    !/[|]{2,}/.test(lower) ? "✓ No obvious complex table formatting detected" : "⚠ Reduce table-like separators or columns",
    !/(img|image|icon)/.test(lower) ? "✓ Text-first resume content detected" : "⚠ Remove image-dependent content from resume body",
    /^.{0,12000}$/s.test(text) ? "✓ Resume length is within a parser-friendly range" : "⚠ Resume looks unusually long for a one-pass ATS parser",
  ];
  const score = clamp(76 + (hasCoreSections ? 10 : -10) + (!/[|]{2,}/.test(lower) ? 6 : -6));
  return { score, details };
}

function buildReadabilityInsights(text = "") {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const words = String(text || "").match(/\b[\w+#./-]+\b/g) || [];
  const bulletLines = lines.filter((line) => /^[-*•]/.test(line)).length;
  const avgWordsPerLine = lines.length ? words.length / lines.length : words.length;
  const score = clamp(82 - Math.max(0, avgWordsPerLine - 14) * 3 + Math.min(8, bulletLines * 1.5));
  return {
    score: Math.round(score),
    complexity: avgWordsPerLine > 18 ? "High" : avgWordsPerLine > 12 ? "Medium" : "Low",
    bulletClarity: bulletLines >= 4 ? "Strong" : bulletLines >= 2 ? "Moderate" : "Needs work",
  };
}

function buildAtsChecks({ sectionsPresent = {}, keywordCoverage = 0, metricCount = 0, bulletLines = 0, text = "", missingSkills = [] }) {
  const hasContact = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text) && /(\+?\d[\d\-\s]{7,}\d)/.test(text);
  const checks = [
    {
      label: "Contact information",
      status: hasContact,
      impact: 10,
      description: hasContact ? "Email and phone were detected successfully." : "Add clear email and phone details at the top of the resume.",
    },
    {
      label: "Professional summary",
      status: !!sectionsPresent.summary,
      impact: 8,
      description: sectionsPresent.summary ? "A summary/profile section is present." : "Add a short summary aligned to the job target.",
    },
    {
      label: "Experience section",
      status: !!sectionsPresent.experience,
      impact: 20,
      description: sectionsPresent.experience ? "Experience section detected." : "Add a dedicated experience section with role-wise bullets.",
    },
    {
      label: "Skills section",
      status: !!sectionsPresent.skills,
      impact: 15,
      description: sectionsPresent.skills ? "Skills section detected." : "Add a technical skills section with grouped keywords.",
    },
    {
      label: "Projects section",
      status: !!sectionsPresent.projects,
      impact: 10,
      description: sectionsPresent.projects ? "Projects are present." : "Add project entries to strengthen proof of work.",
    },
    {
      label: "Keyword alignment",
      status: keywordCoverage >= 0.65,
      impact: 15,
      description: keywordCoverage >= 0.65 ? "Strong overlap with target-role keywords." : `Keyword match is low; consider adding ${missingSkills.slice(0, 3).join(", ") || "more role terms"}.`,
    },
    {
      label: "Metrics and outcomes",
      status: metricCount >= 3,
      impact: 12,
      description: metricCount >= 3 ? "Resume includes measurable results." : "Add more metrics like %, revenue, users, latency, or time saved.",
    },
    {
      label: "Bullet readability",
      status: bulletLines >= 4,
      impact: 10,
      description: bulletLines >= 4 ? "Bullet-based content is recruiter friendly." : "Use more bullet points in experience and projects.",
    },
  ];

  return checks;
}

function buildKeywordTargeting({ resumeSkills = [], jobSkills = [], keywordDensity = [], missingSkills = [] }) {
  const matched = getMatchingSkills(jobSkills, resumeSkills);
  const lowFrequency = keywordDensity
    .filter((item) => matched.includes(item.keyword) && item.freq <= 1)
    .map((item) => item.keyword)
    .slice(0, 5);
  const prioritizedMissing = missingSkills.slice(0, 5).map((skill, index) => ({
    keyword: skill,
    priority: index < 2 ? "High" : index < 4 ? "Medium" : "Low",
    placement: index < 2 ? "Summary + top 2 experience bullets" : index < 4 ? "Skills + projects section" : "Projects or certifications",
  }));
  return {
    matched,
    lowFrequency,
    prioritizedMissing,
  };
}

function buildSummarySuggestions({ inferredRole = "target role", topSkills = [], missingSkills = [] }) {
  const role = inferredRole || "target role";
  const strengths = topSkills.slice(0, 3).join(", ") || "relevant technical skills";
  const improvement = missingSkills[0] || "measurable business impact";
  return [
    `Target ${role} roles with a summary that leads with ${strengths}.`,
    `Mention one measurable strength and one clear business outcome in the opening lines.`,
    `If relevant, weave in ${improvement} naturally where you have real proof.`,
  ];
}

function buildActionVerbSuggestions(topSkills = []) {
  const base = ["Led", "Built", "Improved", "Delivered", "Optimized", "Automated", "Scaled", "Designed"];
  const skillAware = topSkills.slice(0, 4).map((skill) => `Implemented ${skill}`);
  return Array.from(new Set([...base, ...skillAware])).slice(0, 10);
}

function buildMetricsSuggestions(metricCount = 0) {
  const emphasis = metricCount >= 3 ? "You already have some metrics; now sharpen the best ones." : "Your resume needs more quantifiable proof.";
  return {
    note: emphasis,
    examples: [
      "Increased conversion by 24%",
      "Reduced processing time by 38%",
      "Served 10K+ active users",
      "Saved 120+ hours per quarter",
      "Delivered 7 projects on time",
      "Improved model accuracy from 81% to 89%",
    ],
  };
}

const ROLE_SIGNAL_PROFILES = [
  {
    role: "ML Engineer",
    aliases: ["ml engineer", "machine learning engineer", "ai engineer", "applied ai engineer", "data scientist"],
    signals: ["machine learning", "deep learning", "llm", "nlp", "computer vision", "mlops", "model training", "inference"],
    skills: ["python", "ml", "pytorch", "tensorflow", "nlp", "aws", "docker"],
  },
  {
    role: "Data Analyst",
    aliases: ["data analyst", "business analyst", "analytics engineer", "bi analyst"],
    signals: ["dashboard", "analytics", "reporting", "business intelligence", "power bi", "tableau", "looker", "insights"],
    skills: ["sql", "python", "excel", "tableau", "looker"],
  },
  {
    role: "Data Engineer",
    aliases: ["data engineer", "analytics engineer", "etl engineer"],
    signals: ["etl", "data pipeline", "warehouse", "spark", "airflow", "dbt", "snowflake", "bigquery"],
    skills: ["python", "sql", "aws", "docker", "airflow", "terraform"],
  },
  {
    role: "Backend Engineer",
    aliases: ["backend engineer", "software engineer", "sde", "api engineer", "platform engineer"],
    signals: ["backend", "api", "microservice", "server", "distributed systems", "rest", "express", "fastapi"],
    skills: ["node", "express", "fastapi", "sql", "mongodb", "docker", "rest apis", "testing"],
  },
  {
    role: "Full Stack Engineer",
    aliases: ["full stack engineer", "full stack developer", "software engineer", "product engineer"],
    signals: ["full stack", "end-to-end", "frontend", "backend", "web app", "react", "node", "product"],
    skills: ["javascript", "typescript", "react", "node", "express", "sql", "mongodb", "git"],
  },
  {
    role: "Frontend Engineer",
    aliases: ["frontend engineer", "ui engineer", "frontend developer"],
    signals: ["frontend", "ui", "ux", "design system", "accessibility", "responsive", "next.js"],
    skills: ["javascript", "typescript", "react", "testing", "git"],
  },
  {
    role: "DevOps Engineer",
    aliases: ["devops engineer", "sre", "site reliability engineer", "platform engineer"],
    signals: ["devops", "sre", "ci/cd", "kubernetes", "terraform", "observability", "infrastructure", "deployment"],
    skills: ["aws", "docker", "kubernetes", "terraform", "ci/cd", "testing"],
  },
  {
    role: "Product Analyst",
    aliases: ["product analyst", "product manager", "growth analyst", "product ops"],
    signals: ["product analytics", "user research", "experimentation", "stakeholders", "roadmap", "retention", "funnel"],
    skills: ["sql", "analytics", "testing", "git"],
  },
];

function normalizeRoleLabel(role = "") {
  const lower = String(role || "").toLowerCase();
  if (!lower) return "Backend Engineer";
  if (/(machine learning|ml engineer|ai engineer|applied ai|data scientist|llm|nlp)/i.test(lower)) return "ML Engineer";
  if (/(data engineer|etl|airflow|spark|warehouse|dbt|snowflake|bigquery)/i.test(lower)) return "Data Engineer";
  if (/(data analyst|business analyst|analytics engineer|bi analyst|tableau|power bi|looker)/i.test(lower)) return "Data Analyst";
  if (/(devops|sre|site reliability|terraform|kubernetes|platform engineer)/i.test(lower)) return "DevOps Engineer";
  if (/(frontend|ui engineer|frontend developer|react developer|next\.js)/i.test(lower)) return "Frontend Engineer";
  if (/(full stack|fullstack|product engineer)/i.test(lower)) return "Full Stack Engineer";
  if (/(product analyst|product manager|growth analyst|product ops)/i.test(lower)) return "Product Analyst";
  if (/(backend|software engineer|sde|api engineer|node|express|java|fastapi|microservice)/i.test(lower)) return "Backend Engineer";
  return role || "Backend Engineer";
}

function getRoleProfile(role = "") {
  const normalized = normalizeRoleLabel(role);
  return ROLE_SIGNAL_PROFILES.find((profile) => profile.role === normalized) || null;
}

function rankRolesFromText(text = "", explicitRole = "") {
  if (explicitRole) {
    const normalized = normalizeRoleLabel(explicitRole);
    return [
      { role: normalized, score: 100, matchedSignals: [String(explicitRole || normalized)] },
      ...ROLE_SIGNAL_PROFILES
        .filter((profile) => profile.role !== normalized)
        .map((profile) => ({ role: profile.role, score: 0, matchedSignals: [] })),
    ];
  }

  const lower = String(text || "").toLowerCase();
  const resumeSkills = new Set(normalizeSkillList(keywordSkills(text)));
  const parsed = parseResumeDetails(text);
  const projectEvidence = `${parsed.projects.join(" ")} ${parsed.experience.join(" ")}`.toLowerCase();

  const ranked = ROLE_SIGNAL_PROFILES.map((profile) => {
    const signalHits = profile.signals.filter((token) => lower.includes(token));
    const aliasHits = profile.aliases.filter((token) => lower.includes(token));
    const skillHits = profile.skills.filter((skill) => resumeSkills.has(canonicalizeSkill(skill)));
    const projectHits = profile.signals.filter((token) => projectEvidence.includes(token)).slice(0, 3);
    const rawScore =
      aliasHits.length * 16 +
      signalHits.length * 9 +
      skillHits.length * 13 +
      projectHits.length * 6;

    return {
      role: profile.role,
      rawScore,
      score: rawScore,
      matchedSignals: Array.from(new Set([...aliasHits, ...signalHits, ...skillHits])).slice(0, 6),
    };
  }).sort((a, b) => b.rawScore - a.rawScore);

  const topRaw = ranked[0]?.rawScore || 1;
  return ranked.map((entry) => ({
    ...entry,
    score: Math.round(clamp((entry.rawScore / topRaw) * 100)),
  }));
}

function inferRoleFromText(text, explicitRole = "") {
  if (explicitRole) return normalizeRoleLabel(explicitRole);
  const ranked = rankRolesFromText(text);
  return ranked[0]?.score ? ranked[0].role : "Backend Engineer";
}

function buildApplyUrl(job = {}) {
  if (job.applyUrl) return job.applyUrl;
  const query = encodeURIComponent([job.title, job.company].filter(Boolean).join(" ").trim() || "jobs");
  const location = encodeURIComponent(job.location || "");
  if (job.source === "Internshala") return `https://internshala.com/internships/keywords-${query}`;
  if (job.source === "Unstop") return "https://unstop.com/jobs";
  if (/linkedin/i.test(job.source || "")) {
    return `https://www.linkedin.com/jobs/search/?keywords=${query}&location=${location}`;
  }
  if (/naukri/i.test(job.source || "")) {
    return `https://www.naukri.com/${query}-jobs`;
  }
  return `https://www.indeed.com/jobs?q=${query}&l=${location}`;
}

function isGenericJobSearchUrl(url = "") {
  const value = String(url || "").toLowerCase();
  if (!value) return false;
  return (
    /indeed\.[^/]+\/jobs\?/.test(value) ||
    value.includes("linkedin.com/jobs/search") ||
    value.includes("naukri.com/") && value.endsWith("-jobs") ||
    value.includes("internshala.com/internships/keywords-") ||
    value === "https://unstop.com/jobs"
  );
}

function buildChatFollowUps({ mode = "resume", role = "", hasResume = false, hasJD = false }) {
  const common = [
    "Can you rewrite my top 3 bullets with stronger impact?",
    "What should I improve first to get more interviews?",
    "Explain that in simpler language.",
  ];
  const byMode = {
    "ai-mode": [
      "What would a recruiter notice in the first 15 seconds?",
      "Give me the three highest-impact fixes before I apply.",
    ],
    resume: [
      "Which achievements should I move to the top of the resume?",
      "What keywords are missing for my target role?",
    ],
    customize: [
      "Customize my summary for this job description.",
      "Which experience bullets should I tailor for this JD?",
    ],
    feedback: [
      "Explain the feedback like I'm a beginner.",
      "Turn the feedback into a 5-step action plan.",
    ],
    career: [
      `What should I learn next for ${role || "this role"}?`,
      "Suggest 2 portfolio projects for my profile.",
    ],
  };

  const extras = [];
  if (!hasResume) extras.push("Upload your resume so I can give line-by-line advice.");
  if (!hasJD) extras.push("Paste a job description and I will tailor the resume for it.");

  return [...(byMode[mode] || byMode.resume), ...common, ...extras].slice(0, 4);
}

function buildHeuristicChatReply({
  prompt = "",
  mode = "resume",
  role = "",
  hasResume = false,
  hasJD = false,
  hasExtraContext = false,
  explainSimple = false,
  resumeContext = null,
  jobContext = null,
  extraContextText = "",
}) {
  const lower = String(prompt || "").toLowerCase();
  const topSkills = resumeContext?.topSkills || [];
  const detectedRole = resumeContext?.detectedRole || role || "your target role";
  const projectHighlights = resumeContext?.projectHighlights || [];
  const experienceHighlights = resumeContext?.experienceHighlights || [];
  const matchedSkills = jobContext?.matchedSkills || [];
  const missingSkills = jobContext?.missingSkills || [];
  const lowerSkills = topSkills.map((skill) => String(skill).toLowerCase());
  const aiMlScore = lowerSkills.filter((skill) =>
    ["python", "machine learning", "tensorflow", "pytorch", "deep learning", "nlp", "opencv", "data science", "sql"].includes(skill)
  ).length;
  const webScore = lowerSkills.filter((skill) =>
    ["javascript", "react", "node", "express", "html", "css", "frontend", "backend", "api"].includes(skill)
  ).length;

  if (mode === "customize" || lower.includes("job description") || lower.includes("jd")) {
    return hasJD
      ? "Match the summary, top skills, and first 3 experience bullets to the JD. Mirror the exact role keywords, move the most relevant project upward, and quantify outcomes in the bullets that best match the job."
      : "Paste the job description, then I can tailor your summary, skills, and top experience bullets to match it.";
  }

  if (
    lower.includes("top problems") ||
    lower.includes("problems in this") ||
    lower.includes("problems in the file") ||
    lower.includes("issues in this") ||
    lower.includes("problems in my resume") ||
    lower.includes("what is wrong") ||
    lower.includes("issues in my resume")
  ) {
    if (!hasResume && !hasExtraContext) {
      return "Upload your resume, files, or folder context and I can point out the biggest problems more specifically. Usually the top issues are weak metrics, generic summaries, and missing role-specific keywords.";
    }
    if (!hasResume && hasExtraContext) {
      return `From the uploaded context, I would start by checking for the clearest failure points, repeated errors, missing evidence, and places where the files do not explain cause and effect clearly. ${extraContextText ? "If you add a transcript or notes for video files, I can diagnose those much more precisely." : ""}`;
    }
    const missingExperience = !experienceHighlights.length;
    const missingProjects = !projectHighlights.length;
    const problemList = [
      missingExperience ? "experience is not clearly extracted, so your work impact may not be easy to scan" : "your experience section should lead with stronger impact and metrics",
      topSkills.length ? `your visible skills are ${topSkills.join(", ")}, but they need clearer proof inside bullets` : "your skills need to be more explicit and role-focused",
      missingProjects ? "projects are either missing or not clearly separated" : "projects should be rewritten to show outcome, scale, and ownership",
    ];
    return `The top problems I see are: ${problemList.join("; ")}. Start by rewriting the most important 2 to 3 bullets with action, metric, and result.`;
  }

  if (
    lower.includes("keyword") ||
    lower.includes("keywords") ||
    lower.includes("missing keyword") ||
    lower.includes("target role")
  ) {
    if (!hasResume) {
      return "Upload your resume first so I can compare your current wording against your target role and point out missing keywords more accurately.";
    }
    const roleKeywordMap = {
      "ML Engineer": ["pytorch", "tensorflow", "mlops", "model deployment", "feature engineering", "model monitoring"],
      "Data Engineer": ["airflow", "spark", "etl", "data pipeline", "warehouse", "snowflake"],
      "Data Scientist": ["experimentation", "statistics", "machine learning", "feature engineering", "python", "sql"],
      SDE: ["apis", "system design", "testing", "ci/cd", "scalability", "backend"],
      DevOps: ["terraform", "kubernetes", "observability", "incident response", "sre", "ci/cd"],
      "Product Manager": ["roadmap", "metrics", "stakeholder management", "user research", "prioritization", "experimentation"],
    };
    const targetKeywords = roleKeywordMap[detectedRole] || roleKeywordMap[role] || ["impact", "ownership", "metrics", "scalability", "collaboration"];
    const missingKeywords = targetKeywords.filter((item) => !topSkills.map((s) => s.toLowerCase()).includes(item.toLowerCase()));
    return `For ${detectedRole}, the likely keywords to strengthen are: ${missingKeywords.slice(0, 5).join(", ") || targetKeywords.slice(0, 5).join(", ")}. Add them only where they are genuinely supported by your projects or experience.`;
  }

  if (
    lower.includes("ats") ||
    lower.includes("ats score") ||
    lower.includes("increase the score") ||
    lower.includes("improve the score") ||
    lower.includes("increase my score")
  ) {
    if (!hasResume) {
      return "To improve ATS score, add a clean role-focused summary, include the exact keywords from the job description, keep section headings standard, and make sure your strongest skills also appear inside your experience bullets with measurable impact.";
    }
    const atsFixes = [
      topSkills.length
        ? `Keep the strongest ATS keywords visible across both skills and bullets, especially ${topSkills.slice(0, 4).join(", ")}`
        : "Add a stronger keyword cluster for the role you want",
      (resumeContext?.metricCount || 0) < 3
        ? "Add more measurable outcomes like percentages, counts, or scale to your project and experience bullets"
        : "Keep the metrics you already have near the top of the resume",
      projectHighlights.length
        ? "Rewrite project bullets to include action, tool, and result in one line so ATS and recruiters both get clearer evidence"
        : "Add one project section with tools used, what you built, and the outcome",
      hasJD && missingSkills.length
        ? `Mirror missing JD terms like ${missingSkills.slice(0, 3).join(", ")} where they are genuinely supported`
        : "Use the target JD language in your summary and first few bullets",
    ];
    return `To increase ATS score, focus on four upgrades: ${atsFixes.join("; ")}. The fastest win is to align the summary, skills, and first experience bullets around the exact role you are applying for.`;
  }

  if (
    lower.includes("project") ||
    lower.includes("projects") ||
    lower.includes("improvement regarding my projects") ||
    lower.includes("improve my projects") ||
    lower.includes("suggest improvement regarding my projects")
  ) {
    if (!hasResume) {
      return "Improve your projects by making each one show the problem, the stack, the feature you built, and the measurable result. Recruiters care more about ownership and outcome than a long tool list.";
    }
    if (!projectHighlights.length) {
      return "Your resume does not surface projects clearly enough right now. Add a separate projects section and make each project line show the problem solved, core stack, your role, and one measurable outcome.";
    }
    const projectAdvice = [
      `Lead each project with the strongest business or user outcome instead of just naming the tech stack`,
      `Turn tool-only lines into impact lines such as action + technology + result`,
      `For projects like ${projectHighlights.slice(0, 2).join(" and ")}, add numbers such as users, accuracy, latency, throughput, or time saved`,
      "State your ownership clearly with words like built, designed, deployed, optimized, or automated",
    ];
    return `The main improvements for your projects are: ${projectAdvice.join("; ")}. If you want, paste one project bullet and I can rewrite it into a stronger recruiter-ready version.`;
  }

  if (
    lower.includes("which domain") ||
    lower.includes("which career") ||
    lower.includes("which role") ||
    lower.includes("what domain") ||
    lower.includes("which carrer") ||
    lower.includes("suit me") ||
    lower.includes("according to my resume") ||
    lower.includes("according to this resume")
  ) {
    if (!hasResume) {
      return "Upload your resume and I can compare your current skills against domains like web development, AI/ML, data, or backend more accurately.";
    }

    const suggestedDomain =
      aiMlScore > webScore
        ? "AI/ML Engineer"
        : webScore > aiMlScore
          ? "Web or Full Stack Developer"
          : detectedRole;

    const why = aiMlScore > webScore
      ? `Your resume leans more toward AI/ML because it shows stronger signals in ${topSkills.slice(0, 4).join(", ") || "Python and machine-learning related skills"}.`
      : webScore > aiMlScore
        ? `Your resume currently looks stronger for web or full stack roles because it shows clearer signal in ${topSkills.slice(0, 4).join(", ") || "JavaScript and development stack skills"}.`
        : `Your resume is somewhat balanced, but the strongest current fit still looks closest to ${detectedRole}.`;

    const caution = aiMlScore > webScore
      ? "If you choose AI/ML, strengthen model-building proof, deployed ML projects, and measurable outcomes."
      : webScore > aiMlScore
        ? "If you choose web development, strengthen project depth, frontend/backend ownership, and user-impact metrics."
        : "The best next step is to pick one direction and make the top half of the resume fully consistent with it.";

    return `Based on your current resume, the better-fit domain is ${suggestedDomain}. ${why} ${caution}`;
  }

  if (lower.includes("bullet") || lower.includes("bullets")) {
    return hasResume
      ? "Your bullets should follow this pattern: action verb + what you built or changed + tool/skill used + measurable result. Remove generic responsibility wording and make each bullet prove impact."
      : "Use bullets that show action, context, and result. The strongest bullets sound like ownership plus outcome, not task lists.";
  }

  if (lower.includes("achievements") || lower.includes("top of the resume") || lower.includes("move to the top")) {
    return hasResume
      ? "Move the achievements that are closest to your target role and show the strongest measurable impact. Prioritize wins with clear metrics, ownership, and business outcomes before general responsibilities."
      : "Put the most role-relevant achievements first, especially the ones with numbers, clear ownership, and strong business impact.";
  }

  if (lower.includes("summary")) {
    return "Your summary should lead with role fit, years of experience, strongest skills, and one measurable strength. Keep it to 2 to 3 lines and avoid generic phrases like hardworking or team player.";
  }

  if (lower.includes("skills")) {
    return "Keep skills focused on the target role. Put the most relevant tools and technologies first, group them cleanly, and remove older or weaker items that dilute the profile.";
  }

  if (lower.includes("feedback") || mode === "feedback") {
    return explainSimple
      ? "The feedback means your resume needs stronger proof. Add specific work you did, show one number where possible, and make it easier for a recruiter to quickly see your impact."
      : "The feedback points to missing evidence, weak prioritization, or generic phrasing. Strengthen the most relevant bullets with clearer action, context, and measurable outcomes.";
  }

  if (lower.includes("rewrite") || lower.includes("edit")) {
    return "Paste the exact bullet or section you want to improve, and I will rewrite it with stronger action verbs, better clarity, and clearer impact.";
  }

  if (mode === "career" || lower.includes("career") || lower.includes("switch")) {
    return `Focus on the skills, projects, and interview stories that best support ${role || "your target role"}. Build 1 to 2 strong portfolio pieces, tighten your resume around that direction, and practice explaining impact clearly.`;
  }

  if (mode === "ai-mode") {
    const metricStrength = resumeContext?.metricCount || 0;
    const sectionNames = Object.entries(resumeContext?.sectionsPresent || {})
      .filter(([, present]) => present)
      .map(([name]) => name);
    const weakSections = Object.entries(resumeContext?.sectionsPresent || {})
      .filter(([, present]) => !present)
      .map(([name]) => name);
    const visibleStrengths = topSkills.slice(0, 4);
    const visibleGaps = missingSkills.slice(0, 4);
    const scoreText = typeof resumeContext?.atsScore === "number"
      ? `Current ATS score is ${resumeContext.atsScore}/100.`
      : "";
    const firstWeakSection = weakSections[0] || (!sectionNames.includes("summary") ? "summary" : "top experience bullets");
    const firstProof = experienceHighlights[0] || projectHighlights[0] || "the strongest relevant bullet";

    if (
      lower.includes("first 15 second") ||
      lower.includes("first 10 second") ||
      lower.includes("recruiter notice") ||
      lower.includes("first screen")
    ) {
      return [
        visibleStrengths.length
          ? `In the first recruiter scan, the clearest positives are ${visibleStrengths.slice(0, 3).join(", ")}.`
          : "In the first recruiter scan, the role signal is still too weak to feel immediately convincing.",
        hasJD
          ? visibleGaps.length
            ? `The first doubts will come from missing or under-evidenced requirements like ${visibleGaps.slice(0, 3).join(", ")}.`
            : "The main risk is not keywords but whether the bullets prove enough real ownership and impact."
          : `The first doubt is whether the resume is clearly aimed at one role, because ${firstWeakSection} is still weak.`,
        metricStrength >= 3
          ? `The best first impression should come from ${firstProof}, so move that evidence higher if it is buried.`
          : `The quickest first-screen improvement is to rewrite ${firstProof} with action, metric, and outcome.`,
      ].join(" ");
    }

    if (
      lower.includes("three highest-impact") ||
      lower.includes("3 highest-impact") ||
      lower.includes("top 3 fixes") ||
      lower.includes("highest impact fixes") ||
      lower.includes("before i apply")
    ) {
      const fixes = [
        `${1}. Rewrite ${firstWeakSection} so the target role and strongest supported skills are obvious immediately.`,
        `${2}. Strengthen the top 2 bullets with explicit ownership and measurable impact${metricStrength >= 3 ? " and move the strongest one higher" : ""}.`,
        `${3}. ${visibleGaps.length ? `Close or address the biggest visible gaps: ${visibleGaps.slice(0, 3).join(", ")}.` : "Tighten keyword alignment with the JD in summary, skills, and the first few bullets."}`,
      ];
      return `The three highest-impact fixes are: ${fixes.join(" ")}`;
    }

    if (
      lower.includes("strongest signal") ||
      lower.includes("strongest signals") ||
      lower.includes("what is working") ||
      lower.includes("strength")
    ) {
      return [
        visibleStrengths.length
          ? `The strongest current signals are ${visibleStrengths.slice(0, 4).join(", ")}.`
          : "The resume does not yet surface enough strong skill signal near the top.",
        experienceHighlights.length
          ? `The best proof appears in ${experienceHighlights.slice(0, 2).join(" and ")}.`
          : projectHighlights.length
            ? `The best proof currently comes from projects like ${projectHighlights.slice(0, 2).join(" and ")}.`
            : "The profile still needs clearer proof through stronger bullets and more specific examples.",
        metricStrength >= 3
          ? `Metrics are helping, because the resume already includes ${metricStrength} quantified signals.`
          : "The current strength is mostly skill overlap, not measurable proof yet.",
      ].join(" ");
    }

    if (
      lower.includes("biggest gap") ||
      lower.includes("biggest gaps") ||
      lower.includes("main gap") ||
      lower.includes("risk") ||
      lower.includes("weakest")
    ) {
      return [
        visibleGaps.length
          ? `The biggest role-fit gaps are ${visibleGaps.slice(0, 3).join(", ")}.`
          : "The main gap is not keyword coverage but stronger evidence and prioritization.",
        `The weakest artifact right now is ${firstWeakSection}, because that is where recruiter confidence drops fastest.`,
        metricStrength < 3
          ? "There is also a proof gap: too few bullets show measurable outcomes."
          : "Even where the raw signal exists, it needs to be surfaced more clearly near the top.",
      ].join(" ");
    }

    if (
      lower.includes("rewrite") ||
      lower.includes("edit") ||
      lower.includes("improve this answer") ||
      lower.includes("make it better")
    ) {
      return `The fastest rewrite pattern here is: target role + strongest verified skills + one proof line. For bullets, use action verb + scope + tool + measurable result. If you paste the exact line, I will rewrite it directly instead of giving diagnosis.`;
    }

    const headline = hasResume
      ? topSkills.length >= 4
        ? `The resume has real signal in ${topSkills.slice(0, 4).join(", ")}, so the problem is not lack of keywords but how convincingly the evidence is presented.`
        : `The resume still lacks enough strong role signal, so the first fix is sharpening the top section around the target role and strongest verified skills.`
      : hasExtraContext
        ? "The uploaded context is enough to start diagnosing the biggest issues and the fastest fixes."
        : "AI mode works best with resume context, but I can still help prioritize the biggest fixes from the available information.";
    const recruiterLens = hasJD
      ? matchedSkills.length >= 4
        ? `Against this job description, the fit is strongest in ${matchedSkills.slice(0, 4).join(", ")}, while recruiter hesitation will likely come from ${missingSkills.slice(0, 3).join(", ") || "thin proof in the core requirements"}.`
        : `Against this job description, the overlap is still too shallow. The most visible gaps are ${missingSkills.slice(0, 3).join(", ") || "role-specific skills and proof"}.`
      : weakSections.length
        ? `Without a job description, the clearest weakness is structure: ${weakSections.slice(0, 2).join(", ")} needs stronger content.`
        : "Add the target job description to make the diagnosis more role-specific and more useful.";
    const proofLens = experienceHighlights.length
      ? metricStrength >= 3
        ? `The best evidence is already in bullets such as ${experienceHighlights.slice(0, 2).join(" and ")}, so the next step is to move that proof higher and make it easier to scan.`
        : `There is usable experience signal in ${experienceHighlights.slice(0, 2).join(" and ")}, but those bullets still need clearer ownership and measurable outcomes.`
      : sectionNames.includes("projects")
        ? "Project material exists, but it needs to read more like proof for the target role instead of a generic list of tasks or tools."
        : "There is not enough visible proof yet, so start by rewriting the top bullets with action, scope, metric, and outcome.";
    const prioritization = weakSections.length
      ? `Fix ${weakSections[0]} first, because that weakness shows up immediately in the recruiter scan.`
      : topSkills.length
        ? "Prioritize the first screen of the resume so the strongest skills and best evidence are impossible to miss."
        : "Prioritize the top third of the resume first, because that is where recruiter confidence is won or lost.";
    return [headline, scoreText, recruiterLens, proofLens, prioritization].filter(Boolean).join(" ");
  }

  return hasResume
    ? "Ask about a specific part of your resume, and I can help improve that section directly. I can also tailor it for a job description or explain feedback in simpler language."
    : "Upload a resume or ask about a specific section like summary, skills, projects, or experience, and I will give more targeted advice.";
}

function buildResumeChatContext(resumeText = "") {
  if (!resumeText.trim()) return null;
  const details = parseResumeDetails(resumeText);
  const skills = keywordSkills(resumeText);
  const metricMatches = resumeText.match(/\b\d+(?:\.\d+)?(?:%|x|k|m|b)?(?:\+)?\b/g) || [];
  const sectionsPresent = analyzeResumeSections(resumeText);
  return {
    detectedRole: inferRoleFromText(resumeText),
    topSkills: skills.slice(0, 8),
    experienceHighlights: details.experience.slice(0, 3),
    projectHighlights: details.projects.slice(0, 3),
    education: details.education.slice(0, 2),
    metricCount: metricMatches.length,
    certifications: details.certifications.slice(0, 3),
    sectionsPresent,
  };
}

function buildJobDescriptionContext(jobDescription = "", resumeContext = null, explicitRole = "") {
  if (!jobDescription.trim()) return null;
  const jdSkills = normalizeSkillList(keywordSkills(jobDescription));
  const resumeSkills = normalizeSkillList(resumeContext?.topSkills || []);
  const matchedSkills = getMatchingSkills(jdSkills, resumeSkills);
  const missingSkills = getMissingSkills(jdSkills, resumeSkills);
  const lower = jobDescription.toLowerCase();
  const repeatedKeywords = Array.from(
    new Set(
      jdSkills.filter((skill) => {
        const escaped = escapeRegex(skill.toLowerCase());
        const matches = lower.match(new RegExp(`\\b${escaped}\\b`, "g")) || [];
        return matches.length >= 2;
      })
    )
  ).slice(0, 5);

  return {
    inferredRole: inferRoleFromText(jobDescription, explicitRole),
    jdSkills: jdSkills.slice(0, 12),
    matchedSkills: matchedSkills.slice(0, 8),
    missingSkills: missingSkills.slice(0, 8),
    repeatedKeywords,
  };
}

function inferTimelineHint(text = "") {
  const lower = String(text || "").toLowerCase();
  if (/30[- ]?day|1 month|one month/.test(lower)) return "30-day sprint";
  if (/60[- ]?day|2 month|two month/.test(lower)) return "60-day plan";
  if (/90[- ]?day|3 month|three month/.test(lower)) return "90-day plan";
  if (/6 month|six month|half year/.test(lower)) return "6-month transition";
  if (/12 month|1 year|one year/.test(lower)) return "12-month growth plan";
  return "next 8-12 weeks";
}

function buildCoachProfileSummary(profile = {}) {
  return [
    profile.name ? `Name: ${profile.name}` : null,
    profile.currentRole ? `Current role: ${profile.currentRole}` : null,
    profile.experience ? `Experience: ${profile.experience}` : null,
    profile.dreamCompany ? `Dream company: ${profile.dreamCompany}` : null,
    profile.strengths ? `Strengths: ${profile.strengths}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

function toCoachList(value, fallback = []) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|•|-/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return fallback;
}

function normalizeCoachSalaryPrediction(value, fallback = { range: "", note: "" }) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      range: String(value.range || fallback.range || "").trim(),
      note: String(value.note || fallback.note || "").trim(),
    };
  }
  if (typeof value === "string" && value.trim()) {
    return { range: value.trim(), note: fallback.note || "" };
  }
  return fallback;
}

function extractJSONObject(text = "") {
  const source = String(text || "").trim();
  const firstBrace = source.indexOf("{");
  const lastBrace = source.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  return source.slice(firstBrace, lastBrace + 1);
}

function normalizeCoachResponse(parsed = {}, scaffold = {}) {
  return {
    ...scaffold,
    answer: String(parsed?.answer || scaffold.answer || "").trim(),
    careerPath: toCoachList(parsed?.careerPath, scaffold.careerPath),
    skillRoadmap: toCoachList(parsed?.skillRoadmap, scaffold.skillRoadmap),
    industryTrends: toCoachList(parsed?.industryTrends, scaffold.industryTrends),
    learningPlan: toCoachList(parsed?.learningPlan, scaffold.learningPlan),
    salaryPrediction: normalizeCoachSalaryPrediction(parsed?.salaryPrediction, scaffold.salaryPrediction),
    switchGuidance: toCoachList(parsed?.switchGuidance, scaffold.switchGuidance),
    dailyTip: String(parsed?.dailyTip || scaffold.dailyTip || "").trim(),
    habitBuilder: toCoachList(parsed?.habitBuilder, scaffold.habitBuilder),
    motivation: String(parsed?.motivation || scaffold.motivation || "").trim(),
    followUps: toCoachList(parsed?.followUps, scaffold.followUps).slice(0, 4),
    resources: toCoachList(parsed?.resources, scaffold.resources),
    timelines: toCoachList(parsed?.timelines, scaffold.timelines),
  };
}

function buildCareerCoachFallback(question = "", role = "", context = "", profile = {}, timeline = []) {
  const targetRole = role || profile.currentRole || "AI Engineer";
  const lower = String(question || "").toLowerCase();
  const timelineHint = inferTimelineHint(`${question} ${context}`);
  const profileSummary = buildCoachProfileSummary(profile);
  const baseSkills = {
    "AI Engineer": ["Python", "ML fundamentals", "MLOps", "LLM app building", "System design"],
    "Data Scientist": ["Python", "Statistics", "Experimentation", "SQL", "Modeling"],
    "Data Engineer": ["SQL", "Airflow", "Spark", "Data modeling", "Cloud pipelines"],
    "ML Engineer": ["PyTorch", "Feature engineering", "Model deployment", "Monitoring", "MLOps"],
    "Product Manager": ["Product sense", "Metrics", "Roadmaps", "Stakeholder management", "Execution"],
    General: ["Communication", "Projects", "Consistency", "Networking", "Interview prep"],
  };
  const roadmap = baseSkills[targetRole] || baseSkills.General;
  const projectIdeas = {
    "AI Engineer": [
      "Build an AI support copilot that answers questions from uploaded documents.",
      "Ship an LLM evaluation dashboard with prompt/version comparison.",
    ],
    "ML Engineer": [
      "Create an end-to-end churn model with deployment and drift monitoring.",
      "Build a feature store style pipeline with batch and inference paths.",
    ],
    "Data Engineer": [
      "Build an ETL pipeline with Airflow, warehouse modeling, and data quality checks.",
      "Create a streaming analytics project with event ingestion and dashboards.",
    ],
    "Product Manager": [
      "Write a PRD plus metrics plan for a launch-ready product feature.",
      "Run a user problem discovery case study with prioritization and roadmap output.",
    ],
    General: [
      "Build one portfolio project that proves your strongest skill.",
      "Create one case study that shows problem, action, and impact clearly.",
    ],
  };
  const habits = [
    "Spend 45 focused minutes daily on one core skill.",
    "Ship one visible portfolio improvement every week.",
    "Write down one learning and one career win every evening.",
  ];

  let answer = `Your fastest path toward ${targetRole} is to tighten your positioning, build visible proof through projects, and practice explaining impact clearly over the ${timelineHint}. ${context ? `Use your current context of ${context} as the foundation.` : ""} ${profileSummary ? `Anchor the plan around this profile: ${profileSummary}.` : ""}`.trim();

  if (lower.includes("30-day") || lower.includes("roadmap")) {
    answer = `A strong 30-day plan for ${targetRole} should split into four phases: fundamentals, one portfolio build, one resume refresh, and interview/story practice. Focus on visible output every week rather than passive learning, and make each week end with something you can show recruiters.`;
  } else if (lower.includes("project")) {
    answer = `The best first projects for ${targetRole} are the ones that prove practical execution, not just theory. Pick one project that solves a real problem and one project that demonstrates depth in tools used by hiring teams.`;
  } else if (lower.includes("salary")) {
    answer = `Salary for ${targetRole} depends most on role depth, project proof, communication quality, and geography. Strong execution plus a clear portfolio usually moves the range upward more than certificates alone.`;
  } else if (lower.includes("switch") || lower.includes("transition")) {
    answer = `A career switch into ${targetRole} works best when you reframe your current experience, close the most visible skill gaps, and create evidence through projects that look like real work.`;
  } else if (lower.includes("learn first") || lower.includes("what should i learn")) {
    answer = `Start with the smallest set of skills that unlocks practical work in ${targetRole}, then apply them in one visible project immediately. Avoid collecting too many disconnected topics early.`;
  }

  return {
    answer,
    careerPath: [
      `Right now: align your resume, LinkedIn, and projects to ${targetRole}.`,
      `Next ${timelineHint}: close the top 2-3 skill gaps and publish proof of work weekly.`,
      "Then: build 2 strong portfolio projects with measurable outcomes and better storytelling.",
      "After that: move toward stronger ownership, system thinking, and leadership stories.",
    ],
    skillRoadmap: roadmap,
    industryTrends: [
      "Hiring is rewarding proof of execution over generic skill lists.",
      "AI-assisted tooling is increasing demand for practical builders.",
      "Cross-functional communication is becoming a stronger differentiator.",
    ],
    learningPlan: [
      "Week 1 to 2: refresh core fundamentals and identify your gaps.",
      "Week 3 to 4: build one portfolio project tied to the target role.",
      "Week 5 to 6: rewrite resume bullets and LinkedIn around proof and outcomes.",
      "Week 7 onward: prepare stories, mock interviews, and targeted applications.",
    ],
    salaryPrediction: {
      range: targetRole.includes("Product") ? "₹10-18 LPA" : "₹8-16 LPA",
      note: "Range depends on geography, portfolio quality, and interview strength.",
    },
    switchGuidance: [
      "Translate your current experience into the language of the target role.",
      "Use side projects to close credibility gaps quickly.",
      "Prepare a clear story for why this switch is logical now.",
    ],
    dailyTip: "Pick one small but visible career action every day: learn, build, refine, or apply.",
    habitBuilder: habits,
    motivation: "Momentum beats intensity. Small visible progress every day compounds into confidence.",
    followUps: [
      `Build me a 30-day roadmap for ${targetRole}.`,
      projectIdeas[targetRole]?.[0] ? "Which projects should I build first?" : "Which project should I build first?",
      "How should I rewrite my resume for this path?",
      "What are the top mistakes blocking interviews for me?",
    ],
    resources: [
      `${targetRole} job descriptions on LinkedIn or Indeed - use them to spot repeated requirements.`,
      "Official documentation for your core tools - build from primary sources first.",
      "One strong portfolio case study template - show problem, action, stack, and impact.",
    ],
    timelines: Array.isArray(timeline) && timeline.length ? timeline : [
      "Week 1: define target role, skill gaps, and one proof-of-work project.",
      "Week 2-3: complete the project foundation and publish progress.",
      "Week 4: polish resume, LinkedIn, and outreach story around that proof.",
    ],
  };
}

function buildPlatformSearches(role, location = "", skills = []) {
  const coreQuery = [role || "software engineer", ...(skills || []).slice(0, 3)].filter(Boolean).join(" ");
  const roleQuery = encodeURIComponent(coreQuery);
  const locationText = location && location !== "Any" ? location : "India";
  const locationQuery = encodeURIComponent(locationText);
  const internshalaKeyword = encodeURIComponent((role || skills?.[0] || "software development").toLowerCase().replace(/\s+/g, "-"));
  const naukriRole = encodeURIComponent((role || "software developer").toLowerCase().replace(/\s+/g, "-"));
  const naukriLocation = encodeURIComponent(locationText.toLowerCase().replace(/\s+/g, "-"));
  return [
    {
      platform: "Indeed India",
      label: `Search ${role || "jobs"} on Indeed India`,
      url: `https://in.indeed.com/jobs?q=${roleQuery}&l=${locationQuery}`,
    },
    {
      platform: "LinkedIn",
      label: `Search ${role || "jobs"} on LinkedIn`,
      url: `https://www.linkedin.com/jobs/search/?keywords=${roleQuery}&location=${locationQuery}`,
    },
    {
      platform: "Naukri",
      label: `Search ${role || "jobs"} on Naukri`,
      url: `https://www.naukri.com/${naukriRole}-jobs-in-${naukriLocation}`,
    },
    {
      platform: "Internshala",
      label: `Search ${role || "internships"} on Internshala`,
      url: `https://internshala.com/internships/keywords-${internshalaKeyword}/`,
    },
  ];
}

const INDIA_JOB_LOCATIONS = [
  "india", "remote india", "remote - india", "remote (india)", "pan india",
  "bengaluru", "bangalore", "hyderabad", "mumbai", "pune", "chennai",
  "noida", "gurugram", "gurgaon", "delhi ncr", "new delhi", "delhi",
];

const FOREIGN_JOB_LOCATIONS = [
  "brazil", "latin america", "latam", "europe", "united states", "usa", "us-only",
  "canada", "united kingdom", " uk", "germany", "france", "spain", "portugal",
  "mexico", "argentina", "colombia",
];

function isIndiaRelevantJob(job = {}, preferredLocation = "") {
  const text = `${job.location || ""} ${job.description || ""} ${preferredLocation || ""}`.toLowerCase();
  if (FOREIGN_JOB_LOCATIONS.some((location) => text.includes(location))) return false;
  if (INDIA_JOB_LOCATIONS.some((location) => text.includes(location))) return true;
  return false;
}

function isFresherFriendlyJob(job = {}, resumeProfile = {}) {
  const years = Number(resumeProfile.experienceYears || 0);
  if (years >= 2) return true;
  const text = `${job.title || ""} ${job.role || ""} ${job.description || ""}`.toLowerCase();
  if (/(senior|lead|principal|architect|manager|5\+?\s*years|6\+?\s*years|7\+?\s*years)/i.test(text)) return false;
  const required = text.match(/(\d+)\+?\s*(?:years|yrs)/i);
  if (required && Number(required[1]) > 2) return false;
  return true;
}

function calculateLocationMatch(job = {}, preferredLocation = "") {
  if (!isIndiaRelevantJob(job, preferredLocation)) return 0;
  const location = String(job.location || "").toLowerCase();
  const preferred = String(preferredLocation || "").toLowerCase();
  if (preferred && preferred !== "any" && location.includes(preferred)) return 1;
  if (location.includes("remote") && location.includes("india")) return 0.95;
  if (INDIA_JOB_LOCATIONS.some((item) => location.includes(item))) return 0.85;
  return 0.7;
}

function normalizeSeedJob(job) {
  return {
    ...job,
    _id: job._id || new mongoose.Types.ObjectId(),
    title: job.title || `${job.role || "Role"} Opportunity`,
    company: job.company || "Career Platform",
    location: job.location || "Remote / Flexible",
    salary: job.salary || "Competitive",
    role: job.role || "General",
    source: job.source || "Seeded",
    tags: job.tags || job.skills || [],
    description: job.description || (job.skills || []).join(" "),
    embedding: job.embedding || [],
  };
}

function buildResumeProfile(text = "", explicitRole = "") {
  const resumeSkills = normalizeSkillList(keywordSkills(text));
  const rankedRoles = rankRolesFromText(text, explicitRole);
  const lowerText = String(text || "").toLowerCase();
  const experienceMatch = lowerText.match(/(\d+)\+?\s*(?:years|yrs)(?:\s+of)?\s+experience/i);
  const experienceYears = experienceMatch ? Number(experienceMatch[1]) : 0;
  const parsedDetails = parseResumeDetails(text);
  const domainEvidenceText = `${parsedDetails.projects.join(" ")} ${parsedDetails.experience.join(" ")}`.toLowerCase();
  const projectCount = parsedDetails.projects.length;
  const technicalStack = resumeSkills.filter((skill) =>
    ["Programming", "Frontend", "Backend", "Data", "Cloud", "DevOps", "AI/ML", "Architecture", "Quality"].includes(
      SKILL_LIBRARY.find((item) => item.name === skill)?.category || ""
    )
  );
  const locationPreferences = Array.from(
    new Set(
      (text.match(/\b(remote|hybrid|onsite|on-site|bengaluru|bangalore|hyderabad|mumbai|pune|delhi ncr|chennai|noida|gurugram|gurgaon)\b/gi) || [])
        .map((item) => item.toLowerCase().replace("bangalore", "bengaluru").replace("on-site", "onsite"))
    )
  );
  const domainExpertise = rankedRoles
    .filter((entry) => entry.score >= 45)
    .map((entry) => entry.role)
    .slice(0, 4);
  return {
    text,
    lowerText,
    resumeSkills,
    technicalStack,
    rankedRoles,
    inferredRole: rankedRoles[0]?.role || inferRoleFromText(text, explicitRole),
    secondaryRoles: rankedRoles.slice(1, 3).map((item) => item.role),
    roleConfidence: rankedRoles[0]?.score || 0,
    experienceYears,
    parsedDetails,
    education: parsedDetails.education,
    certifications: parsedDetails.certifications,
    jobTitles: rankedRoles.map((entry) => entry.role).slice(0, 5),
    domainExpertise,
    locationPreferences,
    sectionsPresent: analyzeResumeSections(text),
    projectCount,
    domainEvidenceText,
  };
}

function buildJobSearchQueries(resumeProfile = {}, { preferredLocation = "", explicitRole = "" } = {}) {
  const primaryRoles = [
    explicitRole,
    resumeProfile.inferredRole,
    ...(resumeProfile.secondaryRoles || []),
  ].filter(Boolean);
  const topSkills = (resumeProfile.resumeSkills || []).slice(0, 5);
  const roleSkillQuery = [primaryRoles[0] || "software developer", ...topSkills.slice(0, 3)].join(" ");
  const queries = [
    roleSkillQuery,
    ...primaryRoles.slice(0, 3).map((role) => [role, ...topSkills.slice(0, 2)].join(" ")),
  ];
  const location = preferredLocation && preferredLocation !== "Any"
    ? preferredLocation
    : resumeProfile.locationPreferences?.[0] || "";

  return Array.from(new Set(queries.map((query) => query.trim()).filter(Boolean))).map((query) => ({
    query,
    location,
  }));
}

function normalizeExternalJob(raw = {}, provider = "External") {
  const source = raw.source || provider;
  const title = raw.title || raw.job_title || raw.position || raw.name || "";
  const company = raw.company || raw.company_name || raw.employer_name || raw.organization || "";
  const location = raw.location || raw.candidate_required_location || raw.job_city || raw.job_country || raw.job_location || "";
  const description = raw.description || raw.job_description || raw.snippet || raw.contents || "";
  const applyUrl = raw.apply_url || raw.url || raw.job_apply_link || raw.redirect_url || raw.job_url || "";
  const postedAt = raw.posted_at || raw.publication_date || raw.job_posted_at_datetime_utc || raw.created_at || "";
  const tags = Array.isArray(raw.tags)
    ? raw.tags
    : Array.isArray(raw.job_required_skills)
      ? raw.job_required_skills
      : raw.category?.tag
        ? [raw.category.tag]
        : [];
  const salary =
    raw.salary ||
    raw.salary_label ||
    raw.job_salary ||
    raw.salary_is_predicted ||
    [raw.salary_min || raw.job_min_salary, raw.salary_max || raw.job_max_salary].filter(Boolean).join(" - ") ||
    "Not disclosed";

  return normalizeSeedJob({
    _id: raw.id || raw.job_id || raw.slug || `${source}-${title}-${company}`.replace(/\s+/g, "-").toLowerCase(),
    title,
    company,
    location: location || "Remote / Flexible",
    salary,
    role: title,
    source,
    applyUrl,
    postedAt: postedAt ? new Date(postedAt) : new Date(),
    tags,
    description,
  });
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 8500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRemotiveJobs(searchQueries = [], limit = 12) {
  const jobs = [];
  for (const { query } of searchQueries.slice(0, 3)) {
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=${limit}`;
    const payload = await fetchJsonWithTimeout(url);
    jobs.push(...(payload.jobs || []).map((job) => normalizeExternalJob(job, "Remotive")));
    if (jobs.length >= limit) break;
  }
  return jobs.slice(0, limit);
}

async function fetchAdzunaJobs(searchQueries = [], limit = 12) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const country = (process.env.ADZUNA_COUNTRY || "in").toLowerCase();
  const jobs = [];
  for (const { query, location } of searchQueries.slice(0, 3)) {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: String(Math.min(limit, 20)),
      what: query,
      sort_by: "date",
    });
    if (location) params.set("where", location);
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
    const payload = await fetchJsonWithTimeout(url);
    jobs.push(...(payload.results || []).map((job) => normalizeExternalJob({
      id: job.id,
      title: job.title,
      company: job.company?.display_name,
      location: job.location?.display_name,
      description: job.description,
      redirect_url: job.redirect_url,
      publication_date: job.created,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      category: job.category,
      source: "Adzuna",
    }, "Adzuna")));
    if (jobs.length >= limit) break;
  }
  return jobs.slice(0, limit);
}

async function fetchJSearchJobs(searchQueries = [], limit = 12) {
  const rapidApiKey = process.env.RAPIDAPI_KEY || process.env.JSEARCH_API_KEY;
  if (!rapidApiKey) return [];

  const jobs = [];
  for (const { query, location } of searchQueries.slice(0, 3)) {
    const params = new URLSearchParams({
      query: [query, location].filter(Boolean).join(" in "),
      page: "1",
      num_pages: "1",
      date_posted: "month",
    });
    const payload = await fetchJsonWithTimeout(`https://jsearch.p.rapidapi.com/search?${params.toString()}`, {
      headers: {
        "X-RapidAPI-Key": rapidApiKey,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
    });
    jobs.push(...(payload.data || []).map((job) => normalizeExternalJob(job, "JSearch")));
    if (jobs.length >= limit) break;
  }
  return jobs.slice(0, limit);
}

async function searchLiveJobsForProfile(resumeProfile = {}, options = {}) {
  const queries = buildJobSearchQueries(resumeProfile, options);
  const limit = Number(options.limit || 30);
  const providerJobs = await Promise.allSettled([
    fetchAdzunaJobs(queries, Math.min(limit, 30)),
    fetchJSearchJobs(queries, Math.min(limit, 30)),
  ]);

  const jobs = providerJobs
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((job) => job.title && (job.applyUrl || job.source));

  return jobs
    .filter((job) => isIndiaRelevantJob(job, options.preferredLocation))
    .filter((job) => isFresherFriendlyJob(job, resumeProfile))
    .filter(
      (job, index, array) =>
      array.findIndex((candidate) =>
        `${candidate.title}-${candidate.company}-${candidate.location}`.toLowerCase() ===
        `${job.title}-${job.company}-${job.location}`.toLowerCase()
      ) === index
    )
    .slice(0, limit * 3);
}

function parseSalaryFloor(salary = "") {
  const text = String(salary || "");
  const lakh = text.match(/₹?\s*(\d+(?:\.\d+)?)\s*l/i);
  if (lakh) return Number(lakh[1]);
  const k = text.match(/(\d{2,3})\s*k/i);
  if (k) return Number(k[1]) / 10;
  return 0;
}

function calculateRoleAlignment(jobRole = "", rankedRoles = []) {
  const normalizedJobRole = normalizeRoleLabel(jobRole);
  const exact = rankedRoles.find((entry) => entry.role === normalizedJobRole);
  if (exact) return exact.score / 100;

  const jobProfile = getRoleProfile(normalizedJobRole);
  if (!jobProfile) return 0.35;

  const relatedScore = rankedRoles.reduce((best, entry) => {
    const profile = getRoleProfile(entry.role);
    if (!profile) return best;
    const shared = getMatchingSkills(jobProfile.skills, profile.skills).length;
    const overlap = shared / Math.max(jobProfile.skills.length, 1);
    return Math.max(best, overlap * (entry.score / 100));
  }, 0);

  return Math.max(0.35, relatedScore);
}

function calculateEvidenceScore(jobRole = "", resumeProfile = {}) {
  const profile = getRoleProfile(jobRole);
  if (!profile) return 0.45;
  const signalHits = profile.signals.filter((token) => resumeProfile.lowerText.includes(token)).length;
  const skillHits = profile.skills.filter((skill) => resumeProfile.resumeSkills.includes(canonicalizeSkill(skill))).length;
  const projectHits = profile.signals.filter((token) => (resumeProfile.domainEvidenceText || "").includes(token)).length;
  const sectionBonus = (resumeProfile.sectionsPresent?.projects ? 0.08 : 0) + (resumeProfile.sectionsPresent?.experience ? 0.06 : 0);
  return clamp((signalHits * 0.11) + (skillHits * 0.14) + (projectHits * 0.07) + 0.18 + sectionBonus, 0.2, 1);
}

function estimateExpectedExperience(jobRole = "") {
  const role = normalizeRoleLabel(jobRole);
  if (role === "ML Engineer" || role === "DevOps Engineer" || role === "Data Engineer") {
    return { min: 2, max: 6 };
  }
  if (role === "Product Analyst" || role === "Full Stack Engineer") {
    return { min: 1, max: 5 };
  }
  if (role === "Backend Engineer" || role === "Frontend Engineer" || role === "Data Analyst") {
    return { min: 0, max: 4 };
  }
  return { min: 0, max: 5 };
}

function calculateExperienceAlignment(jobRole = "", resumeProfile = {}) {
  const years = Number(resumeProfile.experienceYears || 0);
  if (!years) return 0.58;
  const band = estimateExpectedExperience(jobRole);
  if (years >= band.min && years <= band.max) return 1;
  if (years < band.min) return clamp(1 - ((band.min - years) * 0.18), 0.35, 1);
  return clamp(1 - ((years - band.max) * 0.08), 0.5, 1);
}

function calculateRolePriority(jobRole = "", resumeProfile = {}) {
  const normalizedRole = normalizeRoleLabel(jobRole);
  const rankedRoles = resumeProfile.rankedRoles || [];
  const primary = rankedRoles[0]?.role;
  const secondary = (resumeProfile.secondaryRoles || []);
  if (normalizedRole === primary) return 1;
  if (secondary.includes(normalizedRole)) return 0.82;
  const profile = getRoleProfile(normalizedRole);
  const primaryProfile = getRoleProfile(primary);
  if (!profile || !primaryProfile) return 0.45;
  const shared = getMatchingSkills(profile.skills, primaryProfile.skills).length;
  return clamp((shared / Math.max(profile.skills.length, 1)) * 0.75, 0.35, 0.75);
}

function scoreJobForResume(job, resumeProfile, { preferredLocation = "Any", minSalary = 0, experienceLevel = "Any", industry = "", explicitRole = "" } = {}) {
  const jobText = [job.title, job.role, job.description, ...(job.tags || []), ...(job.skills || [])]
    .filter(Boolean)
    .join(" ");
  const normalizedJobRole = normalizeRoleLabel(job.role || job.title || job.description || "");
  const roleProfile = getRoleProfile(normalizedJobRole);
  const extractedJobSkills = normalizeSkillList(keywordSkills(jobText));
  const roleSkills = roleProfile?.skills || [];
  const jobSkills = normalizeSkillList([...extractedJobSkills, ...roleSkills]);
  const matchedSkills = getMatchingSkills(jobSkills, resumeProfile.resumeSkills);
  const missingSkills = getMissingSkills(jobSkills, resumeProfile.resumeSkills);
  const roleAlignment = calculateRoleAlignment(normalizedJobRole, resumeProfile.rankedRoles);
  const evidenceScore = calculateEvidenceScore(normalizedJobRole, resumeProfile);
  const experienceAlignment = calculateExperienceAlignment(normalizedJobRole, resumeProfile);
  const rolePriority = calculateRolePriority(normalizedJobRole, resumeProfile);
  const titleSkills = normalizeSkillList(keywordSkills(`${job.title || ""} ${job.role || ""}`));
  const titleAlignment = titleSkills.length
    ? getMatchingSkills(titleSkills, resumeProfile.resumeSkills).length / Math.max(titleSkills.length, 1)
    : roleAlignment;
  const exactTitleBoost =
    (job.title || "").toLowerCase().includes((resumeProfile.inferredRole || "").toLowerCase().replace(" engineer", "")) ||
    (job.role || "").toLowerCase().includes((resumeProfile.inferredRole || "").toLowerCase().replace(" engineer", ""))
      ? 0.08
      : 0;
  const skillsCoverage = jobSkills.length
    ? matchedSkills.length / Math.max(jobSkills.length, 1)
    : Math.min(1, roleAlignment + 0.1);
  const projectSkills = normalizeSkillList(keywordSkills((resumeProfile.parsedDetails?.projects || []).join(" ")));
  const projectRelevance = jobSkills.length
    ? getMatchingSkills(jobSkills, projectSkills).length / Math.max(jobSkills.length, 1)
    : (resumeProfile.projectCount ? 0.45 : 0);
  const educationMatch = (resumeProfile.education || []).length ? 1 : 0.4;
  const locationMatch = calculateLocationMatch(job, preferredLocation);
  const keywordDensity = matchedSkills.length / Math.max(new Set([...jobSkills, ...resumeProfile.resumeSkills]).size, 1);
  const locationBoost =
    preferredLocation && preferredLocation !== "Any"
      ? (job.location || "").toLowerCase().includes(preferredLocation.toLowerCase()) || /(remote|hybrid)/i.test(job.location || "")
        ? 0.05
        : -0.03
      : 0;
  const salaryBoost = minSalary && parseSalaryFloor(job.salary) >= minSalary ? 0.04 : 0;
  const shortagePenalty = missingSkills.length >= Math.max(5, Math.ceil(jobSkills.length * 0.65)) ? 0.08 : 0;
  const weakRolePenalty = rolePriority < 0.5 ? 0.1 : 0;

  const experienceLevelMatch = experienceLevel && experienceLevel !== "Any"
    ? /(intern|entry|mid|senior|lead|manager)/i.test(experienceLevel)
      ? ((job.title || "") + " " + (job.description || "")).toLowerCase().includes(experienceLevel.toLowerCase())
        ? 0.04
        : -0.01
      : 0
    : 0;

  const industryMatch = industry
    ? ((job.description || "") + " " + (job.tags || []).join(" ") + " " + (job.source || "")).toLowerCase().includes(industry.toLowerCase())
      ? 0.05
      : -0.02
    : 0;

  const weightedScore = clamp(
    (skillsCoverage * 0.4) +
      (projectRelevance * 0.2) +
      (educationMatch * 0.1) +
      (experienceAlignment * 0.2) +
      (locationMatch * 0.1),
    0,
    1
  );
  const recruiterQualityGate =
    rolePriority >= 0.6 &&
    locationMatch > 0 &&
    skillsCoverage >= 0.18 &&
    isFresherFriendlyJob(job, resumeProfile);

  return {
    job,
    jobRole: normalizedJobRole,
    score: Number(weightedScore.toFixed(3)),
    targetRole: explicitRole,
    experienceLevel,
    industry,
    finalScore: recruiterQualityGate
      ? Number(clamp(weightedScore + salaryBoost + experienceLevelMatch + industryMatch - shortagePenalty - weakRolePenalty + Math.min(exactTitleBoost, 0.03), 0, 1).toFixed(3))
      : 0,
    matchedSkills,
    missingSkills,
    jobSkills,
    scoreBreakdown: {
      skill_match: Math.round(skillsCoverage * 100),
      project_relevance: Math.round(projectRelevance * 100),
      education_match: Math.round(educationMatch * 100),
      experience_match: Math.round(experienceAlignment * 100),
      location_match: Math.round(locationMatch * 100),
    },
    relevantProjects: (resumeProfile.parsedDetails?.projects || [])
      .filter((project) => getMatchingSkills(jobSkills, normalizeSkillList(keywordSkills(project))).length)
      .slice(0, 3),
    recruiterQualityGate,
    roleAlignment,
    industryAlignment: industry ? ((job.description || "") + " " + (job.tags || []).join(" ")).toLowerCase().includes(industry.toLowerCase()) : false,
    titleAlignment,
    experienceAlignment,
    rolePriority,
  };
}

function selectDiverseTopResults(items = [], limit = 10) {
  const pool = [...items];
  const selected = [];
  const roleCounts = new Map();

  while (pool.length && selected.length < limit) {
    let bestIndex = 0;
    let bestAdjusted = -1;

    for (let index = 0; index < pool.length; index += 1) {
      const item = pool[index];
      const count = roleCounts.get(item.jobRole) || 0;
      const penalty = count >= 2 ? 0.05 * count : 0;
      const adjusted = (item.finalScore ?? item.score ?? 0) - penalty + ((item.rolePriority || 0) * 0.03);
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIndex = index;
      }
    }

    const chosen = pool.splice(bestIndex, 1)[0];
    roleCounts.set(chosen.jobRole, (roleCounts.get(chosen.jobRole) || 0) + 1);
    selected.push(chosen);
  }

  return selected;
}

function rankByKeywords(resumeSkills, jobs, resumeText = "", explicitRole = "") {
  const resumeProfile = buildResumeProfile(resumeText || resumeSkills.join(" "), explicitRole);
  return jobs
    .map((job) => scoreJobForResume(job, { ...resumeProfile, resumeSkills: normalizeSkillList(resumeSkills) }, {}))
    .filter((item) => {
      const score = item.finalScore ?? item.score ?? 0;
      return item.recruiterQualityGate && score >= 0.62;
    })
    .sort((a, b) => (b.finalScore ?? b.score) - (a.finalScore ?? a.score));
}

// --- Routes ---
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/analyze", upload.single("file"), async (req, res) => {
  try {
    const jobDescription = req.body.job_description || "";
    if (!req.file) {
      return res.status(400).json({ message: "No resume file uploaded" });
    }
    let text = "";
    try {
      text = await extractTextFromPdf(req.file.buffer);
    } catch (e) {
      console.error("Parse failed, proceeding with empty text", e.message);
      text = "";
    }
    const resumeSkills = normalizeSkillList(keywordSkills(text || jobDescription));
    let jobSkills = normalizeSkillList(keywordSkills(jobDescription || text.slice(0, 1500)));
    let similarity = 0.6;
    let coverage = 0;
    let ats = 65;
    let missing = getMissingSkills(jobSkills, resumeSkills);
    const fallbackMissing = getMissingSkills(CANON, resumeSkills).slice(0, 5);
    const parsed = parseResumeDetails(text);
    const sectionsPresent = analyzeResumeSections(text);
    const keywordDensity = buildKeywordDensity(text, Array.from(new Set([...resumeSkills, ...jobSkills])));
    const bulletLines = String(text || "").split(/\r?\n/).filter((line) => /^[-*•]/.test(line.trim())).length;
    const metricCount = (String(text || "").match(/\b\d+(?:\.\d+)?%|\b\d+(?:,\d+)?(?:\+)?\b|\$\d+(?:,\d+)?/g) || []).length;
    const formatting = buildFormattingInsights(text, sectionsPresent);
    const atsCompatibility = buildAtsCompatibility(text, sectionsPresent);
    const readability = buildReadabilityInsights(text);
    if (!jobSkills.length) {
      jobSkills = [...resumeSkills.slice(0, 5), ...fallbackMissing].filter((v, i, a) => a.indexOf(v) === i);
      missing = fallbackMissing;
    }

    const buildFallback = () => {
      const missingF = getMissingSkills(jobSkills, resumeSkills);
      const extraF = getExtraSkills(resumeSkills, jobSkills);
      const keywordCoverage = jobSkills.length ? (jobSkills.length - missingF.length) / jobSkills.length : 0.55;
      const inferredRole = inferRoleFromText(`${text}\n${jobDescription}`);
      const keywordScore = Math.round(clamp(42 + keywordCoverage * 42 + Math.min(keywordDensity.length, 8) * 2));
      const structureScore = Math.round(
        clamp(
          30 +
            (sectionsPresent.summary ? 12 : 0) +
            (sectionsPresent.experience ? 20 : 0) +
            (sectionsPresent.education ? 14 : 0) +
            (sectionsPresent.skills ? 14 : 0) +
            (sectionsPresent.projects ? 10 : 0)
        )
      );
      const impactScore = Math.round(clamp(40 + Math.min(metricCount, 8) * 6 + Math.min(bulletLines, 6) * 2));
      const finalScore = Math.round(
        clamp(keywordScore * 0.35 + structureScore * 0.25 + impactScore * 0.2 + formatting.score * 0.1 + atsCompatibility.score * 0.1)
      );
      const improvements = buildImprovementSuggestions({
        sectionsPresent,
        missingSkills: missingF,
        metricCount,
        bulletLines,
        jobSkills,
      });
      const atsChecks = buildAtsChecks({
        sectionsPresent,
        keywordCoverage,
        metricCount,
        bulletLines,
        text,
        missingSkills: missingF,
      });
      const keywordTargeting = buildKeywordTargeting({
        resumeSkills,
        jobSkills,
        keywordDensity,
        missingSkills: missingF,
      });
      const heatmap = [
        { section: "Summary", score: sectionsPresent.summary ? 82 : 38, status: sectionsPresent.summary ? "strong" : "weak" },
        { section: "Experience", score: sectionsPresent.experience ? clamp(60 + metricCount * 4) : 35, status: sectionsPresent.experience ? (metricCount >= 3 ? "strong" : "moderate") : "weak" },
        { section: "Education", score: sectionsPresent.education ? 84 : 42, status: sectionsPresent.education ? "strong" : "weak" },
        { section: "Skills", score: sectionsPresent.skills ? clamp(55 + resumeSkills.length * 4) : 40, status: sectionsPresent.skills ? "strong" : "weak" },
        { section: "Projects", score: sectionsPresent.projects ? clamp(54 + bulletLines * 5) : 36, status: sectionsPresent.projects ? "moderate" : "weak" },
      ];
      return {
        parsed,
        skills: resumeSkills,
        job_skills: jobSkills,
        missing_skills: missingF,
        extra_skills: extraF,
        match_rate: Number(keywordCoverage.toFixed(3)),
        scores: {
          similarity: Number(keywordCoverage.toFixed(3)),
          coverage: Number(keywordCoverage.toFixed(3)),
          final: finalScore,
          sub: { impact: impactScore, structure: structureScore, keywords: keywordScore, formatting: formatting.score },
          keyword_density: keywordDensity,
          priority_keywords: missingF.slice(0, 5),
        },
        sections: sectionsPresent,
        keywordStats: {
          missing: missingF.length ? missingF : fallbackMissing,
          lowFreq: keywordDensity.filter((item) => item.freq <= 1).map((item) => item.keyword).slice(0, 5),
          suggested: missingF.length ? missingF.slice(0, 5) : fallbackMissing,
        },
        readability,
        heatmap,
        bulletPoints: buildBulletSuggestions(text, missingF),
        formatting,
        atsCompatibility,
        improvements,
        atsChecks,
        keywordTargeting,
        summarySuggestions: buildSummarySuggestions({ inferredRole, topSkills: resumeSkills, missingSkills: missingF }),
        actionVerbs: buildActionVerbSuggestions(resumeSkills),
        metricsGuide: buildMetricsSuggestions(metricCount),
        ai_summary: buildAutoSummary({
          skills: resumeSkills,
          missing: missingF,
          score: finalScore,
          metricCount,
          sectionsPresent,
          jobSkills,
          keywordCoverage: coverage,
          inferredRole,
        }),
        feedback:
          "• Add measurable achievements in your top role.\n• Include missing JD keywords.\n• Ensure sections: Summary, Experience, Projects, Skills.\n• Keep bullets concise (1 line) with impact.\n• Add tools/tech under each project.",
      };
    };

    const notifyAnalysis = async (payload) => {
      await appendDashboardNotification(req, {
        type: "resume",
        priority: (payload?.scores?.final || 0) >= 80 ? "medium" : "high",
        title: `Resume analysis completed${jobDescription ? " for target job" : ""}`,
        message:
          `ATS score ${Math.round(payload?.scores?.final || 0)}.` +
          ` Top missing skills: ${(payload?.missing_skills || []).slice(0, 3).join(", ") || "none"}.`,
        cta: "Open Resume Feedback",
      });
    };

    // If OpenAI key missing OR text too short, return heuristic stub
    if (!openai || (text && text.trim().length < 10)) {
      const fallbackPayload = buildFallback();
      await notifyAnalysis(fallbackPayload);
      return res.json(fallbackPayload);
    }

    try {
      // Embedding-based when key is present
      const embResume = await embedText(text);
      const embJob = jobDescription ? await embedText(jobDescription) : embResume;
      similarity = cosine(embResume, embJob);
      coverage = jobSkills.length
        ? getMatchingSkills(jobSkills, resumeSkills).length / jobSkills.length
        : 0;
      const keywordScore = Math.round(clamp(40 + coverage * 48 + Math.min(keywordDensity.length, 10) * 1.5));
      const structureScore = Math.round(
        clamp(
          30 +
            (sectionsPresent.summary ? 12 : 0) +
            (sectionsPresent.experience ? 20 : 0) +
            (sectionsPresent.education ? 14 : 0) +
            (sectionsPresent.skills ? 14 : 0) +
            (sectionsPresent.projects ? 10 : 0)
        )
      );
      const impactScore = Math.round(clamp(42 + Math.min(metricCount, 8) * 6 + Math.min(bulletLines, 6) * 2));
      ats = Math.round(
        clamp(
          similarity * 28 +
            coverage * 32 +
            keywordScore * 0.16 +
            structureScore * 0.12 +
            impactScore * 0.07 +
            formatting.score * 0.03 +
            atsCompatibility.score * 0.02
        )
      );
      missing = getMissingSkills(jobSkills, resumeSkills);
      let extra = getExtraSkills(resumeSkills, jobSkills);
      let priorityKeywords = missing.slice(0, 5);
      const inferredRole = inferRoleFromText(`${text}\n${jobDescription}`);
      if (!missing.length) {
        const missingCanon = getMissingSkills(CANON, resumeSkills).slice(0, 5);
        missing = missingCanon;
        priorityKeywords = missingCanon;
      }
      const subScores = {
        impact: impactScore,
        structure: structureScore,
        keywords: keywordScore,
        formatting: formatting.score,
      };
      const keywordStats = {
        missing: missing.length ? missing : priorityKeywords,
        lowFreq: keywordDensity.filter((item) => normalizeSkillList(jobSkills).includes(canonicalizeSkill(item.keyword)) && item.freq <= 1).map((item) => item.keyword).slice(0, 5),
        suggested: priorityKeywords.length ? priorityKeywords : missing,
      };
      const heatmap = [
        { section: "Summary", score: sectionsPresent.summary ? 82 : 38, status: sectionsPresent.summary ? "strong" : "weak" },
        { section: "Experience", score: sectionsPresent.experience ? clamp(60 + metricCount * 4) : 35, status: sectionsPresent.experience ? (metricCount >= 3 ? "strong" : "moderate") : "weak" },
        { section: "Education", score: sectionsPresent.education ? 84 : 42, status: sectionsPresent.education ? "strong" : "weak" },
        { section: "Skills", score: sectionsPresent.skills ? clamp(55 + resumeSkills.length * 4) : 40, status: sectionsPresent.skills ? "strong" : "weak" },
        { section: "Projects", score: sectionsPresent.projects ? clamp(54 + bulletLines * 5) : 36, status: sectionsPresent.projects ? "moderate" : "weak" },
      ];
      const improvements = buildImprovementSuggestions({
        sectionsPresent,
        missingSkills: missing,
        metricCount,
        bulletLines,
        jobSkills,
      });
      const atsChecks = buildAtsChecks({
        sectionsPresent,
        keywordCoverage: coverage,
        metricCount,
        bulletLines,
        text,
        missingSkills: missing,
      });
      const keywordTargeting = buildKeywordTargeting({
        resumeSkills,
        jobSkills,
        keywordDensity,
        missingSkills: missing,
      });
      let feedbackText =
        "• Add measurable achievements in top bullets.\n• Include missing keywords and tools.\n• Keep bullets concise with action + metric + outcome.\n• Ensure sections are ordered: Summary, Experience, Projects, Skills, Education.\n• Add 2 project metrics relevant to the JD.";
      try {
        const feedback = await openai.chat.completions.create({
          model: process.env.LLM_MODEL || "gpt-4o",
          messages: [
            { role: "system", content: "You are an ATS and hiring expert. Be concise." },
            {
              role: "user",
              content: `Job: ${jobDescription}\nResume: ${text.slice(
                0,
                4000
              )}\nMissing: ${missing.join(", ") || "None"}\nGive 5 bullet improvements under 120 words.`,
            },
          ],
          temperature: 0.5,
        });
        feedbackText = feedback.choices[0].message.content;
      } catch (e) {
        console.error("Feedback generation failed, using fallback", e.message);
      }
      const responsePayload = {
        parsed,
        skills: resumeSkills,
        job_skills: jobSkills,
        missing_skills: missing,
        extra_skills: extra,
        match_rate: Number(similarity.toFixed(3)),
        scores: {
          similarity: Number(similarity.toFixed(3)),
          coverage: Number(coverage.toFixed(3)),
          final: ats,
          sub: subScores,
          keyword_density: keywordDensity,
          priority_keywords: priorityKeywords,
        },
        sections: sectionsPresent,
        keywordStats,
        readability,
        heatmap,
        bulletPoints: buildBulletSuggestions(text, missing),
        formatting,
        atsCompatibility,
        improvements,
        atsChecks,
        keywordTargeting,
        summarySuggestions: buildSummarySuggestions({ inferredRole, topSkills: resumeSkills, missingSkills: missing }),
        actionVerbs: buildActionVerbSuggestions(resumeSkills),
        metricsGuide: buildMetricsSuggestions(metricCount),
        ai_summary: buildAutoSummary({
          skills: resumeSkills,
          missing,
          score: ats,
          metricCount,
          sectionsPresent,
          jobSkills,
          keywordCoverage: coverage,
          inferredRole,
        }),
        feedback: feedbackText,
      };
      await notifyAnalysis(responsePayload);
      res.json(responsePayload);
    } catch (e) {
      console.error("Analyze failed, sending fallback", e.message);
      const fallbackPayload = buildFallback();
      await notifyAnalysis(fallbackPayload);
      return res.json(fallbackPayload);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Analyze failed", detail: err.message });
  }
});

app.post("/api/rewrite", upload.single("file"), async (req, res) => {
  try {
    const text = await extractTextFromPdf(req.file.buffer);
    const resp = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert resume writer." },
        {
          role: "user",
          content: `Rewrite this resume content in under 400 words, bullet style:\n${text.slice(
            0,
            6000
          )}`,
        },
      ],
      temperature: 0.5,
    });
    res.json({ rewritten: resp.choices[0].message.content });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Rewrite failed" });
  }
});

app.post("/api/cover-letter", upload.single("file"), async (req, res) => {
  try {
    const jd = req.body.job_description || "";
    const text = req.file ? await extractTextFromPdf(req.file.buffer) : "";
    const companyMatch =
      jd.match(/company\s*:\s*([^\n]+)/i)?.[1]?.trim() ||
      jd.match(/at\s+([A-Z][A-Za-z0-9&.\- ]{2,40})/)?.[1]?.trim() ||
      "";
    const fallback = buildHeuristicCoverLetter({
      resumeText: text,
      jobDescription: jd,
      companyName: companyMatch,
    });
    if (!openai) return res.json({ cover_letter: fallback });
    try {
      const resumeContext = buildResumeChatContext(text) || {};
      const matchedSkills = getMatchingSkills(
        normalizeSkillList(keywordSkills(jd)),
        normalizeSkillList(keywordSkills(text))
      );
      const missingSkills = getMissingSkills(
        normalizeSkillList(keywordSkills(jd)),
        normalizeSkillList(keywordSkills(text))
      );
      const resp = await openai.chat.completions.create({
        model: process.env.LLM_MODEL || "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You write concise, highly tailored cover letters. Every letter must clearly reflect the specific candidate profile and job context provided. Do not use generic praise, boilerplate paragraphs, or repeated template wording. Use only evidence that appears in the provided resume context. If the profile is thin, be honest but still professional. Keep it specific and natural.",
          },
          {
            role: "user",
            content: `Write one tailored cover letter in 220-260 words.

Company: ${companyMatch || "Not specified"}
Target role inferred from resume/job: ${inferRoleFromText(`${text}\n${jd}`)}
Matched skills: ${matchedSkills.join(", ") || "none clearly matched"}
Missing skills: ${missingSkills.join(", ") || "none obvious"}
Resume top skills: ${(resumeContext.topSkills || []).join(", ") || "none extracted"}
Resume experience highlights: ${(resumeContext.experienceHighlights || []).join(" | ") || "none extracted"}
Resume project highlights: ${(resumeContext.projectHighlights || []).join(" | ") || "none extracted"}
Resume metric count: ${resumeContext.metricCount || 0}

Job description:
${jd}

Resume:
${text.slice(0, 6000)}

Instructions:
- Make the letter feel unique to this candidate and this role.
- Mention 2-3 concrete resume signals if available.
- If metrics are not visible, do not invent them.
- Avoid bullet lists unless truly needed.
- Do not sound like a generic template used for every applicant.`,
          },
        ],
        temperature: 0.72,
      });
      res.json({ cover_letter: resp.choices[0].message.content });
    } catch (e) {
      console.error("Cover letter failed, using fallback", e.message);
      res.json({ cover_letter: fallback });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Cover letter failed" });
  }
});

app.post("/api/career-recommendation", upload.single("file"), async (req, res) => {
  try {
    const role = req.body.role || "";
    const company = req.body.company || "";
    const focus = req.body.focus || "";
    const experience = req.body.experience || "";
    const weeklyHours = req.body.weekly_hours || "";
    const jobDescription = req.body.job_description || "";
    const headlineContext = req.body.headline_context || "";

    let text = "";
    if (req.file?.buffer) {
      try {
        text = await extractTextFromPdf(req.file.buffer);
      } catch (parseError) {
        console.error("career recommendation pdf parse failed", parseError.message);
      }
    }

    const combinedContext = [text, headlineContext, jobDescription].filter(Boolean).join("\n\n");
    const inferredRole = inferRoleFromText(combinedContext, role);
    const resumeContext = buildResumeChatContext(text);
    const jobContext = buildJobDescriptionContext(jobDescription, resumeContext, role);
    const strengths = resumeContext?.topSkills?.slice(0, 5) || [];
    const matched = jobContext?.matchedSkills?.slice(0, 5) || [];
    const missing = jobContext?.missingSkills?.slice(0, 5) || [];
    const focusText = focus || "Career growth";
    const localFallback = [
      `Best-fit direction: ${inferredRole || role || "General technology roles"}`,
      strengths.length ? `Visible strengths: ${strengths.join(", ")}.` : "Visible strengths: your project and resume context need clearer skills evidence.",
      matched.length ? `Strong job-fit overlap: ${matched.join(", ")}.` : "Strong job-fit overlap: add a target job description for tighter role matching.",
      missing.length ? `Top gaps to close: ${missing.join(", ")}.` : "Top gaps to close: emphasize measurable impact, ownership, and role-specific keywords.",
      `Best next roles: ${(jobContext?.inferredRole || inferredRole) === "ML Engineer" ? "ML Engineer, AI Engineer, Applied ML Engineer" : (jobContext?.inferredRole || inferredRole) === "Data Analyst" ? "Data Analyst, Product Analyst, BI Analyst" : (jobContext?.inferredRole || inferredRole) === "Frontend" ? "Frontend Engineer, UI Engineer, Product Engineer" : "Software Engineer, Backend Engineer, Product Engineer"}.`,
      `Next 30 days: focus on ${focusText.toLowerCase()}, spend ${weeklyHours || "consistent"} hours weekly, sharpen proof around ${missing[0] || strengths[0] || "core skills"}, and tailor your story for ${company || "target companies"}.`,
    ].join("\n\n");

    if (!openai) {
      return res.json({ recommendations: localFallback });
    }

    const resp = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a premium career strategist. Give grounded, specific recommendations from the resume and target context. Avoid generic advice. Return clear markdown with short sections: Best-fit roles, Why these roles fit, Gaps to close, and Next 30 days.",
        },
        {
          role: "user",
          content: `Target role: ${role || inferredRole || "not specified"}
Experience level: ${experience || "not specified"}
Weekly learning hours: ${weeklyHours || "not specified"}
Current focus: ${focus || "not specified"}
Target company: ${company || "not specified"}

Resume context:
Detected role: ${resumeContext?.detectedRole || inferredRole || "unknown"}
Top skills: ${(resumeContext?.topSkills || []).join(", ") || "none detected"}
Project highlights: ${(resumeContext?.projectHighlights || []).join(" | ") || "none detected"}
Experience highlights: ${(resumeContext?.experienceHighlights || []).join(" | ") || "none detected"}
Metric count: ${resumeContext?.metricCount || 0}

Job context:
Inferred JD role: ${jobContext?.inferredRole || "n/a"}
Matched skills: ${matched.join(", ") || "none"}
Missing skills: ${missing.join(", ") || "none"}
Repeated JD keywords: ${(jobContext?.repeatedKeywords || []).join(", ") || "none"}

Additional positioning context:
${headlineContext || "n/a"}

Job description:
${jobDescription || "n/a"}

Resume text:
${text.slice(0, 7000) || "n/a"}

Give me:
1. 3 best-fit role titles in priority order
2. Why each role fits this profile specifically
3. The biggest gaps or doubts a recruiter may have
4. A practical 30-day improvement plan
5. A short positioning summary I can use in AI Studio`,
        },
      ],
      temperature: 0.55,
      max_tokens: 900,
    });
    res.json({ recommendations: (resp.choices[0].message.content || localFallback).trim() || localFallback });
  } catch (e) {
    console.error(e);
    res.json({ recommendations: "Career recommendation failed, so use a narrower target role, paste the job description, and upload the latest resume for a more grounded recommendation." });
  }
});

app.post("/api/keyword-optimize", upload.single("file"), async (req, res) => {
  try {
    const jd = req.body.job_description || "";
    const text = await extractTextFromPdf(req.file.buffer);
    const resp = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: "You optimize ATS keywords." },
        {
          role: "user",
          content: `List 15 keywords to add to resume to match the job. Resume:\n${text.slice(
            0,
            6000
          )}\nJob:\n${jd}`,
        },
      ],
      temperature: 0.4,
    });
    res.json({ keywords: resp.choices[0].message.content });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Keyword optimize failed" });
  }
});

app.post("/api/compare", upload.fields([{ name: "file_a" }, { name: "file_b" }]), async (req, res) => {
  try {
    const textA = await extractTextFromPdf(req.files["file_a"][0].buffer);
    const textB = await extractTextFromPdf(req.files["file_b"][0].buffer);
    const embA = await embedText(textA);
    const embB = await embedText(textB);
    const sim = cosine(embA, embB);
    const skillsA = keywordSkills(textA);
    const skillsB = keywordSkills(textB);
    const sharedSkills = getMatchingSkills(skillsA, skillsB);
    const uniqueSkills = new Set([...skillsA, ...skillsB]).size;
    res.json({
      similarity: Number(sim.toFixed(3)),
      shared_skills: sharedSkills,
      overlap_score: uniqueSkills ? Number((sharedSkills.length / uniqueSkills).toFixed(3)) : 0,
      skills_only_a: getExtraSkills(skillsA, skillsB),
      skills_only_b: getExtraSkills(skillsB, skillsA),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Compare failed" });
  }
});

app.post("/api/jobs", async (req, res) => {
  try {
    const body = req.body || {};
    if (!Array.isArray(body)) {
      // Fetch jobs based on role and location
      const { role, location } = body;
      const query = {};
      if (role) query.role = new RegExp(role, 'i');
      if (location) query.location = new RegExp(location, 'i');
      try {
        const jobs = await Job.find(query).limit(20).sort({ postedAt: -1 });
        if (jobs.length === 0) {
          return res.json({ jobs: [], message: "No relevant jobs found" });
        }
        return res.json({ jobs });
      } catch (dbError) {
        console.error("DB error while fetching jobs:", dbError.message);
        return res.json({ jobs: [], message: "No relevant jobs found" });
      }
    }
    // Insert jobs
    const jobs = body;
    if (!Array.isArray(jobs) || !jobs.length) {
      return res.status(400).json({ message: "jobs array required" });
    }
    const toInsert = [];
    for (const job of jobs) {
      const baseText = `${job.title || ""} ${job.company || ""} ${job.location || ""} ${job.description || ""}`;
      const emb =
        openai && baseText.trim().length
          ? await embedText(baseText)
          : job.embedding && Array.isArray(job.embedding)
          ? job.embedding
          : [];
      toInsert.push({
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        role: job.role,
        description: job.description,
        source: job.source || "ingest",
        postedAt: job.postedAt ? new Date(job.postedAt) : new Date(),
        tags: job.tags || [],
        embedding: emb,
      });
    }
    await Job.insertMany(toInsert);
    res.json({ added: toInsert.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Operation failed" });
  }
});

// Demo seeding is disabled for job matching; ingest real listings through /api/jobs.
app.post("/api/jobs/seed", async (_req, res) => {
  res.status(410).json({ message: "Demo job seeding is disabled. Ingest real India job listings through /api/jobs." });
});

app.post("/api/match", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No resume file uploaded" });
    }

    let text = "";
    try {
      text = await extractTextFromPdf(req.file.buffer);
    } catch (err) {
      console.error("PDF parse failed, continuing with empty text", err.message);
      text = "";
    }

    const explicitRole = req.body.target_role || req.body.role || "";
    const resumeProfile = buildResumeProfile(text, explicitRole);
    const resumeSkills = resumeProfile.resumeSkills;
    const platform = req.body.platform || "All";
    const jobDescription = req.body.job_description || "";
    const inferredRole = inferRoleFromText(`${text}\n${jobDescription}`, explicitRole) || resumeProfile.inferredRole;
    const preferredLocation = req.body.location || "Any";
    const experienceLevel = req.body.experience_level || "Any";
    const industry = req.body.industry || "";
    const requestedLimit = Math.max(10, Math.min(Number(req.body.k || req.body.limit || 30), 50));
    const platformSearchLinks = buildPlatformSearches(inferredRole, preferredLocation, resumeSkills);
    let liveJobs = [];
    try {
      liveJobs = await searchLiveJobsForProfile(resumeProfile, { preferredLocation, explicitRole, limit: requestedLimit });
    } catch (error) {
      console.warn("Live job search failed; continuing with configured/stored jobs only.", error.message);
      liveJobs = [];
    }
    const jobs = [
      ...liveJobs.filter((job) => platform === "All" || job.source === platform),
    ].filter(
      (job, index, array) =>
        array.findIndex(
          (candidate) =>
            `${candidate.title}-${candidate.company}-${candidate.source}` ===
            `${job.title}-${job.company}-${job.source}`
        ) === index
    );

    if (!jobs.length) {
      return res.json({
        inferred_role: inferredRole,
        search_links: platformSearchLinks,
        detected_skills: resumeSkills,
        candidate_profile: {
          skills: resumeProfile.resumeSkills,
          technical_stack: resumeProfile.technicalStack,
          projects: resumeProfile.parsedDetails.projects,
          experience: resumeProfile.parsedDetails.experience,
          education: resumeProfile.education,
          certifications: resumeProfile.certifications,
          job_titles: resumeProfile.jobTitles,
          domain_expertise: resumeProfile.domainExpertise,
          location_preferences: resumeProfile.locationPreferences,
          years_of_experience: resumeProfile.experienceYears,
        },
        provider_status: "No relevant jobs found",
        results: [],
      });
    }

    const minSalary = Number(req.body.minSalary || 0);

    const enrich = (scoredJob) => {
      const {
        job,
        score,
        finalScore,
        matchedSkills,
        missingSkills,
        jobSkills,
        jobRole,
        roleAlignment,
        evidenceScore,
        titleAlignment,
        experienceAlignment,
        rolePriority,
      } = scoredJob;
      const trend = getMissingSkills(CANON.filter((s) => jobSkills.includes(s)), resumeSkills).slice(0, 5);
      const simplePoints = (job.description || "")
        .split(/[.;\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
      const baseSkills = resumeSkills.length ? matchedSkills : jobSkills.slice(0, 3);
      return {
        job_id: job._id,
        title: job.title,
        company: job.company,
        source: job.source || "Live job provider",
        apply_url: job.applyUrl || buildApplyUrl(job),
        score: Number((score || 0).toFixed(3)),
        match_percentage: Math.round((finalScore || score || 0) * 100),
        matched_skills: baseSkills,
        missing_skills: missingSkills,
        relevant_projects: scoredJob.relevantProjects || [],
        match_breakdown: scoredJob.scoreBreakdown || {},
        why_recommended: baseSkills.length
          ? `Recommended because your resume shows ${baseSkills.slice(0, 4).join(", ")} and relevant project or experience evidence for this ${jobRole || inferredRole || "role"}.`
          : `Recommended because the listing aligns with your inferred ${inferredRole || "career"} direction and India-first search filters.`,
        career_growth_potential: (finalScore || score || 0) >= 0.78 ? "Strong growth fit for your current path" : "Good fit if you close the listed gaps",
        keyword_gap: missingSkills.slice(0, 5),
        company_fit: Math.round((0.35 + 0.65 * (matchedSkills.length / Math.max(jobSkills.length || 1, 1))) * 100) / 100,
        location: job.location || "Remote / Flexible",
        salary: job.salary || "Competitive",
        role: jobRole || job.role || inferredRole || "General",
        experience_required: estimateExpectedExperience(jobRole || job.role || inferredRole || "").min
          ? `${estimateExpectedExperience(jobRole || job.role || inferredRole || "").min}-${estimateExpectedExperience(jobRole || job.role || inferredRole || "").max} years`
          : "Entry to mid level",
        posted_at: job.postedAt || null,
        jd_simplified: simplePoints.length ? simplePoints : jobSkills.slice(0, 5),
        trend_suggestions: trend,
        why_this_job: [
          baseSkills.length ? `Matched skills include ${baseSkills.slice(0, 5).join(", ")}.` : "This job matches your strongest detected role direction.",
          scoredJob.relevantProjects?.length ? `Relevant projects: ${scoredJob.relevantProjects.slice(0, 2).join(", ")}.` : `Project relevance score is ${scoredJob.scoreBreakdown?.project_relevance || 0}%.`,
          `Weighted score: skills ${scoredJob.scoreBreakdown?.skill_match || 0}%, projects ${scoredJob.scoreBreakdown?.project_relevance || 0}%, education ${scoredJob.scoreBreakdown?.education_match || 0}%, experience ${scoredJob.scoreBreakdown?.experience_match || 0}%, location ${scoredJob.scoreBreakdown?.location_match || 0}%.`,
          missingSkills.length ? `Main gaps to close: ${missingSkills.slice(0, 2).join(", ")}.` : "You already cover most core requirements in this listing.",
        ],
        auto_apply: {
          summary: `Tailor resume for ${job.title}: highlight ${matchedSkills.slice(0, 3).join(", ") || "role keywords"}, add metrics, and mirror JD phrasing.`,
        },
        title_alignment: Number(titleAlignment.toFixed(3)),
        rerank_score: Number((finalScore || score || 0).toFixed(3)),
      };
    };

    const keywordFallback = () => {
      const ranked = rankByKeywords(resumeSkills, jobs, text, explicitRole)
        .map((item) => scoreJobForResume(item.job, resumeProfile, { preferredLocation, minSalary, experienceLevel, industry }))
        .sort((a, b) => (b.finalScore ?? b.score) - (a.finalScore ?? a.score));
      const selected = selectDiverseTopResults(ranked, requestedLimit);
      return res.json({
        inferred_role: inferredRole,
        search_links: platformSearchLinks,
        detected_skills: resumeSkills,
        candidate_profile: {
          skills: resumeProfile.resumeSkills,
          technical_stack: resumeProfile.technicalStack,
          projects: resumeProfile.parsedDetails.projects,
          experience: resumeProfile.parsedDetails.experience,
          education: resumeProfile.education,
          certifications: resumeProfile.certifications,
          job_titles: resumeProfile.jobTitles,
          domain_expertise: resumeProfile.domainExpertise,
          location_preferences: resumeProfile.locationPreferences,
          years_of_experience: resumeProfile.experienceYears,
        },
        provider_status: selected.length ? "Live India job results ranked against the uploaded resume." : "No relevant jobs found",
        results: selected.map((r) => enrich(r)),
      });
    };

    if (!openai || !text.trim()) {
      return keywordFallback();
    }

    try {
      const emb = await embedText(text || resumeSkills.join(" "));
      const heuristicRanked = jobs
        .map((job) => {
          const scored = scoreJobForResume(job, resumeProfile, { preferredLocation, minSalary, experienceLevel, industry });
          const embeddingScore = Array.isArray(job.embedding) && job.embedding.length ? cosine(emb, job.embedding) : null;
          const blendedScore =
            embeddingScore === null
              ? scored.finalScore
              : Number(clamp((scored.finalScore * 0.87) + (embeddingScore * 0.13), 0, 1).toFixed(3));
          return {
            ...scored,
            embeddingScore,
            finalScore: blendedScore,
          };
        })
        .filter((item) => {
          const score = item.finalScore ?? item.score ?? 0;
          return item.recruiterQualityGate && score >= 0.62;
        })
        .sort((a, b) => (b.finalScore ?? b.score) - (a.finalScore ?? a.score));

      const results = selectDiverseTopResults(heuristicRanked, requestedLimit).map((item) => enrich(item));

      if (!results.length) {
        return res.json({
          inferred_role: inferredRole,
          search_links: platformSearchLinks,
          detected_skills: resumeSkills,
          candidate_profile: {
            skills: resumeProfile.resumeSkills,
            technical_stack: resumeProfile.technicalStack,
            projects: resumeProfile.parsedDetails.projects,
            experience: resumeProfile.parsedDetails.experience,
            education: resumeProfile.education,
            certifications: resumeProfile.certifications,
            job_titles: resumeProfile.jobTitles,
            domain_expertise: resumeProfile.domainExpertise,
            location_preferences: resumeProfile.locationPreferences,
            years_of_experience: resumeProfile.experienceYears,
          },
          provider_status: "No relevant jobs found",
          results: [],
        });
      }

      res.json({
        inferred_role: inferredRole,
        search_links: platformSearchLinks,
        detected_skills: resumeSkills,
        candidate_profile: {
          skills: resumeProfile.resumeSkills,
          technical_stack: resumeProfile.technicalStack,
          projects: resumeProfile.parsedDetails.projects,
          experience: resumeProfile.parsedDetails.experience,
          education: resumeProfile.education,
          certifications: resumeProfile.certifications,
          job_titles: resumeProfile.jobTitles,
          domain_expertise: resumeProfile.domainExpertise,
          location_preferences: resumeProfile.locationPreferences,
          years_of_experience: resumeProfile.experienceYears,
        },
        provider_status: "Live India job results ranked against the uploaded resume.",
        results,
      });
    } catch (err) {
      console.error("Match embedding failed, using strict keyword scoring", err.message);
      return keywordFallback();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Match failed" });
  }
});

// Log feedback (save/apply/skip) for future model training
app.post("/api/match/feedback", async (req, res) => {
  try {
    const {
      jobId,
      action,
      score,
      user = "anon",
      filters = {},
      title = "",
      company = "",
      location = "",
      salary = "",
      source = "",
    } = req.body || {};
    if (!action) return res.status(400).json({ message: "action required" });
    const stableJobId =
      jobId ||
      [title || "job", company || "company", source || "source"]
        .join("-")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");

    await Feedback.create({
      jobId: stableJobId,
      action,
      score,
      user,
      filters,
      title,
      company,
      location,
      salary,
      source,
    });

    if (action === "apply" || action === "save" || action === "skip") {
      const titleText = title || "recommended role";
      const companyText = company || "career platform";
      const actionLabel =
        action === "apply" ? "applied to" : action === "save" ? "saved" : "skipped";

      await appendDashboardNotification(req, {
        type: "jobs",
        priority: action === "apply" ? "high" : "medium",
        title: `You ${actionLabel} ${titleText}`,
        message: `${companyText} · ${Math.round((score || 0) <= 1 ? (score || 0) * 100 : score || 0)}% fit match.`,
        cta: "Open Job Matcher",
      });
    }

    res.json({ status: "ok" });
  } catch (e) {
    console.error("Feedback log failed", e.message);
    res.status(500).json({ message: "Feedback log failed" });
  }
});

app.get("/api/match/feedback-summary", async (_req, res) => {
  try {
    const entries = await Feedback.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const uniqueJobIds = [
      ...new Set(
        entries
          .map((entry) => String(entry.jobId))
          .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
      ),
    ];
    const jobs = await Job.find(
      { _id: { $in: uniqueJobIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      { title: 1, company: 1, location: 1, salary: 1 }
    ).lean();

    const jobsById = new Map(jobs.map((job) => [String(job._id), job]));
    const recent = entries.map((entry) => {
      const job = jobsById.get(String(entry.jobId));
      return {
        id: String(entry._id),
        action: entry.action,
        score: entry.score || 0,
        createdAt: entry.createdAt,
        filters: entry.filters || {},
        title: entry.title || job?.title || "Recommended role",
        company: entry.company || job?.company || "Career platform",
        location: entry.location || job?.location || "Remote / Flexible",
        salary: entry.salary || job?.salary || "Competitive",
        source: entry.source || "Career platform",
      };
    });

    const totals = recent.reduce(
      (acc, entry) => {
        if (entry.action === "apply") acc.applied += 1;
        if (entry.action === "save") acc.saved += 1;
        if (entry.action === "skip") acc.skipped += 1;
        return acc;
      },
      { applied: 0, saved: 0, skipped: 0 }
    );

    res.json({ totals, recent });
  } catch (e) {
    console.error("Feedback summary failed", e.message);
    res.status(500).json({ message: "Feedback summary failed" });
  }
});

app.post("/api/interview/activity", async (req, res) => {
  try {
    const {
      type = "",
      role = "",
      company = "",
      detail = "",
      score = 0,
      answersCount = 0,
      user = "anon",
    } = req.body || {};

    if (!type) {
      return res.status(400).json({ message: "type is required" });
    }

    const entry = await InterviewActivity.create({
      type,
      role,
      company,
      detail,
      score,
      answersCount,
      user,
    });

    if (type === "evaluation" || type === "question_bank" || type === "mock_turn") {
      const roleLabel = role || "target role";
      const companyLabel = company && company !== "Any" ? ` at ${company}` : "";
      const title =
        type === "evaluation"
          ? `Interview answers evaluated for ${roleLabel}`
          : type === "question_bank"
            ? `Interview question bank ready for ${roleLabel}`
            : `Mock interview practice completed for ${roleLabel}`;
      const message =
        type === "evaluation"
          ? `Score: ${Math.round(score || 0)}${answersCount ? ` across ${answersCount} answer${answersCount > 1 ? "s" : ""}` : ""}.${companyLabel}`
          : type === "question_bank"
            ? `New role-specific practice questions generated${companyLabel}.`
            : `You completed another mock turn${companyLabel}. Keep the repetition going.`;

      await appendDashboardNotification(req, {
        type: "interview",
        priority: type === "evaluation" && Number(score || 0) < 70 ? "high" : "medium",
        title,
        message,
        cta: "Open Interview Prep",
        createdAt: entry.createdAt,
      });
    }

    res.json({ status: "ok", id: String(entry._id) });
  } catch (e) {
    console.error("Interview activity log failed", e.message);
    res.status(500).json({ message: "Interview activity log failed" });
  }
});

app.get("/api/interview/activity-summary", async (_req, res) => {
  try {
    const entries = await InterviewActivity.find({})
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const recent = entries.map((entry) => ({
      id: String(entry._id),
      type: entry.type || "mock_turn",
      role: entry.role || "General",
      company: entry.company || "",
      detail: entry.detail || "",
      score: entry.score || 0,
      answersCount: entry.answersCount || 0,
      createdAt: entry.createdAt,
    }));

    const totals = recent.reduce(
      (acc, entry) => {
        if (entry.type === "mock_turn") acc.mockTurns += 1;
        if (entry.type === "evaluation") acc.evaluations += 1;
        if (entry.type === "question_bank") acc.questionBanks += 1;
        return acc;
      },
      { mockTurns: 0, evaluations: 0, questionBanks: 0 }
    );

    const averageScore = totals.evaluations
      ? Math.round(
          recent
            .filter((entry) => entry.type === "evaluation")
            .reduce((sum, entry) => sum + (entry.score || 0), 0) / totals.evaluations
        )
      : 0;

    res.json({ totals, averageScore, recent });
  } catch (e) {
    console.error("Interview activity summary failed", e.message);
    res.status(500).json({ message: "Interview activity summary failed" });
  }
});

// --- Additional stubbed/aux routes to support page shells ---

// Quick analyze (lightweight preview)
app.post("/api/analyze/quick", upload.single("file"), async (req, res) => {
  try {
    const jd = req.body.job_description || "";
    const text = await extractTextFromPdf(req.file.buffer);
    const resumeSkills = normalizeSkillList(keywordSkills(text));
    const jobSkills = normalizeSkillList(keywordSkills(jd));
    const missing = getMissingSkills(jobSkills, resumeSkills);
    res.json({
      preview: true,
      ats_preview: 70,
      missing_skills: missing,
      sample: text.slice(0, 240),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Quick analyze failed" });
  }
});

// Fetch stored report (stub)
app.get("/api/report/:id", (_req, res) => {
  res.json({
    id: "demo-report",
    scores: { ats: 82, similarity: 0.78 },
    highlights: ["Added impact bullets", "Matched keywords"],
  });
});

// Feedback deep critique
app.post("/api/feedback", upload.single("file"), async (req, res) => {
  try {
    const text = await extractTextFromPdf(req.file.buffer);
    const readability = Math.max(0, Math.min(100, 65 + Math.random() * 15));
    const quality = Math.max(0, Math.min(100, 70 + Math.random() * 20));
    res.json({
      readability,
      quality,
      bullets: [
        "Lead with impact metrics in the first 2 bullets.",
        "Group cloud tools under a single Cloud section.",
      ],
      sample_rewrite: `• Reduced pipeline latency by 32% by batching S3 loads\n• Cut EC2 spend 18% via right-sizing`,
      original_excerpt: text.slice(0, 400),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Feedback failed" });
  }
});

// Feedback rewrite specific block (stub)
app.post("/api/feedback/rewrite", async (req, res) => {
  const { text = "", tone = "impactful", targetRole = "" } = req.body || {};
  
  if (!openai) {
    return res.json({
      rewritten: `• [Heuristic] ${text} (Add metrics and action verbs for ${targetRole || 'this role'})`,
    });
  }

  try {
    const resp = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert resume writer. Rewrite the provided bullet point to be more impactful, using the STAR method and action verbs. Keep it to one concise sentence." },
        {
          role: "user",
          content: `Tone: ${tone}\nTarget Role: ${targetRole}\nBullet: ${text}`,
        },
      ],
      temperature: 0.6,
    });

    res.json({
      rewritten: resp.choices[0].message.content.trim(),
      impact_score: 85, // Mocked impact improvement
    });
  } catch (e) {
    console.error("Inline rewrite failed", e.message);
    res.status(500).json({ message: "Rewrite failed" });
  }
});

app.get("/api/templates", (_req, res) => res.json(RESUME_TEMPLATES));
app.get("/api/examples", (_req, res) => res.json(RESUME_EXAMPLES));

app.post("/api/import/linkedin", async (req, res) => {
  res.json({
    status: "ok",
    profile: {
      name: "LinkedIn User",
      headline: "Senior Software Engineer at TechCorp",
      summary: "Passionate developer focused on scalability and AI systems.",
      experience: ["TechCorp - Senior Dev (2020-Present)", "WebSoft - Full Stack (2018-2020)"],
      skills: ["Node.js", "React", "AWS", "Python"],
    }
  });
});

app.post("/api/export/pdf", upload.single("file"), async (req, res) => {
  // Real implementation would use puppeteer or pdf-lib to render current HTML/JSON to PDF
  res.json({
    status: "ok",
    downloadUrl: "/temp/resume-export-" + Date.now() + ".pdf",
    shareableLink: "https://ai-resume.io/p/demo-user-123",
  });
});

// Skill gap report
app.post("/api/skill-gap", upload.single("file"), async (req, res) => {
  try {
    const jd = req.body.job_description || "";
    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" });
    }
    const resume = await extractTextFromPdf(req.file.buffer);
    const payload = buildSkillGapPayload(resume, jd);
    const ai_insights = await buildAiSkillGapInsights({
      payload,
      resumeText: resume,
      jobDescription: jd,
    });
    res.json({ ...payload, ai_insights });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Skill gap failed" });
  }
});

function parseAiJson(content) {
  const trimmed = String(content || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    }
    const firstBracket = raw.indexOf("[");
    const lastBracket = raw.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return JSON.parse(raw.slice(firstBracket, lastBracket + 1));
    }
    throw _error;
  }
}

function buildHeuristicInterviewEval(answers = []) {
  const metricRegex = /\d+%|\d+k|\d+\.?\d*\s?(ms|s|req|rpm|users|revenue|cost|latency|throughput)/i;
  const starRegex = /(situation|task|action|result)/i;
  const scored = answers.map((a, index) => {
    const text = String(a || "").trim();
    const hasMetric = metricRegex.test(text);
    const hasStar = starRegex.test(text);
    const base = 60 + (hasMetric ? 15 : 0) + (hasStar ? 10 : 0) + Math.random() * 10;
    const strengths = [];
    const improvements = [];
    if (hasMetric) strengths.push("You included measurable impact.");
    else improvements.push("Add one concrete metric such as %, $, ms, users, or throughput.");
    if (hasStar) strengths.push("Your answer shows STAR structure.");
    else improvements.push("Use STAR: situation, task, action, result.");
    if (text.length > 450) improvements.push("Trim the answer to under 200 words.");
    if (!strengths.length) strengths.push("Your answer is a workable starting point.");
    if (!improvements.length) improvements.push("Tighten verbs and lead with the result.");
    return {
      answer: text,
      score: Math.round(Math.min(base, 95)),
      summary: `Answer ${index + 1} is readable but still heuristic-scored.`,
      strengths,
      improvements,
      rewritten_answer: text ? `Structure it as: situation, action, result. Then add one metric and your exact contribution.` : "",
    };
  });
  const overall = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + item.score, 0) / scored.length)
    : 0;
  return {
    overall_score: overall,
    overall_feedback: "Heuristic fallback used because AI evaluation was unavailable.",
    strengths: ["Answer structure can be improved with STAR framing."],
    improvements: ["Add role-specific detail, one metric, and a clearer result."],
    evaluations: scored,
  };
}

// Interview evaluation AI
app.post("/api/interview/evaluate", async (req, res) => {
  const { answers = [], role = "", company = "", questions = [] } = req.body || {};

  if (!answers.length) {
    return res.status(400).json({ message: "answers array is required" });
  }

  if (!openai) {
    return res.json(buildHeuristicInterviewEval(answers));
  }

  try {
    const resp = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o",
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content:
            "You are an expert interview coach and hiring manager. Evaluate interview answers with practical, specific feedback. Return valid JSON only with this shape: {\"overall_score\": number, \"overall_feedback\": string, \"strengths\": string[], \"improvements\": string[], \"evaluations\": [{\"answer\": string, \"score\": number, \"summary\": string, \"strengths\": string[], \"improvements\": string[], \"rewritten_answer\": string}]} . Scores must be integers from 0 to 100. Keep feedback concise but insightful.",
        },
        {
          role: "user",
          content: JSON.stringify({
            role,
            company,
            questions,
            answers,
            instructions:
              "Evaluate each answer for clarity, relevance to the role, depth, structure, metrics, and impact. Make the feedback sound like a real AI coach, not a heuristic checklist.",
          }),
        },
      ],
    });

    const content = resp.choices[0].message.content;
    const parsed = parseAiJson(content);
    res.json({
      overall_score: parsed.overall_score ?? 0,
      overall_feedback: parsed.overall_feedback || "",
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      evaluations: Array.isArray(parsed.evaluations)
        ? parsed.evaluations.map((item, index) => ({
            answer: item.answer || answers[index] || "",
            score: Number.isFinite(Number(item.score)) ? Math.round(Number(item.score)) : 0,
            summary: item.summary || "",
            strengths: Array.isArray(item.strengths) ? item.strengths : [],
            improvements: Array.isArray(item.improvements) ? item.improvements : [],
            rewritten_answer: item.rewritten_answer || "",
          }))
        : buildHeuristicInterviewEval(answers).evaluations,
    });
  } catch (err) {
    console.error("Interview evaluation failed, using heuristic fallback", err.message);
    res.json(buildHeuristicInterviewEval(answers));
  }
});

// Role-specific question generator (LLM first, fallback by role)
app.post("/api/interview-questions", async (req, res) => {
  try {
    const jd = req.body.job_description || "";
    const role = (req.body.role || "").toLowerCase();
    const roleProfiles = {
      sde: {
        label: "SDE",
        focus: "APIs, system design, debugging, concurrency, performance, testing, reliability",
        behavioral: [
          "Tell me about a production issue you owned from detection to fix.",
          "Describe a time you improved a system while under a tight deadline.",
          "How do you handle conflicting priorities when multiple teams depend on you?",
          "Share an example of a failure and the engineering lesson you took from it.",
          "Tell me about a time you simplified a complicated technical solution.",
        ],
        technical: [
          "Design a rate limiter for a public API.",
          "How would you debug intermittent 500s in production?",
          "Explain how you would reduce latency in a service with hot endpoints.",
          "How do you design rollbacks and observability for CI/CD?",
          "What trade-offs would you make in a distributed cache design?",
        ],
      },
      "ml engineer": {
        label: "ML Engineer",
        focus: "feature engineering, model evaluation, drift, deployment, inference latency, data quality, MLOps",
        behavioral: [
          "Tell me about a model or ML pipeline you improved and what changed in the business outcome.",
          "Describe a time you had to explain a model limitation to a non-ML stakeholder.",
          "How do you balance research speed with production quality in ML work?",
          "Share an example of an experiment that failed and what you learned from it.",
          "Tell me about a time you worked through ambiguous data or labeling issues.",
        ],
        technical: [
          "How do you monitor model drift and data drift in production?",
          "Walk through your feature store or feature pipeline design.",
          "Explain a time you reduced inference latency without hurting quality.",
          "How do you choose between a classical model and a deep learning approach?",
          "Describe how you would evaluate an offline metric against online performance.",
        ],
      },
      "data analyst": {
        label: "Data Analyst",
        focus: "SQL, experimentation, dashboards, metric design, data quality, stakeholder communication",
        behavioral: [
          "Tell me about a dashboard or analysis that changed a business decision.",
          "Describe a time you found a data quality issue and how you handled it.",
          "How do you communicate uncertainty or caveats to stakeholders?",
          "Share an example of turning messy data into a clear recommendation.",
          "Tell me about a time you had to prioritize multiple analytics requests.",
        ],
        technical: [
          "How would you design an A/B test for a signup funnel?",
          "What SQL mistakes most often lead to wrong conclusions?",
          "How do you build a metric tree for retention or activation?",
          "How would you validate that a KPI dashboard is trustworthy?",
          "Describe how you would analyze a drop in conversion rate.",
        ],
      },
      "product manager": {
        label: "Product Manager",
        focus: "roadmaps, metrics, user needs, prioritization, cross-functional execution, trade-offs",
        behavioral: [
          "Tell me about a roadmap decision you made with incomplete data.",
          "Describe a time engineering pushed back on your product direction.",
          "How do you prioritize features when everything feels important?",
          "Share an example of a launch that did not go as planned.",
          "Tell me about a time you aligned stakeholders around a shared goal.",
        ],
        technical: [
          "How do you define success metrics for a new feature?",
          "Walk me through a PRD you wrote and how it changed after launch.",
          "How would you decide between shipping a feature and fixing tech debt?",
          "How do you use data to validate a product hypothesis?",
          "Describe how you would scope an MVP for a new user problem.",
        ],
      },
      devops: {
        label: "DevOps",
        focus: "CI/CD, observability, incident response, cloud cost, secrets, reliability, deployment safety",
        behavioral: [
          "Describe an incident you helped lead and what you changed afterward.",
          "Tell me about a time you reduced cloud cost without hurting reliability.",
          "How do you collaborate with developers during a high-pressure release?",
          "Share an example of improving an operational process.",
          "Tell me about a time you had to make a risky infrastructure decision.",
        ],
        technical: [
          "Design a blue/green deployment for a stateful service.",
          "How do you handle secrets management across environments?",
          "Explain your approach to SLOs and error budgets.",
          "How would you investigate a slow or failing deployment pipeline?",
          "Describe how you would make an alerting strategy less noisy and more useful.",
        ],
      },
      default: {
        label: "General",
        focus: "problem solving, collaboration, communication, learning, execution",
        behavioral: [
          "Tell me about a time you solved a hard problem.",
          "How do you collaborate across teams under pressure?",
          "Walk through a project end-to-end and explain your contribution.",
          "Give me an example of a failure and what you learned.",
          "How do you prepare for ambiguous requirements?",
        ],
        technical: [
          "Walk through the architecture of a recent system you built.",
          "Explain a performance issue you diagnosed and fixed.",
          "How would you secure an API handling sensitive data?",
          "Describe your approach to debugging an intermittent production issue.",
          "How do you think about trade-offs between speed and quality?",
        ],
      },
    };

    const profile =
      roleProfiles[role] ||
      roleProfiles[Object.keys(roleProfiles).find((k) => role && role.includes(k)) || "default"];

    const pickFallback = () => {
      return [
        "Behavioral:",
        ...profile.behavioral.map((q, i) => `${i + 1}. ${q}`),
        "",
        "Technical:",
        ...profile.technical.map((q, i) => `${i + 1}. ${q}`),
      ].join("\n");
    };

    if (!openai) {
      return res.json({ questions: pickFallback() });
    }

    try {
      const resp = await openai.chat.completions.create({
        model: process.env.LLM_MODEL || "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You generate concise interview questions that are clearly tailored to the requested role. Avoid generic questions and make the technical section role-specific.",
          },
          {
            role: "user",
            content: `Role: ${profile.label}\nFocus areas: ${profile.focus}\nCompany: ${req.body.company || "any"}\nJD:\n${jd}\n\nProduce exactly 5 behavioral and 5 technical questions. Keep them distinct for this role. Use numbered lists under the headings Behavioral and Technical. Do not reuse generic questions across unrelated roles.`,
          },
        ],
        temperature: 0.45,
      });
      res.json({ questions: resp.choices[0].message.content });
    } catch (err) {
      console.error("Interview questions failed, using fallback", err.message);
      res.json({ questions: pickFallback() });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Questions failed" });
  }
});

// Chat stub (fallback if main chat not used)
app.post("/api/chat/resume-context", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" });
    }
    const text = await extractTextFromPdf(req.file.buffer);
    const details = parseResumeDetails(text);
    const skills = keywordSkills(text);
    res.json({
      resume_text: text.slice(0, 12000),
      summary: {
        name: details.name,
        email: details.email,
        top_skills: skills.slice(0, 8),
        experience: details.experience,
        projects: details.projects,
        education: details.education,
      },
    });
  } catch (e) {
    console.error("Resume chat upload failed", e.message);
    res.status(500).json({ message: "Resume upload failed" });
  }
});

app.post("/api/chat/context-files", upload.array("files", 30), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ message: "At least one file is required" });
    }
    const summary = await summarizeContextFiles(files);
    res.json(summary);
  } catch (e) {
    console.error("Chat context upload failed", e.message);
    res.status(500).json({ message: "Context upload failed" });
  }
});

app.post("/api/chat", (req, res) => {
  const {
    messages = [],
    role = "",
    language = "English",
    mode = "resume",
    resumeText = "",
    jobDescription = "",
    extraContextText = "",
    temperature = null,
    explainSimple = false,
  } = req.body || {};
  const last = messages[messages.length - 1]?.content || "Help me improve my resume";
  const resumeContext = buildResumeChatContext(resumeText);
  const jobContext = buildJobDescriptionContext(jobDescription, resumeContext, role);
  const hasExtraContext = !!extraContextText.trim();
  const relevantSnippets = retrieveRelevantContext({
    question: last,
    resumeText,
    extraContextText,
  });
  const focus = detectChatFocus(last, mode);
  const focusedContext = buildFocusedChatContext({
    focus,
    resumeContext,
    jobContext,
    resumeText,
    extraContextText,
  });
  const followUps = buildChatFollowUps({
    mode,
    role,
    hasResume: !!resumeText.trim() || hasExtraContext,
    hasJD: !!jobDescription.trim(),
  });
  const fallbackReply = buildHeuristicChatReply({
    prompt: last,
    mode,
    role,
    hasResume: !!resumeText.trim(),
    hasJD: !!jobDescription.trim(),
    hasExtraContext,
    explainSimple,
    resumeContext,
    jobContext,
    extraContextText,
  });
  const fallbackHighlights =
    mode === "ai-mode"
      ? [
          resumeText.trim()
            ? `Top visible skills: ${(resumeContext?.topSkills || []).slice(0, 4).join(", ") || "not enough signal yet"}.`
            : "Upload or pass richer resume context for stronger AI-mode grounding.",
          jobDescription.trim()
            ? `JD fit signals: ${(jobContext?.matchedSkills || []).slice(0, 3).join(", ") || "limited overlap so far"}${jobContext?.missingSkills?.length ? `; gaps: ${jobContext.missingSkills.slice(0, 3).join(", ")}.` : "."}`
            : "No job description was provided, so role-fit advice is broader than ideal.",
          `Evidence signals: ${resumeContext?.metricCount || 0} metric references detected${resumeContext?.projectHighlights?.length ? ` and ${resumeContext.projectHighlights.length} project highlights found.` : "."}`,
        ]
      : [];
  const fallbackActionPlan =
    mode === "ai-mode"
      ? [
          `Rewrite the summary around ${(jobContext?.inferredRole || resumeContext?.detectedRole || role || "the target role")} fit, strongest skills, and one measurable strength.`,
          "Move the most relevant, high-impact bullets closer to the top of experience and make ownership explicit.",
          `Add ${(jobContext?.missingSkills || []).slice(0, 3).join(", ") || "missing keywords"} only where they are supported by real work or projects.`,
        ]
      : [];
  const fallbackRecruiterVerdict =
    mode === "ai-mode"
      ? {
          label: jobContext?.matchedSkills?.length >= 3 ? "Strong shortlist potential" : "Promising but not yet convincing",
          confidence: jobContext?.matchedSkills?.length >= 3 ? "High" : jobContext?.matchedSkills?.length ? "Medium" : "Low",
          decision: jobContext?.matchedSkills?.length >= 3 ? "Worth a recruiter screen" : "Needs sharper proof before shortlist",
          risk: jobContext?.missingSkills?.[0] || ((resumeContext?.metricCount || 0) < 2 ? "Limited quantified evidence" : "Broader role fit needs more proof"),
          summary: jobContext?.matchedSkills?.length
            ? `The resume shows useful overlap in ${jobContext.matchedSkills.slice(0, 3).join(", ")}, but the next hiring decision will depend on stronger proof and clearer prioritization.`
            : "The resume has some signal, but recruiter confidence is limited without stronger role-specific overlap and measurable evidence.",
        }
      : undefined;
  const baseResponse = {
    title: mode === "ai-mode" ? "AI Mode answer" : undefined,
    reply: fallbackReply,
    highlights: fallbackHighlights,
    actionPlan: fallbackActionPlan,
    followUps: followUps.slice(0, 3),
    recruiterVerdict: fallbackRecruiterVerdict,
    citations: relevantSnippets.slice(0, 3),
  };

  (async () => {
    if (!openai) {
      return res.json(baseResponse);
    }

    try {
      const resp = await openai.chat.completions.create({
        model: process.env.LLM_MODEL || "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an interactive AI resume assistant. Help with resume Q&A, real-time editing, career questions, JD-based tailoring, simple explanations of feedback, and follow-up suggestions. Be practical, specific, and grounded in the uploaded resume when present. When asked to edit resume content, provide improved text directly. Reference actual resume skills, projects, metrics, and experience if available instead of generic advice. Respect the requested language. If explainSimple is true, use simple everyday language. For ai-mode, answer like a polished AI search assistant: lead with a direct synthesis, then provide concise evidence-backed takeaways and a short action plan. Also produce a recruiterVerdict object with keys label, confidence, decision, risk, and summary. Never claim missing evidence if the resume context shows it. Never invent tools, companies, or achievements that are not present in the provided context.",
          },
          {
            role: "user",
            content: JSON.stringify({
              role,
              language,
              mode,
              explainSimple,
              resumeContext,
              jobContext,
              focus,
              focusedContext,
              relevantSnippets,
              resumeText: resumeText.slice(0, 12000),
              jobDescription: jobDescription.slice(0, 8000),
              extraContextText: extraContextText.slice(0, 12000),
              messages: messages.slice(-10),
              instruction:
                "Return valid JSON only. Always include keys reply and followUps. followUps must be an array of 3 short suggested next prompts. If mode is ai-mode, also include title, highlights, actionPlan, recruiterVerdict, and citations. recruiterVerdict must be an object with keys label, confidence, decision, risk, and summary. highlights/actionPlan are arrays of 3 short strings each. citations is an array of up to 3 short evidence snippets you actually used. Answer the latest user question directly while using earlier messages as conversation memory. Respect the requested focus. If focus is projects, talk about projects first and do not drift into experience unless needed. If focus is ats, prioritize ATS fixes, keywords, formatting, and evidence density. Ground every answer in the provided relevantSnippets, focusedContext, resumeContext, and jobContext when available. If the question goes beyond the resume, answer it normally but clearly separate general advice from resume-grounded evidence. Prefer naming matched skills, missing skills, project evidence, and metric strength. If the user asks for a rewrite, provide the improved wording directly inside reply.",
            }),
          },
        ],
        temperature: clamp(
          typeof temperature === "number" ? temperature : mode === "ai-mode" ? 0.15 : 0.4,
          0,
          1
        ),
        max_tokens: 900,
      });
      const rawContent = resp.choices[0].message.content || "";
      let parsed = null;
      try {
        parsed = parseAiJson(rawContent);
      } catch (_parseError) {
        parsed = null;
      }
      res.json({
        title: parsed?.title || baseResponse.title,
        reply: parsed?.reply || rawContent || baseResponse.reply,
        highlights:
          mode === "ai-mode"
            ? (Array.isArray(parsed?.highlights) && parsed.highlights.length ? parsed.highlights.slice(0, 3) : baseResponse.highlights)
            : undefined,
        actionPlan:
          mode === "ai-mode"
            ? (Array.isArray(parsed?.actionPlan) && parsed.actionPlan.length ? parsed.actionPlan.slice(0, 3) : baseResponse.actionPlan)
            : undefined,
        followUps: Array.isArray(parsed?.followUps) && parsed.followUps.length ? parsed.followUps.slice(0, 3) : baseResponse.followUps,
        citations: Array.isArray(parsed?.citations) && parsed.citations.length ? parsed.citations.slice(0, 3) : baseResponse.citations,
        recruiterVerdict:
          mode === "ai-mode" && parsed?.recruiterVerdict && typeof parsed.recruiterVerdict === "object"
            ? {
                label: parsed.recruiterVerdict.label || baseResponse.recruiterVerdict?.label,
                confidence: parsed.recruiterVerdict.confidence || baseResponse.recruiterVerdict?.confidence,
                decision: parsed.recruiterVerdict.decision || baseResponse.recruiterVerdict?.decision,
                risk: parsed.recruiterVerdict.risk || baseResponse.recruiterVerdict?.risk,
                summary: parsed.recruiterVerdict.summary || baseResponse.recruiterVerdict?.summary,
              }
            : baseResponse.recruiterVerdict,
      });
    } catch (e) {
      console.error(e);
      res.json(baseResponse);
    }
  })();
});

app.post("/api/chat/stream", async (req, res) => {
  const {
    messages = [],
    role = "",
    language = "English",
    mode = "resume",
    resumeText = "",
    jobDescription = "",
    extraContextText = "",
    temperature = null,
    explainSimple = false,
  } = req.body || {};

  const last = messages[messages.length - 1]?.content || "Help me improve my resume";
  const resumeContext = buildResumeChatContext(resumeText);
  const jobContext = buildJobDescriptionContext(jobDescription, resumeContext, role);
  const hasExtraContext = !!extraContextText.trim();
  const relevantSnippets = retrieveRelevantContext({
    question: last,
    resumeText,
    extraContextText,
  });
  const focus = detectChatFocus(last, mode);
  const focusedContext = buildFocusedChatContext({
    focus,
    resumeContext,
    jobContext,
    resumeText,
    extraContextText,
  });
  const followUps = buildChatFollowUps({
    mode,
    role,
    hasResume: !!resumeText.trim() || hasExtraContext,
    hasJD: !!jobDescription.trim(),
  });
  const fallbackReply = buildHeuristicChatReply({
    prompt: last,
    mode,
    role,
    hasResume: !!resumeText.trim(),
    hasJD: !!jobDescription.trim(),
    hasExtraContext,
    explainSimple,
    resumeContext,
    jobContext,
    extraContextText,
  });
  const fallbackHighlights =
    mode === "ai-mode"
      ? [
          resumeText.trim()
            ? `Top visible skills: ${(resumeContext?.topSkills || []).slice(0, 4).join(", ") || "not enough signal yet"}.`
            : "Upload or pass richer resume context for stronger AI-mode grounding.",
          jobDescription.trim()
            ? `JD fit signals: ${(jobContext?.matchedSkills || []).slice(0, 3).join(", ") || "limited overlap so far"}${jobContext?.missingSkills?.length ? `; gaps: ${jobContext.missingSkills.slice(0, 3).join(", ")}.` : "."}`
            : "No job description was provided, so role-fit advice is broader than ideal.",
          `Evidence signals: ${resumeContext?.metricCount || 0} metric references detected${resumeContext?.projectHighlights?.length ? ` and ${resumeContext.projectHighlights.length} project highlights found.` : "."}`,
        ]
      : [];
  const fallbackActionPlan =
    mode === "ai-mode"
      ? [
          `Rewrite the summary around ${(jobContext?.inferredRole || resumeContext?.detectedRole || role || "the target role")} fit, strongest skills, and one measurable strength.`,
          "Move the most relevant, high-impact bullets closer to the top of experience and make ownership explicit.",
          `Add ${(jobContext?.missingSkills || []).slice(0, 3).join(", ") || "missing keywords"} only where they are supported by real work or projects.`,
        ]
      : [];
  const fallbackRecruiterVerdict =
    mode === "ai-mode"
      ? {
          label: jobContext?.matchedSkills?.length >= 3 ? "Strong shortlist potential" : "Promising but not yet convincing",
          confidence: jobContext?.matchedSkills?.length >= 3 ? "High" : jobContext?.matchedSkills?.length ? "Medium" : "Low",
          decision: jobContext?.matchedSkills?.length >= 3 ? "Worth a recruiter screen" : "Needs sharper proof before shortlist",
          risk: jobContext?.missingSkills?.[0] || ((resumeContext?.metricCount || 0) < 2 ? "Limited quantified evidence" : "Broader role fit needs more proof"),
          summary: jobContext?.matchedSkills?.length
            ? `The resume shows useful overlap in ${jobContext.matchedSkills.slice(0, 3).join(", ")}, but the next hiring decision will depend on stronger proof and clearer prioritization.`
            : "The resume has some signal, but recruiter confidence is limited without stronger role-specific overlap and measurable evidence.",
        }
      : undefined;
  const baseResponse = {
    title: mode === "ai-mode" ? "AI Mode answer" : undefined,
    reply: fallbackReply,
    highlights: fallbackHighlights,
    actionPlan: fallbackActionPlan,
    followUps: followUps.slice(0, 3),
    recruiterVerdict: fallbackRecruiterVerdict,
    citations: relevantSnippets.slice(0, 3),
  };

  const sendEvent = (event, payload) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  if (!openai || mode !== "ai-mode") {
    const words = String(baseResponse.reply || "").split(/(\s+)/);
    for (const token of words) {
      sendEvent("chunk", { text: token });
    }
    sendEvent("meta", baseResponse);
    sendEvent("done", { ok: true });
    return res.end();
  }

  try {
    const stream = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "You are an interactive AI resume assistant. Answer the user's latest AI-mode resume question in plain text only, not JSON. Be practical, specific, and grounded in the provided resume and job description context. Lead with a direct synthesis, then explain the strongest signals, risks, and the fastest improvements. Never invent tools, metrics, or achievements.",
        },
        {
          role: "user",
          content: JSON.stringify({
            role,
            language,
            mode,
            explainSimple,
            resumeContext,
            jobContext,
            focus,
            focusedContext,
            relevantSnippets,
            resumeText: resumeText.slice(0, 12000),
            jobDescription: jobDescription.slice(0, 8000),
            extraContextText: extraContextText.slice(0, 12000),
            messages: messages.slice(-10),
            instruction:
              "Answer the latest user question directly in plain text. Do not return JSON. Respect the requested focus. If focus is projects, discuss projects first and avoid drifting into experience unless the project evidence is missing. If focus is ats, discuss ATS optimization first. Use the provided relevantSnippets first, then the broader focusedContext. If the question goes beyond the resume, answer it normally but clearly separate general advice from resume-grounded evidence. Keep the answer polished, recruiter-aware, and grounded in context.",
          }),
        },
      ],
      temperature: clamp(
        typeof temperature === "number" ? temperature : 0.15,
        0,
        1
      ),
      max_tokens: 900,
    });

    let fullReply = "";
    for await (const part of stream) {
      const text = part.choices?.[0]?.delta?.content || "";
      if (text) {
        fullReply += text;
        sendEvent("chunk", { text });
      }
    }

    sendEvent("meta", {
      ...baseResponse,
      reply: fullReply.trim() || baseResponse.reply,
    });
    sendEvent("done", { ok: true });
    res.end();
  } catch (error) {
    console.error(error);
    sendEvent("chunk", { text: baseResponse.reply });
    sendEvent("meta", baseResponse);
    sendEvent("done", { ok: false });
    res.end();
  }
});

// AI Career Coach
app.post("/api/career-coach", async (req, res) => {
  const {
    question = "",
    role = "",
    context = "",
    messages = [],
    profile = {},
    timeline = [],
    memory = [],
  } = req.body || {};

  if (!question.trim()) {
    return res.json(buildCareerCoachFallback("Help me plan my career", role, context, profile, timeline));
  }

  const scaffold = buildCareerCoachFallback(question, role, context, profile, timeline);
  if (!openai) {
    return res.json(scaffold);
  }

  const profileSummary = buildCoachProfileSummary(profile);

  const recentMemory = Array.isArray(memory)
    ? memory.slice(-5).map((item) => `- ${item.role}: ${item.content}`).join("\n")
    : "";

  const timelineText = Array.isArray(timeline) && timeline.length
    ? timeline.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "";

  try {
    const priorMessages = messages
      .slice(0, -1)
      .slice(-6)
      .map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content,
      }));

    const resp = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a premium AI career coach and hiring strategist. Give advice that is specific, realistic, and efficient. Use the user's target role, background, timeline, strengths, and any prior milestones. Avoid generic motivation, avoid repeating the prompt, and do not recommend vague course-hoarding. Prioritize the shortest path to interview-worthy proof.\n\nReturn valid JSON only with this exact shape: {\"answer\": string, \"careerPath\": string[], \"skillRoadmap\": string[], \"industryTrends\": string[], \"learningPlan\": string[], \"salaryPrediction\": {\"range\": string, \"note\": string}, \"switchGuidance\": string[], \"dailyTip\": string, \"habitBuilder\": string[], \"motivation\": string, \"followUps\": string[], \"resources\": string[], \"timelines\": string[] }.\n\nQuality rules:\n- answer: 90 to 140 words, direct and personalized.\n- careerPath: 3 to 4 concrete bullets.\n- skillRoadmap: 4 to 6 prioritized skills in the right order.\n- learningPlan: 3 to 5 action steps with time markers.\n- salaryPrediction.note: explain uncertainty without sounding vague.\n- followUps: 3 short, high-value next questions.\n- resources: 2 to 4 practical resources or search directions.\n- timelines: 3 to 5 milestones with week/month markers.\n- If the user is switching careers, explicitly connect transferable skills.\n- If profile details are thin, make the best assumptions and say what to validate in the answer.",
        },
        ...priorMessages,
        {
          role: "user",
          content: `Role focus: ${role || "General"}\nContext: ${context || "None"}\nProfile: ${profileSummary || "No profile details provided."}\nCurrent timeline:\n${timelineText || "No timeline yet."}\nConversation memory:\n${recentMemory || "None."}\nLatest question: ${question}\n\nBuild a response that helps the user decide what to do next this week, what to build next, and how to become more interview-ready quickly. Return valid JSON only.`,
        },
      ],
      temperature: 0.55,
      max_tokens: 900,
    });

    const rawContent = (resp.choices?.[0]?.message?.content || "").trim();
    let parsed = null;

    try {
      parsed = JSON.parse(rawContent);
    } catch (parseErr) {
      const extracted = extractJSONObject(rawContent);
      if (extracted) {
        try {
          parsed = JSON.parse(extracted);
        } catch (nestedErr) {
          console.warn("Career coach JSON parse failed", nestedErr);
        }
      } else {
        console.warn("Career coach JSON parse failed", parseErr);
      }
    }

    if (!parsed && rawContent) {
      parsed = { answer: rawContent };
    }

    res.json(normalizeCoachResponse(parsed, scaffold));
  } catch (e) {
    console.error(e);
    res.json(scaffold);
  }
});

// Recruiter flows (stubs)
const RECRUITER_CANDIDATES = [
  {
    candidateId: "c1",
    name: "Alex Johnson",
    role: "Data Engineer",
    location: "Bengaluru",
    experience: "4 years",
    score: 0.91,
    status: "Ready to shortlist",
    skills: ["python", "sql", "aws", "airflow", "docker"],
    gaps: ["snowflake", "dbt"],
    strengths: ["Built data pipelines", "Strong cloud exposure", "Good ETL ownership"],
    recommendation: "Strong fit for platform-heavy data roles. Move to recruiter screen.",
    salary: "₹18 LPA",
    availability: "This week",
    note: "Good communication signals in project descriptions.",
  },
  {
    candidateId: "c2",
    name: "Jordan Lee",
    role: "ML Engineer",
    location: "Hyderabad",
    experience: "3 years",
    score: 0.88,
    status: "Strong technical fit",
    skills: ["python", "ml", "pytorch", "tensorflow", "aws"],
    gaps: ["mlops", "monitoring"],
    strengths: ["Model training", "Experimentation depth", "Deep learning stack"],
    recommendation: "Good ML core. Validate deployment maturity in interview.",
    salary: "₹20 LPA",
    availability: "Tomorrow",
    note: "Portfolio projects look strong for applied ML work.",
  },
  {
    candidateId: "c3",
    name: "Priya Shah",
    role: "Full Stack Engineer",
    location: "Pune",
    experience: "5 years",
    score: 0.84,
    status: "High potential",
    skills: ["javascript", "typescript", "react", "node", "sql"],
    gaps: ["system design", "testing"],
    strengths: ["Product shipping", "Frontend depth", "Solid backend basics"],
    recommendation: "Great for shipping speed. Probe architecture and test quality.",
    salary: "₹17 LPA",
    availability: "In 2 days",
    note: "Strong product ownership and collaboration signal.",
  },
  {
    candidateId: "c4",
    name: "Sam Rivera",
    role: "DevOps Engineer",
    location: "Remote",
    experience: "6 years",
    score: 0.8,
    status: "Needs one more review",
    skills: ["aws", "docker", "kubernetes", "terraform", "ci/cd"],
    gaps: ["cost optimization"],
    strengths: ["Infra automation", "Kubernetes ops", "Release pipelines"],
    recommendation: "Good ops profile. Add one round focused on scale and reliability tradeoffs.",
    salary: "₹22 LPA",
    availability: "Next week",
    note: "Strong platform profile for infra-heavy teams.",
  },
];

let activeRecruiterJD = {
  id: "jd-demo",
  title: "Software Engineer",
  text: "",
  role: "Software Engineer",
  skills: ["javascript", "python", "sql", "testing"],
};

function getRecruiterUser(req) {
  return req.headers["x-user-email"] || req.headers["x-user-id"] || "demo_recruiter";
}

function buildRecruiterSkillHeatmap(candidates = []) {
  const skillMap = new Map();
  candidates.forEach((candidate) => {
    candidate.skills.forEach((skill) => {
      skillMap.set(skill, (skillMap.get(skill) || 0) + 1);
    });
  });
  return Array.from(skillMap.entries())
    .map(([skill, count]) => ({
      skill,
      count,
      intensity: Math.min(100, count * 25),
    }))
    .sort((a, b) => b.count - a.count);
}

function buildRecruiterJdProfile(text = "", title = "") {
  const role = title || inferRoleFromText(text) || "Software Engineer";
  const benchmarkSkills = benchmarkSkillsForRole(role);
  const detectedSkills = detectSkills(text);
  return {
    id: `jd-${Date.now()}`,
    title: title || role,
    text,
    role,
    skills: Array.from(new Set([...(detectedSkills || []), ...benchmarkSkills])).slice(0, 10),
  };
}

function estimateRecruiterScore(skills = [], gaps = [], details = {}, matchedSkills = [], jdSkills = []) {
  const educationBoost = details.education?.length ? 0.05 : 0;
  const projectBoost = details.projects?.length ? 0.06 : 0;
  const experienceBoost = details.experience?.length ? 0.08 : 0;
  const coverageBoost = Math.min(skills.length * 0.035, 0.28);
  const gapPenalty = Math.min(gaps.length * 0.03, 0.16);
  const jdCoverageBoost = jdSkills.length ? Math.min((matchedSkills.length / jdSkills.length) * 0.24, 0.24) : 0;
  return Math.max(0.58, Math.min(0.97, 0.58 + educationBoost + projectBoost + experienceBoost + coverageBoost + jdCoverageBoost - gapPenalty));
}

function buildRecruiterCandidateFromResume(text = "", fileName = "", index = 0, jdProfile = activeRecruiterJD) {
  const details = parseResumeDetails(text);
  const skills = detectSkills(text).slice(0, 8);
  const role = jdProfile?.role || inferRoleFromText(text);
  const benchmark = (jdProfile?.skills?.length ? jdProfile.skills : benchmarkSkillsForRole(role)).slice(0, 10);
  const matchedSkills = getMatchingSkills(benchmark, skills);
  const gaps = getMissingSkills(benchmark, skills).slice(0, 3);
  const score = estimateRecruiterScore(skills, gaps, details, matchedSkills, benchmark);
  const name =
    details.name && details.name.length > 2
      ? details.name
      : fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || `Candidate ${index + 1}`;
  const strengths = [
    details.projects?.[0] ? `Projects signal: ${details.projects[0]}` : null,
    details.experience?.[0] ? `Experience signal: ${details.experience[0]}` : null,
    skills[0] ? `Core skill evidence in ${skills.slice(0, 3).join(", ")}` : null,
  ].filter(Boolean);
  return {
    candidateId: `bulk-${Date.now()}-${index}`,
    name,
    role,
    location: "Resume upload",
    experience: details.experience?.length ? `${details.experience.length} experience highlights` : "Experience needs review",
    score: Number(score.toFixed(2)),
    status: score >= 0.85 ? "Ready to shortlist" : score >= 0.76 ? "Worth a recruiter screen" : "Needs more review",
    skills: skills.length ? skills : ["resume parsing incomplete"],
    matchedSkills,
    gaps,
    strengths: strengths.length ? strengths : ["Resume uploaded for recruiter review"],
    recommendation:
      score >= 0.85
        ? `High-fit ${role} profile against ${jdProfile?.title || role}. Move to recruiter screen.`
        : `Promising ${role} profile. Validate depth in ${gaps.join(", ") || "core role skills"} during the first round.`,
    salary: "Not set",
    availability: "Pending candidate response",
    note: details.certifications?.[0] ? `Certification detected: ${details.certifications[0]}` : `AI-ranked against ${jdProfile?.title || "target role"}.`,
  };
}

function buildRecruiterDashboardData() {
  const candidates = RECRUITER_CANDIDATES.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    shortlist: candidate.score >= 0.85,
  }));
  const shortlisted = candidates.filter((candidate) => candidate.shortlist);
  return {
    summary: {
      totalCandidates: candidates.length,
      shortlisted: shortlisted.length,
      averageScore: Math.round((candidates.reduce((sum, item) => sum + item.score, 0) / candidates.length) * 100),
      interviewsThisWeek: 3,
    },
    hiringRecommendations: [
      "Fast-track Alex Johnson and Jordan Lee for the first recruiter screen.",
      "Priya Shah is a strong product engineering candidate but needs system design validation.",
      "Sam Rivera looks best for infrastructure-heavy openings with Kubernetes ownership.",
    ],
    interviewSchedule: [
      { id: "s1", candidateId: "c1", candidate: "Alex Johnson", stage: "Recruiter Screen", slot: "2026-03-20 11:00 AM" },
      { id: "s2", candidateId: "c2", candidate: "Jordan Lee", stage: "ML Technical Round", slot: "2026-03-20 03:30 PM" },
      { id: "s3", candidateId: "c3", candidate: "Priya Shah", stage: "Hiring Manager", slot: "2026-03-21 12:00 PM" },
    ],
    activeJobDescription: activeRecruiterJD,
    candidates,
    skillHeatmap: buildRecruiterSkillHeatmap(candidates),
  };
}

async function getOrCreateRecruiterWorkspace(user = "demo_recruiter") {
  let workspace = await RecruiterWorkspace.findOne({ user });
  if (!workspace) {
    const seed = buildRecruiterDashboardData();
    workspace = await RecruiterWorkspace.create({
      user,
      activeJobDescription: seed.activeJobDescription,
      candidates: seed.candidates,
      shortlistedIds: seed.candidates.filter((candidate) => candidate.shortlist).map((candidate) => candidate.candidateId),
      interviewSchedule: seed.interviewSchedule,
      notes: [],
    });
  }
  return workspace;
}

function buildRecruiterWorkspaceResponse(workspace) {
  const candidates = (workspace?.candidates || []).map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    shortlist: (workspace?.shortlistedIds || []).includes(candidate.candidateId),
  }));
  const shortlisted = candidates.filter((candidate) => candidate.shortlist);
  const sortedCandidates = [...candidates].sort((a, b) => (b.score || 0) - (a.score || 0));
  const averageScore = candidates.length
    ? Math.round((candidates.reduce((sum, item) => sum + (item.score || 0), 0) / candidates.length) * 100)
    : 0;
  const topCandidates = sortedCandidates.slice(0, 5);
  const urgentReviews = sortedCandidates
    .filter((candidate) => (candidate.gaps || []).length >= 2 || (candidate.score || 0) < 0.78)
    .slice(0, 5);
  const pipelineBreakdown = {
    readyToShortlist: candidates.filter((candidate) => (candidate.score || 0) >= 0.85).length,
    recruiterScreen: candidates.filter((candidate) => (candidate.score || 0) >= 0.76 && (candidate.score || 0) < 0.85).length,
    deepReview: candidates.filter((candidate) => (candidate.score || 0) < 0.76).length,
  };
  const nextActions = topCandidates.length
    ? topCandidates.slice(0, 3).map((candidate) => {
        const topGap = candidate.gaps?.[0];
        return topGap
          ? `Move ${candidate.name} forward, then validate ${topGap} in the first screen.`
          : `Move ${candidate.name} forward for the next interview stage.`;
      })
    : ["Upload resumes and set a hiring brief to generate recruiter actions."];

  return {
    summary: {
      totalCandidates: candidates.length,
      shortlisted: shortlisted.length,
      averageScore,
      interviewsThisWeek: (workspace?.interviewSchedule || []).length,
    },
    hiringRecommendations: shortlisted.length
      ? shortlisted.slice(0, 3).map((candidate) => `${candidate.name} is a strong fit for ${workspace?.activeJobDescription?.title || "the open role"}.`)
      : ["No shortlisted candidates yet. Review ranked resumes and shortlist the strongest fits first."],
    interviewSchedule: workspace?.interviewSchedule || [],
    activeJobDescription: workspace?.activeJobDescription || activeRecruiterJD,
    candidates,
    topCandidates,
    urgentReviews,
    pipelineBreakdown,
    nextActions,
    skillHeatmap: buildRecruiterSkillHeatmap(candidates),
    notes: workspace?.notes || [],
  };
}

app.post("/api/recruiter/upload-jd", requireAuth, async (req, res) => {
  try {
    const user = getRecruiterUser(req);
    const { title = "", jobDescription = "" } = req.body || {};
    activeRecruiterJD = buildRecruiterJdProfile(jobDescription, title);
    const workspace = await getOrCreateRecruiterWorkspace(user);
    workspace.activeJobDescription = activeRecruiterJD;
    await workspace.save();
    res.json({ jdId: activeRecruiterJD.id, status: "stored", profile: activeRecruiterJD });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Saving recruiter JD failed" });
  }
});

app.post("/api/recruiter/candidates/upload", requireAuth, upload.array("files", 20), async (req, res) => {
  try {
    const user = getRecruiterUser(req);
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ message: "No resume files uploaded" });
    }
    const jdTitle = req.body?.title || activeRecruiterJD?.title || "";
    const jdText = req.body?.jobDescription || activeRecruiterJD?.text || "";
    const jdProfile = buildRecruiterJdProfile(jdText, jdTitle);
    activeRecruiterJD = jdProfile;
    const workspace = await getOrCreateRecruiterWorkspace(user);
    workspace.activeJobDescription = jdProfile;
    const candidates = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const text = await extractTextFromPdf(file.buffer);
      candidates.push(buildRecruiterCandidateFromResume(text, file.originalname, index, jdProfile));
    }
    workspace.candidates = [...(workspace.candidates || []), ...candidates];
    await workspace.save();
    res.json({ ingested: candidates.length, status: "ok", mode: "resume_analysis", jdProfile, candidates });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Candidate upload analysis failed" });
  }
});

app.get("/api/recruiter/dashboard", requireAuth, async (_req, res) => {
  try {
    const workspace = await getOrCreateRecruiterWorkspace(getRecruiterUser(_req));
    activeRecruiterJD = workspace.activeJobDescription || activeRecruiterJD;
    res.json(buildRecruiterWorkspaceResponse(workspace));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Recruiter dashboard failed" });
  }
});

app.get("/api/recruiter/rankings", requireAuth, async (_req, res) => {
  try {
    const workspace = await getOrCreateRecruiterWorkspace(getRecruiterUser(_req));
    const dashboard = buildRecruiterWorkspaceResponse(workspace);
    res.json({ rankings: dashboard.candidates });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Recruiter rankings failed" });
  }
});

app.post("/api/recruiter/shortlist", requireAuth, async (req, res) => {
  try {
    const workspace = await getOrCreateRecruiterWorkspace(getRecruiterUser(req));
    workspace.shortlistedIds = req.body?.candidateIds || [];
    await workspace.save();
    res.json({ shortlisted: workspace.shortlistedIds, status: "saved" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Saving shortlist failed" });
  }
});

app.post("/api/recruiter/schedule", requireAuth, async (req, res) => {
  try {
    const workspace = await getOrCreateRecruiterWorkspace(getRecruiterUser(req));
    const { candidateId = "", candidate = "Candidate", slot = "", stage = "Interview" } = req.body || {};
    const scheduled = {
      id: `sched-${Date.now()}`,
      candidateId,
      candidate,
      stage,
      slot,
    };
    workspace.interviewSchedule = [scheduled, ...(workspace.interviewSchedule || [])];
    await workspace.save();
    res.json({
      scheduled,
      status: "scheduled",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Scheduling recruiter interview failed" });
  }
});

app.post("/api/recruiter/notes", requireAuth, async (req, res) => {
  try {
    const workspace = await getOrCreateRecruiterWorkspace(getRecruiterUser(req));
    const { candidateId = "", note = "", rating = "" } = req.body || {};
    const savedNote = {
      id: `note-${Date.now()}`,
      candidateId,
      note,
      rating,
    };
    workspace.notes = [savedNote, ...(workspace.notes || [])];
    await workspace.save();
    res.json({
      saved: true,
      note: savedNote,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Saving recruiter note failed" });
  }
});

// Contact / bug report
app.post("/api/contact", (req, res) => {
  (async () => {
    try {
      const {
        name = "",
        email = "",
        subject = "",
        message = "",
        category = "",
        topic = "",
        targetRole = "",
        timeline = "",
        type = "contact",
      } = req.body || {};

      if (!String(email).trim() || !String(message).trim()) {
        return res.status(400).json({ message: "Email and message are required" });
      }

      const normalizedType = type === "feedback" ? "feedback" : "contact";
      const ticketId = `${normalizedType === "feedback" ? "F" : "T"}-${Date.now()}`;

      await ContactSubmission.create({
        ticketId,
        type: normalizedType,
        name: String(name || "").trim(),
        email: String(email || "").trim(),
        subject: String(subject || category || "General inquiry").trim(),
        message: String(message || "").trim(),
        category: String(category || "").trim(),
        topic: String(topic || "").trim(),
        targetRole: String(targetRole || "").trim(),
        timeline: String(timeline || "").trim(),
        userId: String(req.headers["x-user-id"] || "").trim(),
        userEmail: String(req.headers["x-user-email"] || "").trim(),
      });

      res.json({ ticketId, status: "received" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Contact submission failed" });
    }
  })();
});

app.post("/api/bug-report", (req, res) => {
  (async () => {
    try {
      const { email = "", page = "", severity = "Medium", details = "" } = req.body || {};

      if (!String(email).trim() || !String(details).trim()) {
        return res.status(400).json({ message: "Email and bug details are required" });
      }

      const ticketId = `B-${Date.now()}`;

      await ContactSubmission.create({
        ticketId,
        type: "bug",
        email: String(email || "").trim(),
        subject: `Bug report: ${String(page || "Unknown page").trim()}`,
        message: String(details || "").trim(),
        page: String(page || "").trim(),
        severity: String(severity || "Medium").trim(),
        details: String(details || "").trim(),
        userId: String(req.headers["x-user-id"] || "").trim(),
        userEmail: String(req.headers["x-user-email"] || "").trim(),
      });

      res.json({ ticketId, status: "received" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Bug report failed" });
    }
  })();
});

app.get("/api/profile", (req, res) => {
  const authUser = req.authUser || (req.authUser === undefined ? null : null);
  const email = authUser?.email || "demo@example.com";
  const inferredName = authUser?.name || String(email).split("@")[0] || "Demo User";
  const userDashboardState = authUser?.dashboardState || {};
  res.json({
    user: { name: inferredName, email, title: "Data Engineer" },
    resumeSummary: {
      roleFit: "AI / Data Science",
      topSkills: ["Python", "ML", "NLP"],
      experienceLevel: "Intermediate",
      bestMatchingJobs: 8,
      blurb: "5+ years building data pipelines, NLP models, and analytics dashboards.",
    },
    skillProfile: [
      { skill: "Python", score: 90 },
      { skill: "Machine Learning", score: 82 },
      { skill: "SQL", score: 68 },
      { skill: "NLP", score: 74 },
      { skill: "Airflow", score: 65 },
    ],
    jobMatchStats: { analyzed: 120, high: 15, medium: 40, low: 65 },
    scoreHistory: [
      { date: "2026-01-10", ats: 62 },
      { date: "2026-02-02", ats: 71 },
      { date: "2026-03-01", ats: 80 },
    ],
    resumes: ["Resume_v1.pdf", "Resume_Internship.pdf", "Resume_AI_Role.pdf"],
    recommendations: ["Add SQL to improve match score", "Add more ML projects", "Add measurable achievements"],
    activity: [
      { date: "2026-03-16", action: "Analyzed resume for ML Engineer job" },
      { date: "2026-03-15", action: "Generated AI feedback" },
      { date: "2026-03-14", action: "Compared resume versions" },
      { date: "2026-03-12", action: "Applied to 3 jobs" },
    ],
    portfolio: ["https://github.com/demo", "https://linkedin.com/in/demo", "https://demo.dev"],
    connectedAccounts: ["LinkedIn", "GitHub", "Google"],
    interests: ["Machine Learning", "Backend Systems", "Product Thinking", "Data Platforms"],
    savedJobs: [
      { id: "sj1", title: "ML Engineer", company: "VisionAI", match: 92, status: "Saved" },
      { id: "sj2", title: "Data Engineer", company: "DataWorks", match: 88, status: "Applied" },
      { id: "sj3", title: "Backend Engineer", company: "Acme", match: 81, status: "Review later" },
    ],
    progressTracking: [
      { label: "Resume readiness", value: 80, target: 100 },
      { label: "Interview confidence", value: 72, target: 100 },
      { label: "Skill coverage", value: 68, target: 100 },
      { label: "Application momentum", value: 54, target: 100 },
    ],
    preferences: {
      notifications: {
        jobAlerts: true,
        interviewReminders: true,
        resumeTips: true,
        weeklyReport: true,
      },
      theme: "light",
    },
    security: { mfa: true, lastLogin: "2026-03-16", privacy: { recruiterView: true, anonymized: true, privateMode: false } },
    achievements: [
      "Resume Optimizer (Improved score 20%)",
      "Skill Builder (Added 5 new skills)",
      "Interview Ready (Generated 50 questions)",
    ],
    careerInsights: {
      bestRole: "Machine Learning Engineer",
      salaryRange: "₹8–12 LPA",
      topSkillsToLearn: ["Docker", "AWS"],
      profileStrength: 78,
    },
    momentum: {
      weeklyStreak: 6,
      applicationsThisWeek: 5,
      interviewsThisWeek: 2,
      strongestArea: "Resume quality",
      weakestArea: "Cloud deployment proof",
    },
    weeklyActionPlan: [
      {
        title: "Upgrade one resume bullet with proof",
        category: "Resume",
        effort: "20 min",
        impact: "High",
        detail: "Add one metric-driven backend or ML achievement to your top project section.",
      },
      {
        title: "Apply to 3 high-fit jobs",
        category: "Applications",
        effort: "45 min",
        impact: "High",
        detail: "Prioritize ML Engineer and Data Engineer roles above 80% fit.",
      },
      {
        title: "Run one mock interview",
        category: "Interview",
        effort: "30 min",
        impact: "Medium",
        detail: "Practice impact storytelling using STAR for one technical and one behavioral answer.",
      },
      {
        title: "Close one cloud skill gap",
        category: "Learning",
        effort: "60 min",
        impact: "Medium",
        detail: "Complete one AWS or Docker lab and add it to project notes.",
      },
    ],
    opportunityRadar: {
      targetCompanies: ["Turing", "NielsenIQ", "Walmart Global Tech", "Fractal", "Jio Platforms"],
      nextRoles: ["Machine Learning Engineer", "Data Engineer", "Applied AI Engineer"],
      hiringSignals: [
        "Your Python + SQL combination is already strong for data-heavy roles.",
        "Adding Docker + cloud deployment evidence will unlock more shortlist-ready AI roles.",
        "Interview preparation is now the biggest multiplier after resume quality.",
      ],
      networkingMoves: [
        "Reach out to 2 alumni working in ML or backend roles this week.",
        "Post one project improvement on LinkedIn with a measurable outcome.",
      ],
    },
    marketSignals: [
      { label: "AI/ML hiring relevance", value: 82, note: "Strong demand for applied projects and deployment proof" },
      { label: "Backend role compatibility", value: 76, note: "Your current stack still maps well to product engineering roles" },
      { label: "Cloud readiness", value: 58, note: "This is the main gap limiting premium shortlist chances" },
    ],
    coachPrompts: [
      "Give me a 7-day action plan to improve my shortlist chances.",
      "Which of my current skills should I market more aggressively?",
      "How should I present my projects for ML engineer interviews?",
    ],
    notificationsCenter: [
      {
        id: "notif-1",
        type: "resume",
        priority: "high",
        createdAt: "2026-03-20T08:30:00.000Z",
        title: "Resume score improved this week",
        message: "Your ATS trend is up. One more quantified project bullet could push you past 82.",
        cta: "Open Resume Feedback",
      },
      {
        id: "notif-2",
        type: "jobs",
        priority: "medium",
        createdAt: "2026-03-19T16:10:00.000Z",
        title: "3 roles are above 85% fit",
        message: "You have strong overlap for ML Engineer and Data Engineer openings. Apply before the weekend.",
        cta: "Open Job Matcher",
      },
      {
        id: "notif-3",
        type: "interview",
        priority: "medium",
        createdAt: "2026-03-18T12:45:00.000Z",
        title: "Interview consistency is slipping",
        message: "You practiced less this week. One mock session now would protect your momentum.",
        cta: "Open Interview Prep",
      },
    ],
    learningPlan: [
      {
        week: "Week 1",
        focus: "Docker fundamentals",
        resource: "YouTube: Docker for Beginners",
        outcome: "Containerize one existing project locally",
      },
      {
        week: "Week 2",
        focus: "AWS deployment basics",
        resource: "Coursera: AWS Cloud Technical Essentials",
        outcome: "Deploy a simple API or ML demo to cloud infrastructure",
      },
      {
        week: "Week 3",
        focus: "Interview storytelling",
        resource: "Platform mock interview practice",
        outcome: "Prepare 5 STAR stories with measurable outcomes",
      },
    ],
    applicationBoard: {
      applied: [
        { id: "ap-1", company: "DataWorks", role: "Data Engineer", status: "Applied", fit: 88 },
        { id: "ap-2", company: "VisionAI", role: "ML Engineer", status: "Applied", fit: 92 },
      ],
      interviewing: [
        { id: "ap-3", company: "Northwind", role: "Backend Engineer", status: "Interviewing", fit: 81 },
      ],
      saved: [
        { id: "ap-4", company: "Fractal", role: "Applied AI Engineer", status: "Saved", fit: 86 },
        { id: "ap-5", company: "Acme", role: "Software Engineer", status: "Saved", fit: 77 },
      ],
    },
    dashboardState: {
      applicationBoard: userDashboardState.applicationBoard || null,
      learningProgress: userDashboardState.learningProgress || {},
      hiddenNotifications: Array.isArray(userDashboardState.hiddenNotifications)
        ? userDashboardState.hiddenNotifications
        : [],
      customNotifications: Array.isArray(userDashboardState.customNotifications)
        ? userDashboardState.customNotifications
        : [],
      analyzerHistory: Array.isArray(userDashboardState.analyzerHistory)
        ? userDashboardState.analyzerHistory
        : [],
      aiModeSessions: Array.isArray(userDashboardState.aiModeSessions)
        ? userDashboardState.aiModeSessions
        : [],
      sharedResumes: Array.isArray(userDashboardState.sharedResumes)
        ? userDashboardState.sharedResumes
        : [],
    },
    resumeVersions: [
      { version: "v1", date: "2026-01-05" },
      { version: "v2", date: "2026-02-01" },
      { version: "v3", date: "2026-03-01" },
    ],
    resumeEditor: {
      summary: "Data-focused engineer building AI-assisted products and scalable backend workflows.",
      headline: "Data Engineer | AI Product Builder",
      targetRole: "Machine Learning Engineer",
    },
  });
});

app.put("/api/dashboard-state", requireAuth, async (req, res) => {
  try {
    const {
      applicationBoard = null,
      learningProgress = null,
      hiddenNotifications = null,
      customNotifications = null,
      analyzerHistory = null,
      aiModeSessions = null,
      sharedResumes = null,
    } = req.body || {};

    const nextState = {
      applicationBoard:
        applicationBoard && typeof applicationBoard === "object" ? applicationBoard : req.authUser.dashboardState?.applicationBoard || {},
      learningProgress:
        learningProgress && typeof learningProgress === "object" ? learningProgress : req.authUser.dashboardState?.learningProgress || {},
      hiddenNotifications: Array.isArray(hiddenNotifications)
        ? hiddenNotifications
        : req.authUser.dashboardState?.hiddenNotifications || [],
      customNotifications: Array.isArray(customNotifications)
        ? customNotifications
        : req.authUser.dashboardState?.customNotifications || [],
      analyzerHistory: Array.isArray(analyzerHistory)
        ? analyzerHistory.slice(0, 20)
        : req.authUser.dashboardState?.analyzerHistory || [],
      aiModeSessions: Array.isArray(aiModeSessions)
        ? aiModeSessions.slice(0, 12)
        : req.authUser.dashboardState?.aiModeSessions || [],
      sharedResumes: Array.isArray(sharedResumes)
        ? sharedResumes.slice(0, 20)
        : req.authUser.dashboardState?.sharedResumes || [],
    };

    req.authUser.dashboardState = nextState;
    await req.authUser.save();

    res.json({
      saved: true,
      dashboardState: nextState,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Saving dashboard state failed" });
  }
});

app.post("/api/resume-share", requireAuth, async (req, res) => {
  try {
    const {
      headline = "",
      versionLabel = "",
      template = "classic",
      summary = "",
      skills = "",
      bullets = [],
      keywords = [],
    } = req.body || {};

    const shareId = `share-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sharedResume = {
      shareId,
      headline,
      versionLabel,
      template,
      summary,
      skills,
      bullets: Array.isArray(bullets) ? bullets.slice(0, 8) : [],
      keywords: Array.isArray(keywords) ? keywords.slice(0, 12) : [],
      createdAt: new Date().toISOString(),
      owner: req.authUser?.email || req.authUser?._id?.toString() || "user",
    };

    const currentState = req.authUser.dashboardState || {};
    req.authUser.dashboardState = {
      applicationBoard: currentState.applicationBoard || {},
      learningProgress: currentState.learningProgress || {},
      hiddenNotifications: Array.isArray(currentState.hiddenNotifications) ? currentState.hiddenNotifications : [],
      customNotifications: Array.isArray(currentState.customNotifications) ? currentState.customNotifications : [],
      analyzerHistory: Array.isArray(currentState.analyzerHistory) ? currentState.analyzerHistory : [],
      aiModeSessions: Array.isArray(currentState.aiModeSessions) ? currentState.aiModeSessions : [],
      sharedResumes: [sharedResume, ...(Array.isArray(currentState.sharedResumes) ? currentState.sharedResumes : [])].slice(0, 20),
    };

    await req.authUser.save();

    res.json({
      shared: true,
      shareId,
      path: `/shared-resume/${shareId}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Creating share link failed" });
  }
});

app.get("/api/resume-share/:shareId", async (req, res) => {
  try {
    const { shareId = "" } = req.params;
    const owner = await User.findOne({ "dashboardState.sharedResumes.shareId": shareId });
    const sharedResumes = owner?.dashboardState?.sharedResumes || [];
    const sharedResume = Array.isArray(sharedResumes)
      ? sharedResumes.find((item) => item?.shareId === shareId)
      : null;

    if (!sharedResume) {
      return res.status(404).json({ message: "Shared resume not found" });
    }

    res.json({
      shareId: sharedResume.shareId,
      headline: sharedResume.headline || "Shared resume",
      versionLabel: sharedResume.versionLabel || "Resume draft",
      template: sharedResume.template || "classic",
      summary: sharedResume.summary || "",
      skills: sharedResume.skills || "",
      bullets: Array.isArray(sharedResume.bullets) ? sharedResume.bullets : [],
      keywords: Array.isArray(sharedResume.keywords) ? sharedResume.keywords : [],
      createdAt: sharedResume.createdAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Loading shared resume failed" });
  }
});

// start
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Mongo connection failed", err);
    process.exit(1);
  });
