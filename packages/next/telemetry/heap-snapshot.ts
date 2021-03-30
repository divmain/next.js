import { writeSnapshot } from 'heapdump'

export function initHeapSnapshots(snapshotInterval: string) {
  if (snapshotInterval?.length && /^\d+$/.test(snapshotInterval)) {
    const interval = setInterval(() => {
      writeSnapshot((err, filename) =>
        console.log(
          err
            ? `unable to write heap snapshot to disk: ${err}`
            : `wrote heapsnapshot to disk: ${filename}`
        )
      )
    }, Number.parseInt(snapshotInterval))

    return () => clearInterval(interval)
  }

  return () => {}
}
