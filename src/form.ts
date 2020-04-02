import {
  Disposable,
  InputBox,
  QuickInputButtons,
  window,
  QuickPick,
  QuickPickItem,
} from 'vscode';
export interface InputRenderOptions {
  value?: string;
}
export interface InputOptions<T> {
  placeholder: string;
  value: string;
  validate(value: string, data: T): Promise<void>;
}

export interface SelectOption {
  placeholder: string;
  value: string;
  canSelectMany: boolean;
}

export interface FormField<T, F> {
  name: string;
  render: (props: InputRenderOptions) => F;
  onAccept?(field: F, data: T, next: (error?: Error) => void): Promise<void>;
}

export function input<T>(
  name: string,
  label: string,
  options: Partial<InputOptions<T>> = {}
): FormField<T, InputBox> {
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

export function select<T, R extends QuickPickItem>(
  name: string,
  label: string,
  items: R[],
  options: Partial<SelectOption> = {}
): FormField<T, QuickPick<R>> {
  return {
    name,
    render: (props: InputRenderOptions) => {
      const field = window.createQuickPick<R>();
      field.items = items;
      field.matchOnDescription = true;
      field.matchOnDetail = true;
      field.value = props.value || options.value || '';
      field.placeholder = label;
      field.canSelectMany =
        'canSelectMany' in options ? options.canSelectMany! : false;

      if (!field.canSelectMany) {
        const item = items.find(item => item.picked);

        if (item) {
          field.selectedItems = [item];
          field.activeItems = [item];
        }
      } else {
        field.selectedItems = items.filter(item => item.picked);
        field.activeItems = items.filter(item => item.picked);
      }

      return field;
    },
  };
}

export function form<T extends {}>(
  label: string,
  fields: FormField<T, InputBox | QuickPick<any>>[]
) {
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
                if ('validationMessage' in input) {
                  input.validationMessage = undefined;
                }
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
        data[field.name] =
          'selectedItems' in input
            ? input.selectedItems.length === 1
              ? input.selectedItems[0].label
              : input.selectedItems.map(item => item.label)
            : input.value;
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
