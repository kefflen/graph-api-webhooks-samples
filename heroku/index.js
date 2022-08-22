/**
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
const { engine } = require('express-handlebars');
const http = require('http')
const { Server } = require('socket.io')
const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const xhub = require('express-x-hub');

const server = http.createServer(app)
const io = new Server(server)

io.on('connection', (data => {
  console.log('Connected: ' + data.id)
}))



app.engine('handlebars', engine())
app.set('view engine', 'handlebars')
app.set('views', './heroku/views')

app.set('port', (process.env.PORT || 5000));

app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));
app.use(bodyParser.json());

const token = process.env.TOKEN || 'token';
const received_updates = [];

app.get('/', function(req, res) {
  res.render('index', {
    receivedUpdates: JSON.stringify(received_updates, null, 2)
  })
});


app.get(['/facebook', '/instagram'], function(req, res) {
  emitUpdate(req)
  if (
    req.query['hub.mode'] == 'subscribe' &&
    req.query['hub.verify_token'] == token
  ) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

app.post('/facebook', function(req, res) {
  console.log('Facebook request body:', req.body);
  emitUpdate(req)
  if (!req.isXHubValid()) {
    console.log('Warning - request header X-Hub-Signature not present or invalid');
    res.sendStatus(401);
    return;
  }

  console.log('request header X-Hub-Signature validated');
  // Process the Facebook updates here
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

app.post('/instagram', function(req, res) {
  emitUpdate(req)
  console.log('Instagram request body:');
  // Process the Instagram updates here
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

server.listen(app.get('port'));

app.use('/', (req, res) => {
  emitUpdate(req);
  return res.send()
})

function emitUpdate(req) {
  io.emit('update', {
    route: {
      method: req.method,
      path: req.url
    },
    data: req.body
  });
}
