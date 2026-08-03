import axios from "axios";

const BASE = "http://localhost:5000";

(async () => {
  try {
    const login = await axios.post(`${BASE}/login`, {
      email: "trainer@gmail.com",
      password: "Trainer@123",
      platform: "web",
    }, { validateStatus: () => true });

    console.log("LOGIN status:", login.status);
    const user = login.data?.data?.user;
    const token = login.data?.data?.accessToken;
    console.log("user.role:", user?.role);
    console.log("user.roles:", JSON.stringify(user?.roles));

    if (token) {
      const me = await axios.get(`${BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      });
      console.log("/me status:", me.status);
      if (me.data?.data?.user) {
        const u = me.data.data.user;
        console.log("role:", u.role);
        console.log("roles:", JSON.stringify(u.roles));
        console.log("roleDocs names:", JSON.stringify((u.roleDocs || []).map((r) => r?.name)));
        console.log("permissions:", JSON.stringify(u.permissions));
      } else {
        console.log("no user in /me:", JSON.stringify(me.data));
      }
    } else {
      console.log("no token in login response:", JSON.stringify(login.data));
    }
  } catch (e) {
    console.error("ERR:", e.response ? JSON.stringify(e.response.data) : e.message);
  }
})();
