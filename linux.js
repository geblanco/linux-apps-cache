'use strict'

var path = require('path')
var fs = require('fs')
var { uniq, flatten, lowerCase } = require('lodash')
const abbreviation_rx = /([^\s])[^\s]*\s?/g

var getAbbr = (name) => (
  lowerCase(name).replace(abbreviation_rx, '$1')
)

var shellCommand = console.log.bind(console, 'Shell Command')

let appDirs = [
  path.join(process.env.HOME, '.local', 'share'),
  path.join('/usr', 'share'),
  path.join('/usr', 'share', 'ubuntu'),
  path.join('/usr', 'share', 'gnome'),
  path.join('/usr', 'local', 'share'),
  path.join('/var', 'lib', 'snapd', 'desktop')
]

if (!!process.env.XDG_DATA_DIRS) {
  appDirs = [
    ...appDirs,
    ...process.env.XDG_DATA_DIRS.split(':')
  ]
}

// Icon resolutions in priority of checking
const iconResolutions = [
  'scalable',
  '1024x1024',
  '512x512',
  '256x256',
  '192x192',
  '128x128',
  '96x96',
  '72x72',
  '64x64',
  '48x48',
  '40x40',
  '36x36',
  '32x32',
  '24x24',
  '22x22',
  '20x20',
  '16x16'
]

// Directories when we are trying to find an icon
let iconDirs = uniq(flatten([
  ...iconResolutions.map(resolution => (
    appDirs.map(dir => path.join(dir, 'icons', 'hicolor', resolution, 'apps'))
  )),
  path.join('/usr', 'share', 'pixmaps'),
  path.join('/usr', 'share', 'app-install', 'icons')
])).filter(fs.existsSync)

const iconExtension = [
  'svg',
  'png'
]

module.exports.addThemeForIconLookup = (themeDir) => {
  if (!path.isAbsolute(themeDir)) {
    themeDir = uniq(flatten([
      ...iconResolutions.map(resolution => (
        appDirs.map(dir => path.join(dir, 'icons', themeDir, 'apps', resolution))
      ))
    ])).filter(fs.existsSync)
  } else {
    themeDir = [ themeDir ]
  }
  iconDirs = [ ...iconDirs, ...themeDir ]
}

module.exports.PATTERNS = []

module.exports.DIRECTORIES = uniq([
  ...appDirs.map(dir => path.join(dir, 'applications')),
  path.join('usr', 'share', 'app-install', 'desktop')
]).filter(fs.existsSync)

module.exports.EXTENSIONS = ['desktop']

module.exports.openApp = ({ exec }) => {
  if (exec) {
    // Replace %u and other % arguments in exec script
    // https://github.com/KELiON/cerebro/pull/62#issuecomment-276511320
    const cmd = exec.replace(/%./g, '')
    shellCommand(cmd)
  }
}

const parseDesktopFile = (filePath, mapping) => {
  const content = fs.readFileSync(filePath, 'utf-8')
  return Object.keys(mapping).reduce((acc, key) => {
    let value = ''
    const regexp = new RegExp(`^${mapping[key]}=(.+)$`, 'm')
    const match = content.match(regexp)
    if (match) {
      value = match[1]
    }
    return {
      ...acc,
      [key]: value
    }
  }, {})
}

const getId = (filePath) => {
  const match = filePath.match(/\/applications\/(.+)$/)
  return match ? match[1] : filePath
}

const findIcon = (icon) => {
  if (path.isAbsolute(icon)) {
    return icon
  }
  return flatten(iconExtension.map(ext =>
    iconDirs.map(dir => path.join(dir, `${icon}.${ext}`))
  )).find(fs.existsSync)
}

module.exports.toString = ({ name, exec }) => {
  const binaryName = exec
      .split('/')
      .pop()
      .split(' ')
      .shift()
  return `${name} ${getAbbr(name)} ${binaryName}`
}

module.exports.formatPath = (filePath) => {
  const parsedData = parseDesktopFile(filePath, {
    name: 'Name',
    description: 'Comment',
    exec: 'Exec',
    hidden: 'NoDisplay',
    icon: 'Icon'
  })
  const filename = path.basename(filePath)
  return {
    ...parsedData,
    filename,
    icon: findIcon(parsedData.icon),
    hidden: !!parsedData.hidden || !parsedData.exec,
    id: getId(filePath),
    name: parsedData.name || filename.replace(/\.(desktop)/, ''),
    path: filePath
  }
}
