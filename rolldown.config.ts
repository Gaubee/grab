import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/cli.ts',
  output: {
    dir: 'bundle',
  },
});
