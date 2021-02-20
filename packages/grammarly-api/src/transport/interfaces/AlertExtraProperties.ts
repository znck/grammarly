import { EmogenieExtraProperties } from './EmogenieExtraProperties';
import { FluencyExtraProperties } from './FluencyExtraProperties';
import { PlagiarismExtraProperties } from './PlagiarismExtraProperties';
import { VoxExtraProperties } from './VoxExtraProperties';

export type AlertExtraProperties = Partial<
  {
    add_to_dict: string;
    did_you_mean: string;
    show_title: string;
    enhancement: string;
    url: string;
    sentence: string;
    priority: string;

    // C+E checks
    progress: number;
  } & PlagiarismExtraProperties &
    VoxExtraProperties &
    FluencyExtraProperties &
    EmogenieExtraProperties
>;
