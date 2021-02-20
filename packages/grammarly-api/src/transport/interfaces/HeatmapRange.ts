import { IdHeatmap } from './IdHeatmap';

export interface HeatmapRange {
  id: IdHeatmap;
  begin: number;
  end: number;
  text: string;
  intensities: [number, number];
}
