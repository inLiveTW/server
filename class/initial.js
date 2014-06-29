var fs          = require('fs');
var https       = require('https');
var querystring = require('querystring');
var exec        = require('child_process').exec;

var pwd = process.argv[1];
pwd = pwd.substr(0, pwd.lastIndexOf('/'));

if ( !fs.existsSync(pwd + '/../config/database.json') ) {
  throw "Can not open database.json";
}

var cfg = require(pwd + '/../config/database.json');

var Firebase = require('firebase');

var Graph = require('fbgraph');
    Graph.setAccessToken(cfg.fbevent.fbtoken);

var Live = require('./live.js').Parse,
    Chrome = require('./chrome.js').Parse,
    Mobile = require('./mobile.js').Parse;

Live.initialize(cfg.live.appid, cfg.live.key, cfg.live.master);
Live.Cloud.useMasterKey();

Chrome.initialize(cfg.chrome.appid, cfg.chrome.key, cfg.chrome.master);
Chrome.Cloud.useMasterKey();

Mobile.initialize(cfg.mobile.appid, cfg.mobile.key, cfg.mobile.master);
Mobile.Cloud.useMasterKey();

var ReleaseLive = new Firebase(cfg.release_live.host);
ReleaseLive.auth(cfg.release_live.token, function(error, result) {
  if(error) {
    console.log("Login Failed!", error);
  }
});

var ReleaseEvent = new Firebase(cfg.release_event.host);
ReleaseEvent.auth(cfg.release_event.token, function(error, result) {
  if(error) {
    console.log("Login Failed!", error);
  }
});

var ReleaseNews = new Firebase(cfg.release_news.host);
ReleaseNews.auth(cfg.release_news.token, function(error, result) {
  if(error) {
    console.log("Login Failed!", error);
  }
});

var ReleaseData = new Firebase(cfg.release_data.host);
ReleaseData.auth(cfg.release_data.token, function(error, result) {
  if(error) {
    console.log("Login Failed!", error);
  }
});

var getGoogleAccess = function(cb){
  var grant = querystring.stringify({
    'grant_type': 'refresh_token',
    'client_id': cfg.push.client_id,
    'client_secret': cfg.push.client_secret,
    'refresh_token': cfg.push.refresh_token
  });

  var req = https.request({
    hostname: 'accounts.google.com',
    path: '/o/oauth2/token',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': grant.length
    }
  }, function(res){
    var body = '';
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      body += chunk;
    });
    res.on('end', function() {
      body = JSON.parse(body);
      if ( body.access_token ) {
        console.log('Get Access Token:', body.access_token);
        cb(null, body.access_token);
      }else{
        cb('Body Access Token is Null');
      }
    });
  });

  req.on('error', function(e) {
    cb(e.message);
  });

  req.write(grant);
  req.end();
}

module.exports = {
  'Live': Live,
  'Chrome': Chrome,
  'Mobile': Mobile,
  'FBgraph': Graph,
  'ReleaseLive': ReleaseLive,
  'ReleaseEvent': ReleaseEvent,
  'ReleaseNews': ReleaseNews,
  'ReleaseData': ReleaseData,
  'getGoogleAccess': getGoogleAccess,
  'Config': cfg
};