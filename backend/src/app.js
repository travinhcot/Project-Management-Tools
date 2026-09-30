import express from "express";

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(3001, () => {
  console.log("Backend running at http://localhost:3001");
});
