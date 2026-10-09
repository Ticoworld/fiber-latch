import pg from 'pg';
import { createPostgresAccessReceiptStore, type PostgresQueryExecutor } from '@fiberlatch/postgres-store';
import { redeemAccessReceipt, type AccessReceiptStore, type RedeemAccessReceiptInput } from '@fiberlatch/access';

const pool = new pg.Pool();
const query: PostgresQueryExecutor = (sql, parameters) => pool.query(sql, [...parameters]);
const store: AccessReceiptStore = createPostgresAccessReceiptStore(query);
declare const hostInput: Omit<RedeemAccessReceiptInput, 'store'>;
void redeemAccessReceipt({ ...hostInput, store });
// @ts-expect-error Boolean parameters are outside the executor contract.
void query('SELECT $1', [true]);
