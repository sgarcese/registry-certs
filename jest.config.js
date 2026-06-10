module.exports = {
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    // Make package "exports" resolve node builds (mssql's nested uuid ships
    // an ESM browser build that jsdom would otherwise pick up).
    customExportConditions: ['node', 'node-addons'],
  },
  snapshotSerializers: ['@emotion/jest/serializer'],
  // Keep the Jest 24-era snapshot format the committed snapshots were
  // written in.
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true,
  },
  setupFiles: ['<rootDir>/lib/test/jest-polyfills.js'],
  moduleNameMapper: {
    '^@cityofboston/react-fleet$': '<rootDir>/vendor/react-fleet/react-fleet.ts',
    '^@cityofboston/next-client-common$':
      '<rootDir>/vendor/next-client-common/next-client-common.ts',
    '^@cityofboston/graphql-typescript$':
      '<rootDir>/vendor/graphql-typescript/graphql-typescript.ts',
  },
  transform: {
    '^.+\\.html$': '<rootDir>/lib/test/raw-transform.js',
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/build/',
    '/scripts/',
    '/terraform/',
  ],
};
