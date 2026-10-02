import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const template = path.resolve(
  __dirname,
  "../blank-paper-log.png"
);

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function clampHour(value) {
  return Math.max(0, Math.min(24, Number(value)));
}

function hourFromDate(dateTime) {
  const date = new Date(dateTime);

  return (
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600
  );
}

function eventEndHour(event) {
  const start = new Date(event.start);
  const end = new Date(event.end);

  const startDay = start.toISOString().slice(0, 10);
  const endDay = end.toISOString().slice(0, 10);

  if (startDay !== endDay) {
    return 24;
  }

  return clampHour(hourFromDate(event.end));
}

function formatEventTime(dateTime) {
  const date = new Date(dateTime);

  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes()
  ).padStart(2, "0")}`;
}

/*
|--------------------------------------------------------------------------
| Create ELD PDF
|--------------------------------------------------------------------------
*/

function createEldPdf(trip, schedule) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: 0,
      autoFirstPage: false,
    });

    const chunks = [];

    doc.on("data", (chunk) => {
      chunks.push(chunk);
    });

    doc.on("error", reject);

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    /*
    |--------------------------------------------------------------------------
    | PDF dimensions
    |--------------------------------------------------------------------------
    */

    const pageW = 612;
    const pageH = 792;

    /*
     * Original template reference size.
     */
    const sourceW = 513;
    const sourceH = 518;

    /*
     * PDFKit uses TOP-LEFT as the coordinate origin.
     *
     * Therefore Y must NOT be inverted.
     */
    const tx = (x) =>
      (x / sourceW) * pageW;

    const ty = (y) =>
      (y / sourceH) * pageH;

    /*
    |--------------------------------------------------------------------------
    | Generate one PDF page per HOS day
    |--------------------------------------------------------------------------
    */

    for (const day of schedule.days) {
      doc.addPage();

      /*
      |--------------------------------------------------------------------------
      | Background ELD template
      |--------------------------------------------------------------------------
      */

      doc.image(template, 0, 0, {
        width: pageW,
        height: pageH,
      });

      doc
        .fillColor("black")
        .font("Helvetica")
        .fontSize(7);

      /*
      |--------------------------------------------------------------------------
      | Header information
      |--------------------------------------------------------------------------
      */

      doc.text(
        String(day.date || ""),
        tx(177),
        ty(24)
      );

      doc.text(
        String(trip.current_location || "").slice(0, 35),
        tx(66),
        ty(48)
      );

      doc.text(
        String(trip.dropoff_location || "").slice(0, 35),
        tx(286),
        ty(48)
      );

      /*
      |--------------------------------------------------------------------------
      | Daily totals
      |--------------------------------------------------------------------------
      */

      doc.text(
        Number(day.driving_hours || 0).toFixed(1),
        tx(80),
        ty(108)
      );

      doc.text(
        Number(day.on_duty_hours || 0).toFixed(1),
        tx(170),
        ty(108)
      );

      /*
      |--------------------------------------------------------------------------
      | ELD grid rows
      |--------------------------------------------------------------------------
      */

      const rows = {
        OFF_DUTY: 194,
        SLEEPER: 212,
        DRIVING: 230,
        ON_DUTY: 247,
      };

      const hourX = (hour) => {
        const normalizedHour =
          clampHour(hour);

        return tx(
          66 +
            (normalizedHour / 24) *
              (454 - 66)
        );
      };

      /*
      |--------------------------------------------------------------------------
      | Prepare events
      |--------------------------------------------------------------------------
      */

      const events = [...(day.events || [])]
        .filter(
          (event) =>
            Number(event.duration_hours) > 0
        )
        .sort(
          (a, b) =>
            new Date(a.start) -
            new Date(b.start)
        );

      /*
      |--------------------------------------------------------------------------
      | Draw continuous ELD status line
      |--------------------------------------------------------------------------
      */

      let previousEvent = null;

      for (const event of events) {
        const rowY =
          rows[event.type];

        if (rowY == null) {
          continue;
        }

        const startHour =
          clampHour(
            hourFromDate(event.start)
          );

        const endHour =
          eventEndHour(event);

        if (endHour <= startHour) {
          continue;
        }

        const x1 =
          hourX(startHour);

        const x2 =
          hourX(endHour);

        const y =
          ty(rowY);

        /*
         * Draw vertical transition from previous
         * duty status to current duty status.
         */
        if (previousEvent) {
          const previousRowY =
            rows[previousEvent.type];

          if (previousRowY != null) {
            doc
              .strokeColor("black")
              .lineWidth(1)
              .moveTo(
                x1,
                ty(previousRowY)
              )
              .lineTo(
                x1,
                y
              )
              .stroke();
          }
        }

        /*
         * Draw current horizontal duty segment.
         */
        doc
          .strokeColor("black")
          .lineWidth(1.5)
          .moveTo(x1, y)
          .lineTo(x2, y)
          .stroke();

        previousEvent = event;
      }

      /*
      |--------------------------------------------------------------------------
      | Trip summary
      |--------------------------------------------------------------------------
      */

      doc
        .fillColor("black")
        .font("Helvetica")
        .fontSize(6.5);

      doc.text(
        `Route: ${Number(
          trip.distance_miles || 0
        ).toFixed(1)} mi`,
        tx(66),
        ty(274)
      );

      doc.text(
        `Day driving: ${Number(
          day.driving_hours || 0
        ).toFixed(1)} hr`,
        tx(66),
        ty(286)
      );

      doc.text(
        `Day on duty: ${Number(
          day.on_duty_hours || 0
        ).toFixed(1)} hr`,
        tx(66),
        ty(298)
      );

      /*
      |--------------------------------------------------------------------------
      | Important trip events
      |--------------------------------------------------------------------------
      */

      const importantLabels = new Set([
        "Pickup",
        "Driving",
        "30-minute driving break",
        "Fuel",
        "10-hour reset/rest",
        "Dropoff",
      ]);

      const importantEvents =
        events
          .filter((event) =>
            importantLabels.has(event.label)
          )
          .slice(0, 12);

      let eventY = 318;

      doc
        .font("Helvetica-Bold")
        .fontSize(6.5)
        .text(
          "Trip Events",
          tx(66),
          ty(eventY)
        );

      eventY += 10;

      doc
        .font("Helvetica")
        .fontSize(6);

      for (const event of importantEvents) {
        const start =
          formatEventTime(event.start);

        const end =
          formatEventTime(event.end);

        const miles =
          Number(event.miles) > 0
            ? ` | ${Number(
                event.miles
              ).toFixed(1)} mi`
            : "";

        const text =
          `${start} - ${end} | ` +
          `${event.label}${miles}`;

        doc.text(
          text,
          tx(66),
          ty(eventY),
          {
            width: tx(388),
            lineBreak: false,
          }
        );

        eventY += 9;
      }

      /*
      |--------------------------------------------------------------------------
      | Disclaimer
      |--------------------------------------------------------------------------
      */

      doc
        .font("Helvetica")
        .fontSize(5.5)
        .fillColor("#444444")
        .text(
          "Generated by ELD Trip Planner — planned schedule, not certified ELD data",
          tx(66),
          ty(455),
          {
            width: tx(388),
          }
        );
    }

    doc.end();
  });
}

export { createEldPdf };