const app = require('./')
const port = process.env.NODE_PORT || 3764
app.listen(port, () => {
  console.log(`http://localhost:${port}`)
})
