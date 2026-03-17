const express = require("express");
const cors = require("cors");

const auditRoutes = require("./routes/auditRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", auditRoutes);

const PORT = 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});