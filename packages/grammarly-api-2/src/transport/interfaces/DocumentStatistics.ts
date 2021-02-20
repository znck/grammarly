export interface DocumentStatistics {
  words: number;
  chars: number;
  sentences: number;
  uniqueWords: number;
  uniqueWordsIndex: number;
  rareWords: number;
  rareWordsIndex: number;
  wordLength: number;
  wordLengthIndex: number;
  sentenceLength: number;
  sentenceLengthIndex: number;
  readabilityScore: number;
  readabilityDescription: string;
}
