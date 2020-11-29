const Koa = require('koa')
const fetch = require('axios')
const cheerio = require('cheerio')
const cash = require('koa-cash')
const LruCache = require('lru-cache')
const cors = require('kcors')
const qs = require('querystring')

const app = new Koa()

const cache = new LruCache({
  maxAge: 1 * 60 * 60 * 1000, // 1 hour
})

const isDatePath = function isDatePath(url) {
  return /^(\d{4}\/\d{2}\/\d{2})/.test(url)
}

const request = async function request(date) {
  const html = await fetch.get(`http://nightly.changelog.com/${date}/`)
  return html
}

const parse = function ($) {
  const topAllFirsts = []
  const topAllRepeats = []
  const topNew = []
  function query(context) {
    const statRe = /(\d+)[^\d]+(\d+)/
    const repo = context.find('h3').text().trim()
    const stats = context.find('p').first().text().trim().match(statRe)
    const stars = stats[1]
    const growth = stats[2]
    const language = context.find('p').first().find('a').text().trim()
    return {
      repo,
      url: `https://github.com/${repo}`,
      description: context.find('h3').next().text().trim(),
      stars,
      growth,
      language,
    }
  }
  $('#top-all-firsts')
    .find('.repository ')
    .each(function () {
      topAllFirsts.push(query($(this)))
    })
  $('#top-all-repeats')
    .find('.repository ')
    .each(function () {
      topAllRepeats.push(query($(this)))
    })
  $('#top-new')
    .find('.repository ')
    .each(function () {
      topNew.push(query($(this)))
    })
  return {
    topAllFirsts,
    topAllRepeats,
    topNew,
  }
}

app.use(
  cash({
    get(key, maxAge) {
      return cache.get(key)
    },
    set(key, value) {
      cache.set(key, value)
    },
  }),
)
app.use(cors())
app.use(async function (ctx) {
  const { date } = qs.parse(ctx.request.querystring)
  if (isDatePath(date)) {
    if (await ctx.cashed()) return
    try {
      const result = await request(date)
      const $ = cheerio.load(result.data)
      const data = parse($)
      ctx.body = data
    } catch (e) {
      if (e.status) {
        ctx.status = e.status
        ctx.body = e.statusText
      } else {
        console.log(e.stack)
      }
    }
  } else {
    ctx.body = 'not found'
  }
})

module.exports = app
