import { KeyChain } from "./credentialsStore";

export const inMemoryKeyChain = (
  accounts: Record<string, string>
): KeyChain => {
  let keyChainAccounts = accounts;

  return {
    getPassword: async (service: string, account: string) => {
      return keyChainAccounts[account];
    },
    setPassword: async (service: string, account: string, password: string) => {
      keyChainAccounts[account] = password;
    },
    deletePassword: async (service: string, account: string) => {
      delete keyChainAccounts[account];
      return true;
    },
    findCredentials: async (
      service: string
    ): Promise<Array<{ account: string; password: string }>> => {
      return Object.entries(keyChainAccounts).map(([key, val]) => ({
        account: key,
        password: val
      }));
    }
  } as KeyChain;
};
