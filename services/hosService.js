const HOS_RULES = {
  max_driving_hours_per_shift: 11,
  max_window_hours: 14,
  required_off_duty_before_shift: 10,
  break_after_driving_hours: 8,
  break_duration_hours: 0.5,
  cycle_limit_hours: 70,
  cycle_days: 8,
  fuel_interval_miles: 1000,
  pickup_hours: 1,
  dropoff_hours: 1,
};


/*
|--------------------------------------------------------------------------
| Date / Event Helpers
|--------------------------------------------------------------------------
*/

function isoAt(day, hour) {
  const date = new Date(`${day}T00:00:00Z`);

  date.setUTCHours(
    date.getUTCHours() + hour
  );

  return date
    .toISOString()
}


function addDays(day, amount) {
  const date =
    new Date(`${day}T00:00:00Z`);

  date.setUTCDate(
    date.getUTCDate() + amount
  );

  return date
    .toISOString()
    .slice(0, 10);
}


function event(
  day,
  startHour,
  duration,
  type,
  label,
  miles = 0
) {
  return {
    type,

    status: type,

    label,

    start: isoAt(
      day,
      startHour
    ),

    end: isoAt(
      day,
      startHour + duration
    ),

    duration_hours:
      Number(
        duration.toFixed(2)
      ),

    miles:
      Number(
        miles.toFixed(2)
      ),
  };
}


/*
|--------------------------------------------------------------------------
| Convert Timestamp → Hour
|--------------------------------------------------------------------------
*/

function getUtcHour(dateTime) {
  const date =
    new Date(dateTime);

  return (
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600
  );
}


/*
|--------------------------------------------------------------------------
| Normalize Daily ELD Timeline
|--------------------------------------------------------------------------
|
| The scheduling engine creates operational events:
|
| Sleeper
| Pickup
| Driving
| Break
| Fuel
| Dropoff
|
| But an ELD graph represents a complete 24-hour day.
|
| This helper fills otherwise-unscheduled portions of the planned timeline
| with OFF_DUTY so the UI can draw continuously from 00:00 → 24:00.
|
*/

function normalizeEldDay(
  date,
  rawEvents
) {
  const sorted =
    [...rawEvents].sort(
      (a, b) =>
        new Date(a.start) -
        new Date(b.start)
    );

  /*
   * No events at all:
   * entire day is off duty.
   */
  if (!sorted.length) {
    return [
      event(
        date,
        0,
        24,
        "OFF_DUTY",
        "Off duty"
      ),
    ];
  }

  const normalized = [];

  let cursor = 0;

  for (const item of sorted) {
    const startDate =
      new Date(item.start);

    const endDate =
      new Date(item.end);

    const startDay =
      startDate
        .toISOString()
        .slice(0, 10);

    const endDay =
      endDate
        .toISOString()
        .slice(0, 10);

    let startHour =
      getUtcHour(item.start);

    let endHour;

    /*
     * If an event crosses midnight,
     * this day's portion ends at 24:00.
     */
    if (startDay !== endDay) {
      endHour = 24;
    } else {
      endHour =
        getUtcHour(item.end);
    }

    startHour =
      Math.max(
        0,
        Math.min(
          24,
          startHour
        )
      );

    endHour =
      Math.max(
        startHour,
        Math.min(
          24,
          endHour
        )
      );

    /*
     * Fill any unexplained gap.
     */
    if (
      startHour >
      cursor + 0.001
    ) {
      normalized.push(
        event(
          date,
          cursor,
          startHour - cursor,
          "OFF_DUTY",
          "Off duty"
        )
      );
    }

    /*
     * Add actual scheduled event.
     */
    normalized.push(item);

    cursor =
      Math.max(
        cursor,
        endHour
      );
  }

  /*
   * Complete remainder of day.
   */
  if (
    cursor <
    24 - 0.001
  ) {
    normalized.push(
      event(
        date,
        cursor,
        24 - cursor,
        "OFF_DUTY",
        "Off duty"
      )
    );
  }

  return normalized;
}


/*
|--------------------------------------------------------------------------
| Build HOS Schedule
|--------------------------------------------------------------------------
*/

