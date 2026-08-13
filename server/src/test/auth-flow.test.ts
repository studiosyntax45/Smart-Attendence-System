
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../config/db";
import { hashPassword } from "../services/auth";

const app = createApp();

const ADMIN_EMAIL = "test-admin@pesu.pesu.pes.edu";
const STUDENT_EMAIL = "test-student@pesu.pesu.pes.edu";
const FACULTY_EMAIL = "test-faculty@pesu.pesu.pes.edu";

async function ensureUser(email: string, role: "student" | "faculty" | "admin") {
  const passwordHash = await hashPassword("Pes@12345");
  await prisma.authUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { id: crypto.randomUUID(), email, passwordHash },
  });
  const u = await prisma.authUser.findUnique({ where: { email } });
  if (!u) throw new Error("seed failed");
  await prisma.profile.upsert({
    where: { id: u.id },
    update: { role },
    create: { id: u.id, fullName: email.split("@")[0], role },
  });
  return u.id;
}

test("auth flow: login â†’ /auth/me â†’ role-guard rejects wrong role", async () => {
  const adminId = await ensureUser(ADMIN_EMAIL, "admin");
  const studentId = await ensureUser(STUDENT_EMAIL, "student");
  const facultyId = await ensureUser(FACULTY_EMAIL, "faculty");
  void adminId; void facultyId;
  const login = await request(app)
    .post("/auth/login")
    .send({ email: STUDENT_EMAIL, password: "Pes@12345" });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, "student");
  assert.equal(typeof login.body.accessToken, "string");
  const cookies = login.headers["set-cookie"];
  assert.ok(Array.isArray(cookies));
  const me = await request(app)
    .get("/auth/me")
    .set("Authorization", `Bearer ${login.body.accessToken}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, STUDENT_EMAIL);
  const blocked = await request(app)
    .post("/geofences")
    .set("Authorization", `Bearer ${login.body.accessToken}`)
    .send({ roomName: "X", lat: 0, lng: 0, radiusM: 100 });
  assert.equal(blocked.status, 403);
  const adminLogin = await request(app)
    .post("/auth/login")
    .send({ email: ADMIN_EMAIL, password: "Pes@12345" });
  assert.equal(adminLogin.status, 200);
  const geo = await request(app)
    .post("/geofences")
    .set("Authorization", `Bearer ${adminLogin.body.accessToken}`)
    .send({ roomName: "Test Room", lat: 12.9, lng: 77.6, radiusM: 50 });
  assert.equal(geo.status, 201);
  const refresh = await request(app)
    .post("/auth/refresh")
    .set("Cookie", cookies.join("; "));
  assert.equal(refresh.status, 200);
  assert.equal(typeof refresh.body.accessToken, "string");
  const logout = await request(app).post("/auth/logout");
  assert.equal(logout.status, 204);
});

test.after(async () => {
  await prisma.profile.deleteMany({
    where: { id: { in: [
      (await prisma.authUser.findUnique({ where: { email: ADMIN_EMAIL } }))?.id ?? "",
      (await prisma.authUser.findUnique({ where: { email: STUDENT_EMAIL } }))?.id ?? "",
      (await prisma.authUser.findUnique({ where: { email: FACULTY_EMAIL } }))?.id ?? "",
    ].filter(Boolean) } },
  });
  await prisma.geofence.deleteMany({ where: { roomName: "Test Room" } });
  await prisma.authUser.deleteMany({
    where: { email: { in: [ADMIN_EMAIL, STUDENT_EMAIL, FACULTY_EMAIL] } },
  });
  await prisma.$disconnect();
});
