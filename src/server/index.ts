import { Container } from 'inversify';
import 'reflect-metadata';
import {
  createConnection,
  Disposable,
  ProposedFeatures,
  ServerCapabilities,
} from 'vscode-languageserver';
import { CLIENT, CONNECTION, SERVER } from './constants';
import { ConfigurationService } from './services/configuration';
import { DictionaryService } from './services/dictionary';
import { DocumentService } from './services/document';
import { GrammarlyService } from './services/grammarly';

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

connection.onInitialize(params => {
  container.bind(CLIENT).toConstantValue(params.capabilities);

  disposables.push(
    container.get(ConfigurationService).register(),
    container.get(DocumentService).register(),
    container.get(DictionaryService).register(),
    container.get(GrammarlyService).register()
  );

  return {
    serverInfo: {
      name: 'Grammarly',
    },
    capabilities,
  };
});

connection.onExit(() => {
  disposables.forEach(disposable => disposable.dispose());
});

connection.listen();
