import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { User } from "../models/User.js";
import { hasOauthConfig } from "./oauthConfig.js";

export function configurePassport() {
  passport.serializeUser((user, done) => done(null, String(user._id)));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user || null);
    } catch (error) {
      done(error, null);
    }
  });

  if (hasOauthConfig(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_CALLBACK_URL)) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            let user = await User.findOne({ email });
            if (!user) {
              user = await User.create({
                name: profile.displayName || "Google User",
                email,
                avatarUrl: profile.photos?.[0]?.value || "",
                provider: "google",
                providerId: profile.id,
                role: "user",
              });
            }
            done(null, user);
          } catch (error) {
            done(error, null);
          }
        }
      )
    );
  }

  if (hasOauthConfig(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET, process.env.GITHUB_CALLBACK_URL)) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          callbackURL: process.env.GITHUB_CALLBACK_URL,
          scope: ["user:email"],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value || `${profile.username || profile.id}@github.local`;
            let user = await User.findOne({ email });
            if (!user) {
              user = await User.create({
                name: profile.displayName || profile.username || "GitHub User",
                email,
                avatarUrl: profile.photos?.[0]?.value || "",
                provider: "github",
                providerId: profile.id,
                role: "user",
              });
            }
            done(null, user);
          } catch (error) {
            done(error, null);
          }
        }
      )
    );
  }

  return passport;
}
