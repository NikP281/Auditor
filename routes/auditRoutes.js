const express = require("express");
const router = express.Router();

const auditController = require("../controllers/auditController");

router.post("/audit", auditController.runAudit);

module.exports = router;