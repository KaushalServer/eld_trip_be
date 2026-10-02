import Trip from "../models/trip.model.js";

import { buildRoute } from "../services/routingService.js";
import {
  buildHosSchedule,
} from "../services/hosService.js";

import {
  createEldPdf,
} from "../services/pdfService.js";


const publicTrip = (trip) => ({
  id: trip._id.toString(),

  current_location:
    trip.current_location,

  pickup_location:
    trip.pickup_location,

  dropoff_location:
    trip.dropoff_location,

  cycle_used_hours:
    trip.cycle_used_hours,

  trip_start_date:
    trip.trip_start_date,

  status:
    trip.status,

  created_at:
    trip.createdAt,

  updated_at:
    trip.updatedAt,

  distance_miles:
    trip.distance_miles,

  route_duration_hours:
    trip.route_duration_hours,

  route_geojson:
    trip.route_geojson || null,

  route_points:
    trip.route_points || null,
});


async function listTrips(req, res) {
  const trips = await Trip.find({
    user: req.user._id,
  }).sort({
    createdAt: -1,
  });

  res.json(
    trips.map(publicTrip)
  );
}


async function createTrip(req, res) {
  const trip = await Trip.create({
    user: req.user._id,

    current_location:
      req.body.current_location.trim(),

    pickup_location:
      req.body.pickup_location.trim(),

    dropoff_location:
      req.body.dropoff_location.trim(),

    cycle_used_hours:
      req.body.cycle_used_hours,

    trip_start_date:
      req.body.trip_start_date,
  });

  res
    .status(201)
    .json(publicTrip(trip));
}


async function getTrip(req, res) {
  const trip = await Trip.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!trip) {
    return res.status(404).json({
      detail: "Trip not found.",
    });
  }

  res.json(
    publicTrip(trip)
  );
}


async function deleteTrip(req, res) {
  const result = await Trip.deleteOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!result.deletedCount) {
    return res.status(404).json({
      detail: "Trip not found.",
    });
  }

  res.status(204).end();
}


async function planTrip(req, res) {
  const trip = await Trip.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!trip) {
    return res.status(404).json({
      detail: "Trip not found.",
    });
  }

  try {
    const route = await buildRoute(
      trip.current_location,
      trip.pickup_location,
      trip.dropoff_location
    );

    const schedule =
      buildHosSchedule(
        route.distance_miles,
        route.duration_hours,
        trip.cycle_used_hours,
        trip.trip_start_date
      );

    trip.distance_miles =
      route.distance_miles;

    trip.route_duration_hours =
      route.duration_hours;

    trip.route_geojson =
      route.geojson;

    trip.route_points =
      route.points;

    trip.status =
      "PLANNED";

    await trip.save();

    res.json({
      trip: publicTrip(trip),
      route,
      schedule,
    });

  } catch (err) {
    console.error(err);

    res
      .status(err.response ? 502 : 400)
      .json({
        detail:
          err.message ||
          "Planning failed.",
      });
  }
}


async function eldPdf(req, res) {
  const trip = await Trip.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!trip) {
    return res.status(404).json({
      detail: "Trip not found.",
    });
  }

  if (
    trip.distance_miles == null ||
    trip.route_duration_hours == null
  ) {
    return res.status(400).json({
      detail:
        "Plan the trip before generating ELD logs.",
    });
  }

  try {
    const schedule =
      buildHosSchedule(
        trip.distance_miles,
        trip.route_duration_hours,
        trip.cycle_used_hours,
        trip.trip_start_date
      );

    const pdf =
      await createEldPdf(
        trip,
        schedule
      );

    res.set(
      "Content-Type",
      "application/pdf"
    );

    res.set(
      "Content-Disposition",
      `attachment; filename="trip-${trip._id}-eld.pdf"`
    );

    res.send(pdf);

  } catch (err) {
    res.status(500).json({
      detail: err.message,
    });
  }
}


export {
  listTrips,
  createTrip,
  getTrip,
  deleteTrip,
  planTrip,
  eldPdf,
};