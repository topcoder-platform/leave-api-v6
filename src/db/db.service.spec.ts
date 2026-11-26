import { ConfigService } from '@nestjs/config';
import { DbService } from './db.service';

describe('DbService', () => {
  it('constructs a Prisma client with the configured PostgreSQL schema', async () => {
    const config = new ConfigService({
      DATABASE_URL: 'postgresql://test:test@localhost:5432/leave?schema=leave',
    });
    const db = new DbService(config);
    await db.onModuleDestroy();
  });

  it('rejects missing database configuration', () => {
    expect(() => new DbService(new ConfigService({ DATABASE_URL: '' }))).toThrow(
      'A PostgreSQL connection URL is required',
    );
  });
});
