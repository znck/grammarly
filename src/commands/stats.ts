import { GrammarlyClient } from '@/client';
import { Registerable } from '@/interfaces';
import { injectable } from 'inversify';
import { commands, window } from 'vscode';

@injectable()
export class StatsCommand implements Registerable {
  constructor(private readonly client: GrammarlyClient) {}

  register() {
    return commands.registerCommand('grammarly.stats', this.execute.bind(this));
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
      // TODO: Add a button to create github issue.
      return;
    }

    try {
      const uri = document.uri.toString();
      const {
        performance,
        content,
        readability,
        vocabulary,
      } = await this.client.getStatistics(uri);

      await window.showInformationMessage(
        `
        Text Score: ${performance.score} out of 100.  
        This score represents the quality of writing in this document. ${
          performance.score < 100
            ? `You can increase it by addressing Grammarly's suggestions.`
            : ''
        } 

        Word Count:
        
        Characters ${content.characters}
        Words ${content.words}
        Sentences ${content.sentences}
        Reading time ${content.readingTime}
        Speaking time ${content.speakingTime}


        Readability:

        Word length ${readability.wordLength}
        Sentence length ${readability.sentenceLength}
        Readability score ${readability.score}

        ${readability.message}

        Vocabulary:

        Unique words ${vocabulary.uniqueWords}%
        Rare words ${vocabulary.rareWords}%
        `.replace(/^[ \t]+/gm, ''),
        { modal: true }
      );
    } catch (error) {
      window.showErrorMessage(`Grammarly: ${error.message}`);
      // TODO: Add report url.
    }
  }
}
