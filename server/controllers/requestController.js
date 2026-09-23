const requests = [];

// 🧠 AI Priority Logic
const calculatePriority = (type, people, urgency) => {
  let score = 0;

  if (urgency === "high") score += 50;
  else if (urgency === "medium") score += 30;
  else score += 10;

  score += Math.min(Number(people) * 5, 30);

  if (type === "medical") score += 20;
  else if (type === "food") score += 10;
  else score += 5;

  return score;
};

// Create Request
exports.createRequest = (req, res) => {
  const { type, location, people, urgency } = req.body;

  const priorityScore = calculatePriority(type, people, urgency);

  const newRequest = {
    id: Date.now(),
    type,
    location,
    people,
    urgency,
    priorityScore,
    status: "pending",
  };

  requests.push(newRequest);

  res.json({
    message: "Request created successfully",
    data: newRequest,
  });
};

// Get Requests (sorted)
exports.getRequests = (req, res) => {
  const sorted = [...requests].sort(
    (a, b) => b.priorityScore - a.priorityScore
  );
  res.json(sorted);
};