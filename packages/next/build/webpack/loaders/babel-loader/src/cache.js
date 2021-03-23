import { createHash } from 'crypto'
import transform from './transform'
import cacache from 'next/dist/compiled/cacache'

async function read(cacheDirectory, etag, parentSpan) {
  const cachedResult = await parentSpan
    .traceChild('read-cache-file')
    .traceAsyncFn(() => cacache.get(cacheDirectory, etag))
  return JSON.parse(cachedResult.data)
}

function write(cacheDirectory, etag, data, parentSpan) {
  return parentSpan
    .traceChild('write-cache-file')
    .traceAsyncFn(() => cacache.put(cacheDirectory, etag, JSON.stringify(data)))
}

const etag = function (source, identifier, parentSpan) {
  return parentSpan.traceChild('etag').traceFn(() => {
    const hash = createHash('md4')

    const contents = JSON.stringify({ source, identifier })

    hash.update(contents)

    return hash.digest('hex')
  })
}

export default async function handleCache(params) {
  const { parentSpan } = params
  const handleCacheSpan = parentSpan.traceChild('handle-cache')

  return handleCacheSpan.traceAsyncFn(async () => {
    const { source, options = {}, cacheIdentifier, cacheDirectory } = params

    const file = etag(source, cacheIdentifier, handleCacheSpan)

    try {
      // No errors mean that the file was previously cached
      // we just need to return it
      const res = await read(cacheDirectory, file, handleCacheSpan)
      handleCacheSpan.setAttribute('cache', res ? 'HIT' : 'MISS')
      return res
    } catch (err) {}

    // Otherwise just transform the file
    // return it to the user asap and write it in cache
    const transformSpan = handleCacheSpan.traceChild('babel-cache-transform')
    const result = await transformSpan.traceAsyncFn(async () => {
      return transform(source, options, transformSpan)
    })

    await write(cacheDirectory, file, result, handleCacheSpan)

    return result
  })
}
