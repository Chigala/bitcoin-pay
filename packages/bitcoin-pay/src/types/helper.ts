export type LiteralString = string;

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export type PrettifyDeep<T> = {
  [K in keyof T]: T[K] extends object ? PrettifyDeep<T[K]> : T[K];
} & Record<string, never>;

export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
