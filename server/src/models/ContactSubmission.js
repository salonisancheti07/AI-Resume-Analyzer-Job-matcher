import mongoose from "mongoose";

const contactSubmissionSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ["contact", "feedback", "bug"], default: "contact", index: true },
    name: { type: String, default: "" },
    email: { type: String, required: true, index: true },
    subject: { type: String, default: "" },
    message: { type: String, default: "" },
    category: { type: String, default: "" },
    topic: { type: String, default: "" },
    targetRole: { type: String, default: "" },
    timeline: { type: String, default: "" },
    page: { type: String, default: "" },
    severity: { type: String, default: "" },
    details: { type: String, default: "" },
    userId: { type: String, default: "" },
    userEmail: { type: String, default: "" },
    status: { type: String, default: "open" },
  },
  { timestamps: true }
);

export const ContactSubmission =
  mongoose.models.ContactSubmission || mongoose.model("ContactSubmission", contactSubmissionSchema);
