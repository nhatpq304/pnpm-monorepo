export const EnvironmentName = {
  Dev: 'dev',
  Prod: 'prod',
} as const satisfies Record<string, string>;

export type EnvironmentNameModel = (typeof EnvironmentName)[keyof typeof EnvironmentName];

export type EnvironmentModel = {
  readonly name: EnvironmentNameModel;
  readonly apiUrl: string;
};
