import { join, normalize, resolve } from 'path'
import { webpack } from 'next/dist/compiled/webpack/webpack'
import loadConfig from '../next-server/server/config'
import { PHASE_DEVELOPMENT_SERVER } from '../next-server/lib/constants'
import { NextConfig } from '../next-server/server/config'
import { getWebpackConfig } from '../server/hot-reloader'
import { findPagesDir } from '../lib/find-pages-dir'
import loadCustomRoutes from '../lib/load-custom-routes'
import { generateBuildId } from './generate-build-id'
import { nanoid } from 'next/dist/compiled/nanoid/index.cjs'

const LIBRARY_NAME = '_nextJsCommon'
const DLL_MANIFEST_FILENAME = 'dll-manifest.json'

export function buildPrecompile(
  config: webpack.Configuration,
  isServer: boolean
): webpack.Configuration {
  if (
    !config?.output?.path ||
    typeof config.entry !== 'object' ||
    !(config.plugins instanceof Array)
  ) {
    //@ts-ignore
    console.error('config.output.path', config.output.path)
    console.error('config.entry', config.entry)
    console.error('config.plugins', config.plugins)
    throw new Error('Unable to precompile: invalid Webpack config.')
  }
  const context = normalize(join(config.output.path, '..'))

  const outputPath = join(
    config.output.path,
    'precompile',
    isServer ? 'server' : 'client'
  )
  const manifestPath = join(outputPath, DLL_MANIFEST_FILENAME)
  const entry = Object.entries(config.entry)
    // .filter(([entryName]) => entryName.indexOf('pages/') !== 0)
    .reduce((memo: any, [entryName, entryResolution]) => {
      memo[entryName] = entryResolution
      return memo
    }, {})
  const plugins = [
    ...config.plugins,
    new webpack.DllPlugin({
      name: LIBRARY_NAME,
      path: manifestPath,
      context,
    }),
  ]
  // TODO: config.plugins should not contain BuildManifestPlugin

  return {
    ...config,
    output: {
      ...config.output,
      library: LIBRARY_NAME,
      path: outputPath,
    },
    entry,
    plugins,
  }
}

export default async function precompile(dir: string) {
  dir = resolve(dir || '.')
  const pagesDir = findPagesDir(dir)
  const previewProps = {
    previewModeId: 'NEED TO GENERATE THIS',
    previewModeEncryptionKey: 'NEED TO GENERATE THIS',
    previewModeSigningKey: 'NEED TO GENERATE THIS',
  }

  const config: NextConfig = await loadConfig(PHASE_DEVELOPMENT_SERVER, dir)
  const buildId = await generateBuildId(config.generateBuildId, nanoid)
  const { rewrites } = await loadCustomRoutes(config)

  const webpackConfig = await getWebpackConfig({
    dir,
    pagesDir,
    config,
    buildId,
    previewProps,
    rewrites,
  })

  console.log(webpackConfig)
  console.log(webpackConfig[0].entry['pages/_app'])
  process.exit(0)
}
