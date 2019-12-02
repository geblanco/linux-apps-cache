
const glob = require('glob')
const path = require('path')
const fs = require('fs')
const { flatten, uniq } = require('lodash')
const { DIRECTORIES, PATTERNS, EXTENSIONS, formatPath,  } = require(path.join(__dirname || './', 'linux'))

// Every 30 minutes
const REINDEX_TIME = 30 * 60 * 1000
const CACHE_FILE = path.join(process.env.HOME, '.config', 'apps_cache.json')
const cacheOptions = { encoding: 'utf-8' }

const noop = (cb) => typeof cb === 'function' ? cb : function(){}

const getAppsList = () => {
  let patterns = DIRECTORIES.map(dir =>
    path.join(dir, '**', `*.+(${EXTENSIONS.join('|')})`)
  )
  patterns = [
    ...patterns,
    ...(PATTERNS || [])
  ]
  const promises = patterns.map(pattern => (
    new Promise((resolve, reject) => {
      glob(pattern, {}, (err, files) => {
        return err ? reject(err) : resolve(files)
      })
    })
  ))
  return Promise.all(promises).then(apps => (
    uniq(flatten(apps)).map(formatPath).filter(app => !app.hidden)
  ))
}

const scanApps = (callback) => getAppsList().then(apps => {
  callback = noop(callback)
  const json = JSON.stringify(apps, null, 2)
  fs.writeFile(CACHE_FILE, json, cacheOptions, (err) => {
    if (err) callback(err)
    else callback(null, apps)
  })
})

module.exports.init = (ignoreCache=false, callback=()=>{}, reindexCallback=()=>{}) => {
  callback = noop(callback)
  fs.exists(CACHE_FILE, (exists) => {
    if (!exists || ignoreCache){
      scanApps(callback)
    } else {
      fs.readFile(CACHE_FILE, cacheOptions, (err, json) => {
        if (!err) callback(null, JSON.parse(json))
        else callback(err)
      })
    }
  })

  setInterval(scanApps.bind(null, reindexCallback), REINDEX_TIME)
  DIRECTORIES.forEach(dir => fs.watch(dir, {}, scanApps.bind(null, reindexCallback)))
}

module.exports.setWatchCallback = (callback) => {
  DIRECTORIES.forEach(dir => fs.watch(dir, {}, scanApps.bind(null, callback) ))
}
module.exports.scanApps = scanApps
