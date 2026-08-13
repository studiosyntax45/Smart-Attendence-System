

const API_BASE_URL = process.env.VITE_API_BASE_URL ?? "http://localhost:4000";

const USERS = [
  { email: "student@pesu.pesu.pes.edu", fullName: "Demo Student" },
  { email: "faculty@pesu.pesu.pes.edu", fullName: "Demo Faculty" },
  { email: "admin@pesu.pesu.pes.edu", fullName: "Demo Admin" },
];
const PASSWORD = "Pes@12345";

for (const u of USERS) {
  process.stdout.write(`${u.email} ... `);

  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: u.email,
        password: PASSWORD,
        fullName: u.fullName,
      }),
    });

    if (res.status === 409) {
      console.log("already registered");
    } else if (res.ok) {
      console.log("created");
    } else {
      const data = await res.json().catch(() => ({}));
      console.log(`FAILED (${res.status}): ${data.error ?? "unknown error"}`);
    }
  } catch (err) {
    console.log(`FAILED (network error): ${err.message}`);
  }
}

console.log(`\nDone. Password for demo users: ${PASSWORD}`);


