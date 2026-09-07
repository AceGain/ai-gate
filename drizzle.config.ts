import {defineConfig} from 'drizzle-kit'

export default defineConfig({
  schema: './server/src/schema/index.ts',
  out: './server/drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.AI_GATE_DATA_DIR ? `${process.env.AI_GATE_DATA_DIR}/ai-gate.db` : './server/data/ai-gate.db'
  }
})
