const express = require('express')
var cors = require('cors')
const fs = require('fs')
const app = express()
const port = 80

var corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}

var mainSiteDomain = "cosmos-softwares.com";
var basicHostingSub = "hosting.";

if (process.argv.slice(2)[0] == "dev") {
  mainSiteDomain = "localhost";
  basicHostingSub = "";
}

app.get('/*', (req, res) => {
  if (req.get('host').includes(basicHostingSub) && req.get('host').includes(mainSiteDomain)) {
    res.set('Access-Control-Allow-Origin', req.get('host').split("." + basicHostingSub + mainSiteDomain)[0] + '.hosting.cosmos-softwares.com');
    var path = __dirname + "/hosted/" + req.get('host').split("." + basicHostingSub + mainSiteDomain)[0] + req.path;
    if (fs.existsSync(path)) {
      res.sendFile(path)
    } else {
      res.status(404)
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>404 Not Found</title>
            <style>
              body {
                font-family: Arial, Helvetica, sans-serif;
              }
            </style>
          </head>
          <body>
            <h1>404 Not Found</h1>
            <hr>
            <h3>We couldn't find that page, it may have been moved to another URL.</h3>
            <h5><i>Cosmos Hosting Webserver, powered by Cosmos Softwares</i></h5>
          </body>
        </html>
      `)
    }
  } else {
    return;
  }
})

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
