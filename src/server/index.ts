import 'reflect-metadata';

import { Container } from 'inversify';
import { createConnection, Disposable, ProposedFeatures, ServerCapabilities } from 'vscode-languageserver';
import { CONNECTION, SERVER, CLIENT } from '@/server/constants';
import { ConfigurationService } from '@/server/services/configuration';
import { DocumentService } from '@/server/services/DocumentService';
import { DictionaryService } from '@/server/services/dictionary';
import { GrammarlyDiagnosticsService } from '@/server/services/GrammarlyDiagnosticsService';

process.env.DEBUG = 'grammarly:*';

const disposables: Disposable[] = [];
const capabilities: ServerCapabilities = {};
const container = new Container({
  autoBindInjectable: true,
  defaultScope: 'Singleton',
});
const connection = createConnection(ProposedFeatures.all);

container.bind(CONNECTION).toConstantValue(connection);
container.bind(SERVER).toConstantValue(capabilities);

connection.onInitialize((params) => {
  container.bind(CLIENT).toConstantValue(params.capabilities);

  disposables.push(
    container.get(ConfigurationService).register(),
    container.get(DocumentService).register(),
    container.get(DictionaryService).register(),
    container.get(GrammarlyDiagnosticsService).register()
  );

  return {
    serverInfo: {
      name: 'Grammarly',
    },
    capabilities,
  };
});

connection.onExit(() => {
  disposables.forEach((disposable) => disposable.dispose());
});

connection.listen();
