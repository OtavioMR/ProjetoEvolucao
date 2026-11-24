export type SqlValue = string | number | null;
export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    ...params: SqlValue[]
  ): Promise<{ changes: number; lastInsertRowId: number }>;
  getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
  withTransactionAsync(work: () => Promise<void>): Promise<void>;
}

/** Toda consulta da aplicação passa por esta fila, inclusive leituras. */
export class DatabaseQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private readonly db: SqlConnection;
  constructor(db: SqlConnection) {
    this.db = db;
  }

  run<T>(operation: (db: SqlConnection) => Promise<T>): Promise<T> {
    const result = this.tail.then(() => operation(this.db));
    this.tail = result.catch(() => undefined);
    return result;
  }

  transaction<T>(operation: (db: SqlConnection) => Promise<T>): Promise<T> {
    return this.run(async (db) => {
      let result!: T;
      await db.withTransactionAsync(async () => {
        result = await operation(db);
      });
      return result;
    });
  }
}
