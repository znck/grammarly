import { getGrammarlyClient } from '@/client';
import { isIgnoredDocument } from '@/client/utils';
import { commands, window } from 'vscode';
import { Disposable } from 'vscode-languageclient';

export function registerStatsCommand(): Disposable {
  return commands.registerCommand('grammarly.stats', async () => {
    const { activeTextEditor } = window;
    if (!activeTextEditor) return;

    const { document } = activeTextEditor;
    if (isIgnoredDocument(document)) return;

    const client = getGrammarlyClient();

    try {
      const uri = document.uri.toString();
      const {
        performance,
        content,
        readability,
        vocubulary,
      } = await client.getStatistics(uri);

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

        Unique words ${vocubulary.uniqueWords}%
        Rare words ${vocubulary.rareWords}%
        `.replace(/^[ \t]+/gm, ''),
        { modal: true }
      );
    } catch (error) {
      console.error(error);
    }
  });
}
