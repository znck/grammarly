export interface PlagiarismExtraProperties {
  source: 'WEB_PAGE' | 'PUBLICATION';
  percent: string;
  title: string;
  authors: string;
  reference_apa: string;
  reference_chicago: string;
  reference_mla: string;
}
