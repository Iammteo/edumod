import { z } from "zod";
export const markAttendanceSchema = z.object({ schoolId:z.string().uuid(), termId:z.string().uuid(), date:z.string().date(), records:z.array(z.object({studentId:z.string().uuid(),status:z.enum(["present","absent","late","excused"]),lateAt:z.string().datetime().optional()})).min(1).max(500) });
