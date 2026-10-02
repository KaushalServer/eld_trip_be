function validateCredentials(req, res, next) {
  const username = String(
    req.body?.username || ""
  ).trim();

  const password = String(
    req.body?.password || ""
  );

  if (
    !/^[a-zA-Z0-9._-]{3,40}$/.test(username)
  ) {
    return res.status(400).json({
      detail:
        "Username must be 3–40 characters and use letters, numbers, dot, underscore or hyphen.",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      detail:
        "Password must contain at least 6 characters.",
    });
  }

  req.body.username = username;
  req.body.password = password;

  next();
}

function validateTrip(req, res, next) {
  const fields = [
    "current_location",
    "pickup_location",
    "dropoff_location",
  ];

  for (const field of fields) {
    if (
      typeof req.body?.[field] !== "string" ||
      req.body[field].trim().length < 2
    ) {
      return res.status(400).json({
        detail: `${field}: Location is required.`,
      });
    }
  }

  const cycle = Number(
    req.body.cycle_used_hours
  );

  if (
    !Number.isFinite(cycle) ||
    cycle < 0 ||
    cycle > 70
  ) {
    return res.status(400).json({
      detail:
        "Cycle used must be between 0 and 70 hours.",
    });
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      req.body.trip_start_date
    )
  ) {
    return res.status(400).json({
      detail: "Trip start date is invalid.",
    });
  }

  req.body.cycle_used_hours = cycle;

  next();
}

export {
  validateCredentials,
  validateTrip,
};