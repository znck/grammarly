// @ts-check
/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  name: require('./package.json').name,
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.test.json',
    },
  },
}

module.exports = config
