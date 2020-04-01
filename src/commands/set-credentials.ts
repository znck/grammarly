import { Registerable } from '@/interfaces';
import { injectable } from 'inversify';
import { commands, window, QuickInputButtons, InputBox } from 'vscode';
import keytar from 'keytar';
import { Disposable } from 'vscode-languageclient';
import { AuthParams } from '@/server/socket';
import { authenticate } from '@/server/grammarly/auth';

@injectable()
export class SetCredentialsCommand implements Registerable {
  register() {
    return commands.registerCommand(
      'grammarly.set-credentials',
      this.execute.bind(this)
    );
  }

  private async execute() {
    const credenials = await keytar.findCredentials('vscode-grammarly');
    const currentData: AuthParams = { username: '', password: '' };

    if (credenials.length) {
      currentData.username = credenials[0].account;
      currentData.password = credenials[0].password;
    }

    const newData = await form<AuthParams>('Login to grammarly.com', [
      input('username', 'Username', {
        placeholder: 'username',
        value: currentData.username,
      }),
      input('password', 'Password', {
        placeholder: 'password',
        validate: async (password, { username }) => {
          await authenticate(username, password);
        },
        value: currentData.password,
      }),
    ]).run();

    if (newData) {
      keytar.setPassword(
        'vscode-grammarly',
        newData.username,
        newData.password
      );
      window.showInformationMessage(
        `Logged in to grammarly.com as ${newData.username}.`
      );
    }
  }
}

interface InputRenderOptions {
  value?: string;
}

interface InputOptions<T> {
  placeholder: string;
  value: string;
  validate(value: string, data: T): Promise<void>;
}

interface FormField<T> {
  name: string;
  render: (props: InputRenderOptions) => InputBox;
  onAccept?(
    field: InputBox,
    data: T,
    next: (error?: Error) => void
  ): Promise<void>;
}

function input<T>(
  name: string,
  label: string,
  options: Partial<InputOptions<T>> = {}
): FormField<T> {
  return {
    name,
    onAccept: options.validate
      ? async (field, data, next) => {
          const prompt = field.prompt;
          try {
            field.prompt = 'Validating ...';
            await options.validate!(field.value, data);
            field.validationMessage = undefined;
            next();
          } catch (error) {
            field.validationMessage = error.message;
            next(error);
          } finally {
            field.prompt = prompt;
          }
        }
      : undefined,
    render: (props: InputRenderOptions) => {
      const field = window.createInputBox();

      field.prompt = label;
      field.value = props.value || options.value || '';
      field.placeholder = options.placeholder;

      return field;
    },
  };
}

function form<T extends {}>(label: string, fields: FormField<T>[]) {
  const run = async () => {
    const data: any = {};
    const disposables: Disposable[] = [];

    try {
      for (let index = 1; index <= fields.length; ++index) {
        const field = fields[index - 1];
        const input = field.render({ value: data[field.name] });

        input.title = label;
        input.step = index;
        input.totalSteps = fields.length;

        disposables.push(input);

        const exec = () =>
          new Promise((resolve, reject) => {
            if (index > 1) {
              input.buttons = [QuickInputButtons.Back];
            }

            disposables.push(
              input.onDidAccept(() => {
                if (field.onAccept) {
                  input.busy = true;
                  input.enabled = false;
                  input.ignoreFocusOut = true;
                  field.onAccept(input, data, async error => {
                    input.busy = false;
                    input.enabled = true;
                    input.ignoreFocusOut = false;
                    if (error) resolve(await exec());
                    else resolve();
                  });
                } else {
                  resolve();
                }
              }),
              input.onDidChangeValue(() => {
                input.validationMessage = undefined;
              }),
              input.onDidTriggerButton(button => {
                if (button === QuickInputButtons.Back) {
                  --index;
                  resolve();
                } else {
                  reject(new Error('Unexpected extra button.'));
                }
              })
            );

            input.show();
          });

        await exec();

        data[field.name] = input.value;
        disposables.forEach(disposable => disposable.dispose());
      }

      return data as T;
    } catch (error) {
      disposables.forEach(disposable => disposable.dispose());

      return null;
    }
  };

  return { run };
}
