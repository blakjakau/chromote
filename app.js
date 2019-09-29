var http = require('http');
var express = require('express');
var realtime = require('./realtime.js')

// and lets get into our application
var app = express(); 

app.use("/", express.static('./public'));

app.use('/', function(req, res, next) {
	res.status(200);
	res.end('temp')
})

app.server = http.createServer(app);
// need to make this command-line configurable

app.server.listen(9095);
realtime(app.server);

