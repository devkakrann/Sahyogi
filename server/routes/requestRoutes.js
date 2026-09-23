const express = require("express");
const router = express.Router();

const {
  createRequest,
  getRequests,
} = require("../controllers/requestController");

router.post("/create", createRequest);
router.get("/all", getRequests);

module.exports = router;