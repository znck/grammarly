import { ExtensionContext, commands } from 'vscode';
import {
  setCredentials,
  getCredentials,
  init,
} from '@/shared/credentialsStore';
import { multiStepInput } from '@/client/multiStepInput';
import createLogger from 'debug';
import { getGrammarlyClient } from '..';

const debug = createLogger('grammarly:set-credentials');

export async function registerSetCredentials(context: ExtensionContext) {
  init();
  const client = getGrammarlyClient();
  const credentials = await getCredentials();
  if (credentials) {
    client.setCredentials(credentials.username, credentials.password);
  }

  context.subscriptions.push(
    commands.registerCommand('grammarly.setCredentials', async () => {
      const { username, password } = await multiStepInput();
      await setCredentials(username, password);
      const client = getGrammarlyClient();
      await client.setCredentials(username, password);
    })
  );
}
