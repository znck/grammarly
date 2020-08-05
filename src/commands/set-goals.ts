import { GrammarlyClient } from '@/client';
import { Registerable } from '@/interfaces';
import { injectable } from 'inversify';
import { commands, window, workspace, ConfigurationTarget } from 'vscode';
import { form, select } from '@/form';
import { GrammarlySettings } from '@/settings';
import { Grammarly } from '@/server/grammarly';
import minimatch from 'minimatch';
import { toArray } from '../utils/toArray';

@injectable()
export class SetGoalsCommand implements Registerable {
  constructor(private readonly client: GrammarlyClient) {}

  register() {
    return commands.registerCommand('grammarly.setGoals', this.execute.bind(this));
  }

  private async execute() {
    if (!this.client.isReady()) return;
    if (!window.activeTextEditor) {
      window.showInformationMessage('No active text document found.');

      return;
    }

    const document = window.activeTextEditor.document;

    if (this.client.isIgnoredDocument(document)) {
      const ext = document.fileName.substr(document.fileName.lastIndexOf('.'));
      window.showInformationMessage(`The ${ext} filetype is not supported.`);
      return;
    }

    if (!workspace.getWorkspaceFolder(document.uri)) {
      window.showInformationMessage(`The file does not belong to current workspace.`);
      return;
    }

    const uri = document.uri.toString();
    const config = workspace.getConfiguration().get<GrammarlySettings>('grammarly')!;
    const override = config.overrides.find((override) =>
      toArray(override.files).some((pattern) => minimatch(uri, pattern))
    );
    const settings: Grammarly.DocumentContext = {
      audience: config.audience,
      dialect: config.dialect,
      domain: config.domain,
      emotion: config.emotion,
      emotions: config.emotions,
      goals: config.goals,
      style: config.style,
      ...override?.config,
    };

    const result = await form<Grammarly.DocumentContext>('Set Goals', [
      select('audience', 'Audience', [
        {
          label: 'general',
          description: 'Easy for anyone to read with minimal effort.',
          picked: settings.audience === 'general',
        },
        {
          label: 'knowledgeable',
          description: 'Requires focus to read and understand.',
          picked: settings.audience === 'knowledgeable',
        },
        {
          label: 'expert',
          description: 'May require rereading to understand.',
          picked: settings.audience === 'expert',
        },
      ]),
      select('dialect', 'Dialect', [
        {
          label: 'american',
          description: 'English (US)',
          picked: settings.dialect === 'american',
        },
        {
          label: 'british',
          description: 'English (UK)',
          picked: settings.dialect === 'british',
        },
      ]),
      select('domain', 'Domain', [
        {
          label: 'academic',
          picked: settings.domain === 'academic',
          description: 'Strictly applies all rules and formal writing conventions.',
        },
        {
          label: 'business',
          picked: settings.domain === 'business',
          description: 'Applies almost all rules, but allow some informal expressions.',
        },
        {
          label: 'general',
          picked: settings.domain === 'general',
          description: 'Applies most rules and conventions with medium strictness.',
        },
        {
          label: 'technical',
          picked: settings.domain === 'technical',
          description: 'Applies almost all rules, plus technical writing conventions.',
        },
        {
          label: 'casual',
          picked: settings.domain === 'casual',
          description: 'Applies most rules, but allow stylistic flexibility.',
        },
        {
          label: 'creative',
          picked: settings.domain === 'creative',
          description: 'Allows some intentional bending of rules and conventions.',
        },
      ]),
      select(
        'emotions',
        'Emotions: How do you want to sound?',
        [
          {
            label: 'neutral',
            picked: settings.emotions.includes('neutral' as Grammarly.WritingEmotion),
            description: '😐 Neutral',
          },
          {
            label: 'confident',
            picked: settings.emotions.includes('confident' as Grammarly.WritingEmotion),
            description: '🤝 Confident',
          },
          {
            label: 'joyful',
            picked: settings.emotions.includes('joyful' as Grammarly.WritingEmotion),
            description: '🙂 Joyful',
          },
          {
            label: 'optimistic',
            picked: settings.emotions.includes('optimistic' as Grammarly.WritingEmotion),
            description: '✌️ Optimistic',
          },
          {
            label: 'respectful',
            picked: settings.emotions.includes('respectful' as Grammarly.WritingEmotion),
            description: '🙌 Respectful',
          },
          {
            label: 'urgent',
            picked: settings.emotions.includes('urgent' as Grammarly.WritingEmotion),
            description: '⏰ Urgent',
          },
          {
            label: 'friendly',
            picked: settings.emotions.includes('friendly' as Grammarly.WritingEmotion),
            description: '🤗 Friendly',
          },
          {
            label: 'analytical',
            picked: settings.emotions.includes('analytical' as Grammarly.WritingEmotion),
            description: '📊 Analytical',
          },
        ],
        { canSelectMany: true }
      ),
      select(
        'goals',
        'Goals: What are you trying to do?',
        [
          {
            label: 'inform',
            picked: settings.goals.includes('inform' as Grammarly.DocumentGoal),
            description: 'Inform',
          },
          {
            label: 'describe',
            picked: settings.goals.includes('describe' as Grammarly.DocumentGoal),
            description: 'Describe',
          },
          {
            label: 'convince',
            picked: settings.goals.includes('convince' as Grammarly.DocumentGoal),
            description: 'Convince',
          },
          {
            label: 'tellStory',
            picked: settings.goals.includes('tellStory' as Grammarly.DocumentGoal),
            description: 'Tell A Story',
          },
        ],
        { canSelectMany: true }
      ),
    ]).run();

    if (result) {
      result.emotion = Grammarly.WritingTone.MILD;
      const config = workspace.getConfiguration('grammarly', document.uri);
      const overrides = config.get<GrammarlySettings['overrides']>('overrides') || [];
      const file = workspace.asRelativePath(document.uri);
      const pattern = `**/${file}`;
      const index = overrides.findIndex((override) => override.files.includes(pattern));

      if (index >= 0) {
        if (overrides[index].files.length === 1) {
          overrides[index].config = result;
        } else {
          overrides[index].files.splice(overrides[index].files.indexOf(pattern), 1);
          overrides.push({
            files: [pattern],
            config: result,
          });
        }
      } else {
        overrides.push({
          files: [pattern],
          config: result,
        });
      }

      await config.update('overrides', overrides, ConfigurationTarget.WorkspaceFolder);

      this.client.check(document.uri.toString());
    }
  }
}
