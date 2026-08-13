
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import passport from "passport";
import { config } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { authRouter } from "./routes/auth";
import { profileRouter } from "./routes/profiles";
import { geofenceRouter } from "./routes/geofences";
import { sessionRouter } from "./routes/sessions";
import { attendanceRouter } from "./routes/attendance";
import { marksRouter } from "./routes/marks";
import { courseRouter } from "./routes/courses";
import { enrollmentRouter } from "./routes/enrollments";
import { gpsSettingsRouter } from "./routes/gps-settings";
import { studentDetailsRouter } from "./routes/student-details";
import { classRouter } from "./routes/classes";
import { scheduleRouter } from "./routes/class-schedule";
import { leaveRouter } from "./routes/leave-requests";
import { faceRouter } from "./routes/face";
import { attendanceSummaryRouter } from "./routes/attendance-summary";

export function createApp(): express.Express {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(
    cors({
      origin: config.webOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(passport.initialize());
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });
  app.use("/auth", authRouter);
  app.use("/profiles", profileRouter);
  app.use("/geofences", geofenceRouter);
  app.use("/sessions", sessionRouter);
  app.use("/attendance", attendanceRouter);
  app.use("/attendance-summary", attendanceSummaryRouter);
  app.use("/marks", marksRouter);
  app.use("/courses", courseRouter);
  app.use("/enrollments", enrollmentRouter);
  app.use("/gps-settings", gpsSettingsRouter);
  app.use("/student-details", studentDetailsRouter);
  app.use("/classes", classRouter);
  app.use("/class-schedule", scheduleRouter);
  app.use("/leave-requests", leaveRouter);
  app.use("/face", faceRouter);

  app.use(errorHandler);
  return app;
}
