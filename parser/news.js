var http = require('http');
var async = require('async');
var exec = require('child_process').exec;
var uuid = require('node-uuid');
var GSpreadsheet = require('gspreadsheet');


try {

  var DataBase = require('../class/initial.js');
  var Live = DataBase.Live;
  var FBgraph = DataBase.FBgraph;
  var ReleaseNews = DataBase.ReleaseNews;
  
  var gspreadsheet = new GSpreadsheet('1LN0qN4NmaRYByW-VMywEneVYovCIt8ExpinZRhJDuKw', '921695175');

  var News = Live.Object.extend("news");

  function getPost(pageId, cb) {
    FBgraph.get(pageId + '/posts?limit=10&fields=type,message,description,link,created_time,full_picture,picture', function(err, res) {
      var data = [];
      for (i=0, len=res.data.length; i<len; i++) {
        if (res.data[i].message || res.data[i].description) {
          data.push({
            "type": res.data[i].type,
            "message": (res.data[i].message || res.data[i].description),
            "picture": (res.data[i].full_picture || res.data[i].picture || ''),
            "link": res.data[i].link || '',
            "datetime": new Date(new Date(res.data[i].created_time).getTime()+8*60*60*1000).toISOString().replace(/\.\w+/i,'+08:00')
          });
        }
      }
      cb(null, data);
    });
  }

  function getPage(pageId, cb) {
      FBgraph.get(pageId, function (err, res) {
        var data = {
          "id": res.id,
          "about": res.about,
          "name": res.name,
          "cover": res.cover && res.cover.source || '',
          "picture": "https://graph.facebook.com/" + res.id + "/picture"
        };
        cb(null, data);
      });
  }

  var parser = function (cb){

    gspreadsheet.getJSON(function (res) {
      if (res && res.result && res.result.length ) {
        var pages = res.result;
        async.map(pages, function (item, cb) {
          item = item.content;
          async.parallel({
            'page': function (cb) {
              getPage(item.pid, function (err, data) {
                cb(null, data);
              });
            },
            'post': function (cb) {
                getPost(item.pid, function (err, data) {
                  cb(null, data);
                });
            }
          }, function(err, result){
            result['page']['priority'] = item.priority;
            result['page']['post'] = result['post'];
            cb(null, result['page']);
          });
        }, function (err, results) {
          var data = {};
          results.sort(function (x,y) {
            return x.priority < y.priority ? 1 : -1;
          });
          results.forEach(function(item){
            data[item.id] = item;
          });
          ReleaseNews.child('news').set(data, function(err){
            cb && cb();
          });
        });
      }
    });
  }

  parser(function () {
      console.log(new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' News Run! ');
      process.exit(0);
  });

}
catch(err) {
    console.log('ERROR( ' + new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' ): ', err)
}
