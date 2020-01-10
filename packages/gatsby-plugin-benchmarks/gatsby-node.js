const { performance } = require(`perf_hooks`)
const https = require(`https`)

const bootstrapTime = performance.now()

let apiServer
let apiPath

class BenchMeta {
  constructor() {
    this.flushed = false
    this.flushing = false
    this.crashed = false
    this.localTime = new Date().toJSON()
    this.events = {
      // TODO: we should also have access to node's timing data and see how long it took before bootstrapping this script
      bootstrapTime,
      instanceTime: performance.now(),
      start: 0,
      bootstrap: 0,
      stop: 0,
    }
    this.started = false
  }

  markStart() {
    if (this.started) {
      this.crashed = "Error: Should not call markStart() more than once"
      console.error("gatsby-plugin-benchmarks: " + this.crashed)
      TODO // report error.
    }
    this.events.start = performance.now()
    this.started = true
  }

  markDataPoint(name) {
    this.events[name] = performance.now()
  }

  markStop() {
    if (!this.events.start) {
      this.crashed =
        "Error: Should not call markStop() before calling markStart()"
      console.error("gatsby-plugin-benchmarks: " + this.crashed)
      TODO // report error.
    }
    this.events.stop = performance.now()
    return this.flush()
  }

  flush() {
    this.flushing = true
    return new Promise(resolve => {
      try {
        const data = JSON.stringify({
          time: this.localTime,
          sessionId: JSON.stringify(this.events),
        })

        const req = https.request(
          {
            host: apiServer,
            path: apiPath,
            // port: 8080,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(data),
            },
          },
          resp => {
            resp.resume()

            let data = ""
            resp.on("data", chunk => (data += chunk))
            resp.on("end", () => {
              if (!resp.complete) {
                console.error(
                  "gatsby-plugin-benchmarks: The connection was terminated while the benchmark data was still being sent to the server"
                )
                reject()
              } else {
                console.log(
                  "gatsby-plugin-benchmarks: Benchmark data sent! Server response: " +
                    data
                )
                resolve()
              }
            })
          }
        )
        req.on("error", e =>
          console.error(
            `gatsby-plugin-benchmarks: There was a problem with sending benchmark data to server: ${e.message}`
          )
        )
        req.write(data)
        req.end()
      } catch (e) {
        this.crashed = "Sending the benchmark data crashed: " + e.message
        console.error("gatsby-plugin-benchmarks: " + this.crashed)
      }
    })
  }
}

process.on(`exit`, async () => {
  if (!benchMeta.flushing && !benchMeta.crashed) {
    console.log(
      "gatsby-plugin-benchmarks: This is process.exit(); Not yet flushed, will flush now but it's probably too late..."
    )
    benchMeta.markDataPoint("post-build")
    return benchMeta.markStop()
    // TODO // emit error; the data should have been flushed before exiting the node process
  }
})

const benchMeta = new BenchMeta()

async function onPreInit(api, options) {
  // console.log("# onPreInit")

  // This should be set in the gatsby-config of the site when enabling this plugin
  apiServer = options.server
  apiPath = options.path
  console.log(
    "gatsby-plugin-benchmarks: Will post benchmark data to",
    "https://" + apiServer + apiPath
  )

  benchMeta.markStart()
  benchMeta.markDataPoint("pre-init")
}

async function onPreBootstrap(...args) {
  // console.log("# onPreBootstrap")
  benchMeta.markDataPoint("pre-bootstrap")
}

async function onPreBuild(...args) {
  // console.log("# onPreBuild")
  benchMeta.markDataPoint("pre-build")
}

async function onPostBuild(api, options) {
  // console.log("# onPostBuild")
  benchMeta.markDataPoint("post-build")
  return benchMeta.markStop(options)
}

module.exports = { onPreInit, onPreBootstrap, onPreBuild, onPostBuild }
