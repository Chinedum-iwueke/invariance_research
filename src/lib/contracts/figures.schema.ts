import { z } from "zod";

export const figurePointSchema = z.object({
  x: z.union([z.string(), z.number()]),
  y: z.number(),
});

export const figureLegendItemSchema = z.object({
  key: z.string(),
  label: z.string(),
});

export const figureSeriesSchema = z.object({
  key: z.string(),
  label: z.string(),
  series_type: z.enum(["line", "area", "bar", "scatter"]),
  points: z.array(figurePointSchema),
});

export const figurePayloadSchema = z.object({
  figure_id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  type: z.enum(["line", "area", "bar", "histogram", "scatter", "fan", "table"]),
  series: z.array(figureSeriesSchema),
  x_label: z.string().optional(),
  y_label: z.string().optional(),
  legend: z.array(figureLegendItemSchema).optional(),
  note: z.string().optional(),
});
