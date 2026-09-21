import type { TourStep } from "../../lib/tour";

export const convertWebpTour: TourStep[] = [
  {
    element: "#file-input",
    popover: {
      title: "Upload JPG/PNG files",
      description: "Select multiple at once — each becomes its own row below, ready to convert.",
    },
  },
  {
    element: "#convert-btn",
    popover: {
      title: "Convert selected",
      description: "Encodes each selected file as lossless WebP — same pixels, usually a smaller file.",
    },
  },
  {
    popover: {
      title: "Download individually or all at once",
      description:
        "Once conversion finishes, each row gets its own Download link — and a \"Download all\" button appears above the table if you'd rather grab everything in one click.",
    },
  },
];