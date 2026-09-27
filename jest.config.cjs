/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2022',
          module: 'CommonJS',
          moduleResolution: 'node',
          esModuleInterop: true,
        },
        diagnostics: false,
      },
    ],
    '^.+\\.m?js$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        ],
      },
    ],
  },
  // Allow Jest to transform ml-matrix (which ships as ESM)
  transformIgnorePatterns: ['node_modules/(?!(ml-matrix)/)'],
  testMatch: ['**/tests/**/*.test.ts'],
  // Strip .js extensions from imports so Node finds the .ts source files
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
