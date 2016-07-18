'use strict'
const co = require('co')
const koa = require('koa')
const fetch = require('axios')
const cheerio = require('cheerio')
const cash = require('koa-cash')
const lruCache = require('lru-cache')
const cors = require('kcors')

const app = koa()

const cache = lruCache({
  maxAge: 12 * 60 * 60 * 1000 // 12 hours
})

const isDatePath = function isDatePath(url) {
  return /^(\d{4}\/\d{2}\/\d{2})/.test(url)
}

const request = co.wrap(function* request(date) {
  const html = yield fetch.get(`http://nightly.changelog.com/${date}/`)
  return html
})

const parse = function ($) {
  const topAll = []
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
      language
    }
  }
  $('#top-all').find('.repository ').each(function () {
    topAll.push(query($(this)))
  })
  $('#top-new').find('.repository ').each(function () {
    topNew.push(query($(this)))
  })
  return {
    topAll,
    topNew
  }
}

app.use(cash({
  get(key, maxAge) {
    return cache.get(key)
  },
  set(key, value) {
    cache.set(key, value)
  }
}))
app.use(cors())
app.use(function* () {
  const url = this.req.url.substr(1)
  if (isDatePath(url)) {
    if (yield this.cashed()) return
    try {
      const result = yield request(url)
      const $ = cheerio.load(result.data)
      const data = parse($)
      this.body = data
    } catch (e) {
      if (e.status) {
        this.status = e.status
        this.body = e.statusText
      } else {
        console.log(e.stack)
      }
    }
  } else {
    this.body = 'not found'
  }
})

const port = process.env.NODE_PORT || 3764
app.listen(port, () => {
  console.log(`http://localhost:${port}`)
})
