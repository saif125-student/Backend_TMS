import cron from "node-cron";
import prisma from "../prisma/client.js";
import {
  getYesterdayDateOnly,
  generateMissingAttendanceForDate,
} from "./attendanceCron.service.js";

const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Karachi";

export const startAttendanceScheduler = () => {
  cron.schedule(
    "5 * * * *",
    async () => {
      try {
        console.log("Attendance cron started");

        const date = getYesterdayDateOnly();

        const result = await prisma.$transaction(async (tx) => {
          return generateMissingAttendanceForDate({
            tx,
            date,
          });
        });

        console.log("Attendance cron completed", result);
      } catch (error) {
        console.error("Attendance cron failed", error);
      }
    },
    {
      timezone: APP_TIMEZONE,
    }
  );
};