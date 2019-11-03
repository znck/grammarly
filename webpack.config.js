//@ts-check

const path = require('path')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node', 
  entry: {
    extension: './src/extension.ts',
    server: './src/server.ts',
  }, 
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode',
    parse5: 'commonjs parse5',
    jsdom: 'commonjs jsdom',
    consola: 'commonjs consola',
    'vscode-languageserver': 'commonjs vscode-languageserver',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin()
  ]
}
module.exports = config
