import * as keytarType from 'keytar';
import { AuthParams } from './socket';

function getNodeModule<T>(moduleName: string): T | undefined {
    const vscodeRequire = eval('require');
    try {
        return vscodeRequire(moduleName);
    } catch (err) {
    }
    return undefined;
}

export type KeyChain = {
    getPassword: typeof keytarType['getPassword'];
    setPassword: typeof keytarType['setPassword'];
    deletePassword: typeof keytarType['deletePassword'];
    findCredentials: typeof keytarType['findCredentials'];
};

export const failingKeyChain: KeyChain = {
    async getPassword() { throw new Error('System keychain unavailable'); },
    async setPassword() { throw new Error('System keychain unavailable'); },
    async deletePassword() { throw new Error('System keychain unavailable'); },
    async findCredentials() { throw new Error('System keychain unavailable'); },
};

const systemKeyChain =getNodeModule<KeyChain>('keytar') || failingKeyChain;
const SERVICE_ID = 'vscode-grammarly';
let defaultKeychain: KeyChain = failingKeyChain;

export function init(keychain: KeyChain = systemKeyChain) {
    defaultKeychain = keychain;
}

export async function setCredentials(username: string, password: string, {  keychain = defaultKeychain } = {}) {
    if (!password) { return deletePassword(username, { keychain }); }
    await keychain?.setPassword(SERVICE_ID, username, password)
}

export async function deletePassword(username: string, { keychain = defaultKeychain } = {}) {
    await keychain?.deletePassword(SERVICE_ID, username)
}

export async function getCredentials({ keychain = defaultKeychain } = {}) : Promise<AuthParams> {
   const credentials = await keychain?.findCredentials(SERVICE_ID)
   if (credentials && credentials.length > 0) {
       return {
           username: credentials[0].account,
           password: credentials[0].password
       }
   }
   return (undefined as unknown) as AuthParams
}
