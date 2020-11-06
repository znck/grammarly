export function getKeyTar(): {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
  findPassword(service: string): Promise<string | null>;
  findCredentials(service: string): Promise<Array<{ account: string; password: string; }>>;
} {
  return eval('require')('keytar');
}
