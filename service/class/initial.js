var fs = require('fs'),
    exec = require('child_process').exec;

var pwd = process.argv[1];
pwd = pwd.substr(0, pwd.lastIndexOf('/'));

if ( !fs.existsSync(pwd + '/database.json') ) {
    fs.linkSync(pwd + '/database-sample.json', pwd + '/database.json');
}

var cfg = require(pwd + '/database.json');

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

var Release = new Firebase(cfg.release.host);
Release.auth(cfg.release.token, function(error, result) {
  if(error) {
    throw "Login Failed!" + error;
  }
});

module.exports = {
  'Live': Live,
  'Chrome': Chrome,
  'Mobile': Mobile,
  'FBgraph': Graph,
  'Release': Release
};