function buildHosSchedule(
  routeMiles,
  routeHours,
  cycleUsedHours,
  startDate
) {
  /*
  |--------------------------------------------------------------------------
  | Validation
  |--------------------------------------------------------------------------
  */

  if (
    routeMiles < 0 ||
    routeHours < 0
  ) {
    throw new Error(
      "Route values cannot be negative."
    );
  }

  if (
    cycleUsedHours < 0 ||
    cycleUsedHours > 70
  ) {
    throw new Error(
      "Cycle used hours must be between 0 and 70."
    );
  }

  let cycle =
    Number(cycleUsedHours);

  if (
    70 - cycle <= 0
  ) {
    throw new Error(
      "No cycle hours remain. A restart/rest period is required before planning this trip."
    );
  }


  /*
  |--------------------------------------------------------------------------
  | Trip State
  |--------------------------------------------------------------------------
  */

  let remainingDrive =
    Number(routeHours);

  const fuelDistances = [];

  for (
    let miles = 1000;
    miles < routeMiles;
    miles += 1000
  ) {
    fuelDistances.push(
      miles
    );
  }


  const events = [];

  let day = startDate;

  let dayHour = 0;

  let drivingToday = 0;

  let windowUsed = 0;

  let driveSinceBreak = 0;

  let milesTravelled = 0;

  let fuelIndex = 0;

  let pickupDone = false;


  const avgSpeed =
    routeHours > 0
      ? routeMiles /
        routeHours
      : 45;


  /*
  |--------------------------------------------------------------------------
  | Shift Reset
  |--------------------------------------------------------------------------
  */

  function resetShift() {
    day =
      addDays(
        day,
        1
      );

    dayHour = 0;

    drivingToday = 0;

    windowUsed = 0;

    driveSinceBreak = 0;

    events.push(
      event(
        day,
        0,
        HOS_RULES
          .required_off_duty_before_shift,
        "SLEEPER",
        "10-hour reset/rest"
      )
    );

    dayHour =
      HOS_RULES
        .required_off_duty_before_shift;
  }


  /*
  |--------------------------------------------------------------------------
  | Initial Rest
  |--------------------------------------------------------------------------
  */

  events.push(
    event(
      day,
      0,
      HOS_RULES
        .required_off_duty_before_shift,
      "SLEEPER",
      "10-hour reset/rest"
    )
  );

  dayHour =
    HOS_RULES
      .required_off_duty_before_shift;


  /*
  |--------------------------------------------------------------------------
  | Main Scheduling Loop
  |--------------------------------------------------------------------------
  */

  while (
    remainingDrive > 0.001 ||
    !pickupDone
  ) {
    /*
     * 70/8 cycle exhausted.
     */
    if (
      cycle >=
      HOS_RULES
        .cycle_limit_hours -
        0.001
    ) {
      throw new Error(
        "Trip cannot be completed within the remaining 70/8 cycle hours."
      );
    }


    /*
    |--------------------------------------------------------------------------
    | Pickup
    |--------------------------------------------------------------------------
    */

    if (!pickupDone) {
      const duration =
        HOS_RULES.pickup_hours;

      if (
        windowUsed +
          duration >
        HOS_RULES
          .max_window_hours
      ) {
        resetShift();

        continue;
      }

      events.push(
        event(
          day,
          dayHour,
          duration,
          "ON_DUTY",
          "Pickup"
        )
      );

      dayHour += duration;

      windowUsed +=
        duration;

      cycle += duration;

      pickupDone = true;

      continue;
    }


    /*
    |--------------------------------------------------------------------------
    | 30-Minute Break
    |--------------------------------------------------------------------------
    */

    if (
      driveSinceBreak >=
      HOS_RULES
        .break_after_driving_hours -
        0.001
    ) {
      const breakDuration =
        HOS_RULES
          .break_duration_hours;

      if (
        dayHour +
          breakDuration >
          24 ||
        windowUsed +
          breakDuration >
          HOS_RULES
            .max_window_hours
      ) {
        resetShift();

        continue;
      }

      events.push(
        event(
          day,
          dayHour,
          breakDuration,
          "OFF_DUTY",
          "30-minute driving break"
        )
      );

      dayHour +=
        breakDuration;

      windowUsed +=
        breakDuration;

      driveSinceBreak = 0;

      continue;
    }


    /*
    |--------------------------------------------------------------------------
    | Shift Limits
    |--------------------------------------------------------------------------
    */

    if (
      drivingToday >=
        HOS_RULES
          .max_driving_hours_per_shift -
          0.001 ||
      windowUsed >=
        HOS_RULES
          .max_window_hours -
          0.001
    ) {
      resetShift();

      continue;
    }


    /*
    |--------------------------------------------------------------------------
    | Determine Driving Segment
    |--------------------------------------------------------------------------
    */

    const nextFuel =
      fuelDistances[
        fuelIndex
      ];

    let maxDrive =
      Math.min(
        HOS_RULES
          .max_driving_hours_per_shift -
          drivingToday,

        HOS_RULES
          .max_window_hours -
          windowUsed,

        remainingDrive
      );


    /*
     * Stop at next fuel point.
     */
    if (
      nextFuel !==
      undefined
    ) {
      maxDrive =
        Math.min(
          maxDrive,

          (
            nextFuel -
            milesTravelled
          ) /
            avgSpeed
        );
    }


    /*
     * Never drive beyond midnight.
     */
    maxDrive =
      Math.min(
        maxDrive,
        24 - dayHour
      );


    if (
      maxDrive <=
      0.001
    ) {
      resetShift();

      continue;
    }


    /*
    |--------------------------------------------------------------------------
    | Driving Event
    |--------------------------------------------------------------------------
    */

    const milesSegment =
      maxDrive *
      avgSpeed;

    events.push(
      event(
        day,
        dayHour,
        maxDrive,
        "DRIVING",
        "Driving",
        milesSegment
      )
    );


    dayHour +=
      maxDrive;

    drivingToday +=
      maxDrive;

    windowUsed +=
      maxDrive;

    driveSinceBreak +=
      maxDrive;

    cycle +=
      maxDrive;

    remainingDrive -=
      maxDrive;

    milesTravelled +=
      milesSegment;


    /*
    |--------------------------------------------------------------------------
    | Fuel Stop
    |--------------------------------------------------------------------------
    */

    if (
      nextFuel !==
        undefined &&
      milesTravelled >=
        nextFuel - 0.5
    ) {
      const fuelDuration =
        0.5;

      if (
        dayHour +
          fuelDuration <=
          24 &&
        windowUsed +
          fuelDuration <=
          HOS_RULES
            .max_window_hours
      ) {
        events.push(
          event(
            day,
            dayHour,
            fuelDuration,
            "ON_DUTY",
            "Fuel"
          )
        );

        dayHour +=
          fuelDuration;

        windowUsed +=
          fuelDuration;

        cycle +=
          fuelDuration;

        fuelIndex++;
      } else {
        resetShift();
      }
    }
  }


  /*
  |--------------------------------------------------------------------------
  | Dropoff
  |--------------------------------------------------------------------------
  */

  const dropoffDuration =
    HOS_RULES
      .dropoff_hours;

  if (
    windowUsed +
      dropoffDuration >
      HOS_RULES
        .max_window_hours ||

    drivingToday >=
      HOS_RULES
        .max_driving_hours_per_shift ||

    dayHour +
      dropoffDuration >
      24
  ) {
    resetShift();
  }


  events.push(
    event(
      day,
      dayHour,
      dropoffDuration,
      "ON_DUTY",
      "Dropoff"
    )
  );

  cycle +=
    dropoffDuration;


  /*
  |--------------------------------------------------------------------------
  | Group Events By Day
  |--------------------------------------------------------------------------
  */

  const grouped = {};

  for (
    const eventItem
    of events
  ) {
    const date =
      eventItem
        .start
        .slice(
          0,
          10
        );

    (
      grouped[date] ||=
      []
    ).push(
      eventItem
    );
  }


  /*
  |--------------------------------------------------------------------------
  | Build Complete Daily ELD Timelines
  |--------------------------------------------------------------------------
  */

  const days =
    Object.entries(
      grouped
    ).map(
      ([
        date,
        rawEvents,
      ]) => {
        /*
         * NEW:
         *
         * Convert operational events into a
         * complete 00:00 → 24:00 timeline.
         */
        const dayEvents =
          normalizeEldDay(
            date,
            rawEvents
          );

          console.log("\n========== ELD DAY DEBUG ==========");
          console.log("Date:", date);

          console.table(
            dayEvents.map((event) => ({
              type: event.type,
              label: event.label,
              start: event.start,
              end: event.end,
              duration: event.duration_hours,
            }))
          );

          console.log("===================================\n");


        /*
        |--------------------------------------------------------------------------
        | Daily Totals
        |--------------------------------------------------------------------------
        */

        const driving =
          dayEvents
            .filter(
              (item) =>
                item.type ===
                "DRIVING"
            )
            .reduce(
              (
                sum,
                item
              ) =>
                sum +
                item
                  .duration_hours,
              0
            );


        const onDuty =
          dayEvents
            .filter(
              (item) =>
                item.type ===
                  "ON_DUTY" ||
                item.type ===
                  "DRIVING"
            )
            .reduce(
              (
                sum,
                item
              ) =>
                sum +
                item
                  .duration_hours,
              0
            );


        const offDuty =
          dayEvents
            .filter(
              (item) =>
                item.type ===
                "OFF_DUTY"
            )
            .reduce(
              (
                sum,
                item
              ) =>
                sum +
                item
                  .duration_hours,
              0
            );


        const sleeper =
          dayEvents
            .filter(
              (item) =>
                item.type ===
                "SLEEPER"
            )
            .reduce(
              (
                sum,
                item
              ) =>
                sum +
                item
                  .duration_hours,
              0
            );


        return {
          date,

          events:
            dayEvents,

          driving_hours:
            Number(
              driving.toFixed(
                2
              )
            ),

          total_driving_hours:
            Number(
              driving.toFixed(
                2
              )
            ),

          on_duty_hours:
            Number(
              onDuty.toFixed(
                2
              )
            ),

          off_duty_hours:
            Number(
              offDuty.toFixed(
                2
              )
            ),

          sleeper_hours:
            Number(
              sleeper.toFixed(
                2
              )
            ),
        };
      }
    );


  /*
  |--------------------------------------------------------------------------
  | Result
  |--------------------------------------------------------------------------
  */

  return {
    cycle_used_start:
      Number(
        Number(
          cycleUsedHours
        ).toFixed(2)
      ),

    cycle_used_end_estimate:
      Number(
        cycle.toFixed(2)
      ),

    cycle_remaining_estimate:
      Number(
        Math.max(
          0,
          70 - cycle
        ).toFixed(2)
      ),

    days,

    assumptions:
      HOS_RULES,
  };
}


export {
  HOS_RULES,
  buildHosSchedule,
};