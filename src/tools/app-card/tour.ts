import type { TourStep } from "../../lib/tour";

export const appCardTour: TourStep[] = [
  {
    element: "#raw",
    popover: {
      title: "Paste the App Only Card email",
      description: "Paste the whole email here — Q1, font color, tags, red line, and green line get pulled out automatically.",
    },
  },
  {
    element: "#meta-card",
    popover: {
      title: "Extracted values",
      description: "Each field has its own Copy button — red/green lines are auto-capitalized with trailing-period spacing cleaned up.",
    },
  },
  {
    element: "#base-id",
    popover: {
      title: "Enter the Base ID first",
      description: "This is the card number used to build every renamed filename below — required before you can select files.",
    },
  },
  {
    element: "#classify-file-input",
    popover: {
      title: "Upload all four files at once",
      description: "Video, background, thumbnail, and icon — order doesn't matter. Each gets classified by extension and dimensions, same rules as your original script.",
    },
  },
  {
    popover: {
      title: "Icon files and unrecognized files",
      description:
        "An icon matching \"prefix-number\" auto-renumbers (+10). One that doesn't match gives you a box to type it manually. Anything that doesn't fit any rule shows \"Unrecognized — not renamed\" in red with its original name untouched, so you always notice a wrong or unexpected file.",
    },
  },
  {
    popover: {
      title: "Generating the _pc image",
      description:
        "Once a video is classified, a scrubber appears below the table, defaulting to the last frame — matches how you'd normally grab it. Drag to any exact moment, capture, rename, and download, lightly compressed automatically.",
    },
  },
];