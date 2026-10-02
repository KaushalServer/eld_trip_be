const NOMINATIM_URL =
  process.env.NOMINATIM_URL ||
  "https://nominatim.openstreetmap.org/search";

const OSRM_URL =
  process.env.OSRM_URL ||
  "https://router.project-osrm.org/route/v1/driving";

const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ||
  "eld-trip-planner/2.0";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function geocode(query) {
  const url = new URL(NOMINATIM_URL);

  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Geocoding request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (!data?.length) {
    throw new Error(`Could not geocode location: ${query}`);
  }

  const item = data[0];

  // Respect Nominatim request spacing.
  await sleep(1000);

  return {
    display_name: item.display_name,
    lat: Number(item.lat),
    lon: Number(item.lon),
  };
}

async function buildRoute(current, pickup, dropoff) {
  const points = [
    { ...(await geocode(current)), name: "Current location" },
    { ...(await geocode(pickup)), name: "Pickup" },
    { ...(await geocode(dropoff)), name: "Dropoff" },
  ];

  const coordinates = points
    .map((point) => `${point.lon},${point.lat}`)
    .join(";");

  const url = new URL(`${OSRM_URL}/${coordinates}`);

  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "true");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Routing request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (data?.code !== "Ok" || !data.routes?.length) {
    throw new Error("Routing service could not find a route.");
  }

  const route = data.routes[0];

  return {
    points,

    distance_miles: Number(
      (route.distance / 1609.344).toFixed(2)
    ),

    duration_hours: Number(
      (route.duration / 3600).toFixed(2)
    ),

    geojson: route.geometry,

    steps: route.legs || [],
  };
}

export { geocode, buildRoute };