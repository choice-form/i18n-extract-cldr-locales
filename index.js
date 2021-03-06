const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')

// The main function
run()

function run() {
  const localesPath = path.resolve(__dirname, 'locales')
  rimraf.sync(localesPath)

  fs.mkdirSync(localesPath)

  const codes = getAllCodes()

  for (let code of codes) {
    const locale = transformToLocale(code)

    const names = codes.reduce((acc, destCode) => {
      const name = getName(locale, destCode)
      if (name) acc[destCode] = name
      return acc
    }, {})

    fs.writeFileSync(`./locales/${locale.code}.json`, JSON.stringify(names, null, 2))
  }
}

function getAllCodes() {
  return fs.readdirSync('./node_modules/cldr-localenames-modern/main')
    .map(code => code === 'en-US-POSIX' ? 'en-US' : code)
}

/*
 * {
 *   code: 'zh-Hant-HK',
 *   splittedCode: ['zh', 'Hant', 'HK'],
 *   meta: {zh: 'language', Hant: 'script', HK: 'territory'}
 * }
 */
function transformToLocale(code) {
  const locale = {
    code: code,
    splittedCode: code.split('-'),
  }

  locale.meta = getLocaleMeta(locale)

  return locale
}

function getLocaleMeta(locale) {
  const identity = readLocaleIdentity(locale.code)

  return locale.splittedCode.reduce((acc, code) => {
    for (let key in identity) {
      if (key !== 'version' && identity[key] === code) {
        acc[code] = key
        return acc
      }
    }
    return acc
  }, {})
}

function getName(locale, destCode) {
  const splittedCode = locale.splittedCode

  for (let i = splittedCode.length; i >= 1; i--) {
    const subcode = splittedCode.slice(0, i).join('-')
    const name = readCLDRData(destCode, 'languages', subcode)

    if (!name) continue

    if (subcode === locale.code) return name

    const extra = splittedCode.slice(i).map((subcode) => {
      const type = locale.meta[subcode]
      switch (type) {
        case 'language':
          return readCLDRData(destCode, 'languages', subcode)
        case 'script':
          return readCLDRData(destCode, 'scripts', subcode)
        case 'territory':
          return readCLDRData(destCode, 'territories', subcode)
        case 'variant':
          return readCLDRData(destCode, 'variants', subcode)
        default:
          throw new Error(`Unhandled subcode type: ${type}`)
      }
    })

    return [name].concat(extra).join(' - ')
  }

  throw new Error(`Can't find name (${destCode}) for locale ${locale.code}`)
}

function readLocaleIdentity(code) {
  return readFile(code, 'languages')['identity']
}

function readCLDRData(code, type, subcode) {
  const names = readLocaleDisplayNames(code, type)
  // Don't use <locale>-alt-short because some of them are not correct.
  return names[subcode]
}

function readLocaleDisplayNames(code, type) {
  return readFile(code, type)['localeDisplayNames'][type]
}

function readFile(code, type) {
  if (code === 'en-US') code = 'en-US-POSIX'
  const content = require(`cldr-localenames-modern/main/${code}/${type}.json`)
  return content['main'][code]
}
