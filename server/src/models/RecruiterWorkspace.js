import mongoose from "mongoose";

const recruiterWorkspaceSchema = new mongoose.Schema(
  {
    user: { type: String, default: "demo_recruiter", index: true },
    activeJobDescription: {
      id: String,
      title: String,
      text: String,
      role: String,
      skills: [String],
    },
    candidates: { type: [mongoose.Schema.Types.Mixed], default: [] },
    shortlistedIds: { type: [String], default: [] },
    interviewSchedule: { type: [mongoose.Schema.Types.Mixed], default: [] },
    notes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

export const RecruiterWorkspace =
  mongoose.models.RecruiterWorkspace || mongoose.model("RecruiterWorkspace", recruiterWorkspaceSchema);
