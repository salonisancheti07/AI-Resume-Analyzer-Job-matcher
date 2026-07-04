import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, sparse: true, index: true },
    passwordHash: String,
    avatarUrl: String,
    provider: { type: String, default: "local" },
    providerId: String,
    role: { type: String, default: "user" },
    rememberMe: { type: Boolean, default: false },
    resetPasswordToken: String,
    resetPasswordExpiresAt: Date,
    preferences: {
      notifications: {
        jobAlerts: { type: Boolean, default: true },
        interviewReminders: { type: Boolean, default: true },
        resumeTips: { type: Boolean, default: true },
        weeklyReport: { type: Boolean, default: true },
      },
    },
    dashboardState: {
      applicationBoard: { type: mongoose.Schema.Types.Mixed, default: {} },
      learningProgress: { type: mongoose.Schema.Types.Mixed, default: {} },
      hiddenNotifications: { type: [String], default: [] },
      customNotifications: { type: [mongoose.Schema.Types.Mixed], default: [] },
      analyzerHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
      aiModeSessions: { type: [mongoose.Schema.Types.Mixed], default: [] },
      sharedResumes: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
