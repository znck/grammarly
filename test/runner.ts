import glob from 'fast-glob';
import Mocha from 'mocha';

export async function run(): Promise<void> {
  const directory = __dirname;
  const mocha = new Mocha({
    ui: 'tdd',
    timeout: 100000,
    useColors: true,
  });
  const files = await glob('**/*.spec.js', { cwd: directory, absolute: true });
  files.forEach((file) => mocha.addFile(file));

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}
