const BASE = "http://localhost:5000";

async function waitForServer(tries = 20) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "trainer@gmail.com", password: "Trainer@123", platform: "web" }),
      });
      if (r.ok) return await r.json();
    } catch (e) {
      // retry
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new Error("server not ready");
}

const lj = await waitForServer();
const token = lj.data?.accessToken;
console.log("token?", !!token, "role:", lj.data?.user?.role);

const me = await fetch(`${BASE}/me`, {
  headers: { Authorization: `Bearer ${token}` },
});
const mj = await me.json();
const u = mj.data?.user;
console.log("role:", u?.role);
console.log("roles:", JSON.stringify(u?.roles));
console.log("roleDocs:", JSON.stringify((u?.roleDocs || []).map((r) => ({ name: r?.name, mods: (r?.modules || []).length, perms: (r?.permissions || []).length }))));
console.log("permissions[:20]:", JSON.stringify((u?.permissions || []).slice(0, 20)));

const courses = await fetch(`${BASE}/courses?page=1&limit=5`, {
  headers: { Authorization: `Bearer ${token}` },
});
const cj = await courses.json();
const list = cj.data?.data || [];
console.log("\ncourses total:", cj.data?.total, "returned:", list.length);
list.slice(0, 5).forEach((c) => console.log("-", c.title, "| instructorId:", c.instructorId?._id || c.instructorId));

// Create a course as the trainer (multipart)
const form = new FormData();
form.append("title", "Trainer Test Course");
form.append("topic", "Trainer Topic");
form.append("description", "desc");
form.append("language", "English");
form.append("level", "beginner");
form.append("price", "0");
form.append("instructorId", u._id);

const cc = await fetch(`${BASE}/courses/`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const ccj = await cc.json();
console.log("\ncreate course:", cc.status, ccj.success, ccj.message || "");
if (ccj.data?.course) {
  console.log("created as instructorId:", ccj.data.course.instructorId);
}

// Re-list
const c2 = await fetch(`${BASE}/courses?page=1&limit=20`, {
  headers: { Authorization: `Bearer ${token}` },
});
const c2j = await c2.json();
const list2 = c2j.data?.data || [];
console.log("\ntrainer courses now:", c2j.data?.total);
list2.forEach((c) => console.log("-", c.title, "| inst:", c.instructorId?._id || c.instructorId));

// Check trainer cannot access admin-only role pages
const rl = await fetch(`${BASE}/roles/users`, {
  headers: { Authorization: `Bearer ${token}` },
});
console.log("\n/roles/users status:", rl.status);
