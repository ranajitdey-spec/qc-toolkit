import type { Config, DriveStep } from "driver.js";

export type TourStep = DriveStep;

/**
 * Lazy-loads driver.js on first use and starts a tour with the given steps.
 * Nothing imports driver.js until this is actually called, so tools that
 * never use a tour pay zero cost for it.
 */
export async function startTour(steps: TourStep[], overrides?: Partial<Config>) {
  const { driver } = await import("driver.js");
  await import("driver.js/dist/driver.css");
  await import("../styles/tour-theme.css");

  const tour = driver({
    showProgress: true,
    overlayColor: "#1c1b19",
    overlayOpacity: 0.75,
    animate: true,
    ...overrides,
    steps,
  });

  tour.drive();
  return tour;
}